// Diagnostica por que a integração com o SAP falhou (ou confirma sucesso)
// pra uma Conta específica — busca o Log_Integracao__c mais recente, mostra
// as mensagens de erro reais do SAP e, se falhou, compara o JSON enviado com
// o de uma Conta que integrou com sucesso, apontando os campos que
// provavelmente causaram o erro (geralmente vazios/nulos no envio).
//
// Aceita Account Id (001...), Lead Id (00Q... — resolve pra
// ConvertedAccountId) ou nome da Empresa/Conta.
//
// Uso:
//   node scripts/diagnosticar-integracao-sap.js <AccountId|LeadId|Empresa>
const { soapLogin } = require("../support/soapLogin");
const { soqlQuery } = require("../support/soqlQuery");
const env = require("../env.json");

async function resolverAccountId(sfSession, argumento) {
  if (/^001\w{12,15}$/.test(argumento)) {
    return argumento;
  }
  if (/^00Q\w{12,15}$/.test(argumento)) {
    const r = await soqlQuery({
      instanceHost: sfSession.instanceHost,
      sessionId: sfSession.sessionId,
      query: `SELECT ConvertedAccountId FROM Lead WHERE Id = '${argumento}'`,
    });
    if (!r.records[0]?.ConvertedAccountId) {
      throw new Error(`Lead "${argumento}" não tem ConvertedAccountId (ainda não converteu de verdade?).`);
    }
    return r.records[0].ConvertedAccountId;
  }
  const porNome = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id FROM Account WHERE Name = '${argumento.replace(/'/g, "\\'")}'`,
  });
  if (porNome.totalSize === 0) throw new Error(`Nenhuma Account encontrada com Nome "${argumento}".`);
  if (porNome.totalSize > 1) throw new Error(`Mais de uma Account com Nome "${argumento}" — passe o Id.`);
  return porNome.records[0].Id;
}

function camposVaziosNoEnvio(jsonEnviadoStr) {
  const json = JSON.parse(jsonEnviadoStr);
  return Object.entries(json)
    .filter(([, valor]) => valor === null || valor === "" || (Array.isArray(valor) && valor.length === 0))
    .map(([campo]) => campo);
}

async function main() {
  const argumento = process.argv[2];
  if (!argumento) {
    console.error("Uso: node scripts/diagnosticar-integracao-sap.js <AccountId|LeadId|Empresa>");
    process.exit(1);
  }

  const sfSession = await soapLogin({
    username: env.sfUsername,
    password: env.sfPassword,
    securityToken: env.sfSecurityToken || "",
  });

  const accountId = await resolverAccountId(sfSession, argumento);

  const conta = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Name, Status_Integracao__c, Codigo_SAP__c FROM Account WHERE Id = '${accountId}'`,
  });
  if (conta.totalSize === 0) throw new Error(`Account "${accountId}" não encontrada.`);
  const { Name, Status_Integracao__c, Codigo_SAP__c } = conta.records[0];
  console.log(`Conta: ${Name} (${accountId})`);
  console.log(`Status de Integração: ${Status_Integracao__c || "(vazio — integração ainda não rodou?)"}`);

  const logs = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id, Tipo_Log__c, Status_Code_Integracao__c, JSON_Enviado__c, JSON_Recebido__c, CreatedDate FROM Log_Integracao__c WHERE Conta__c = '${accountId}' ORDER BY CreatedDate DESC LIMIT 1`,
  });
  if (logs.totalSize === 0) {
    console.log("Nenhum Log_Integracao__c encontrado pra essa Conta — a integração pode nunca ter sido chamada.");
    return;
  }
  const log = logs.records[0];
  console.log(`\nÚltimo log (${log.CreatedDate}) — Tipo: ${log.Tipo_Log__c}, HTTP: ${log.Status_Code_Integracao__c}`);

  const recebido = log.JSON_Recebido__c ? JSON.parse(log.JSON_Recebido__c) : null;
  if (recebido?.SUCCESS === true) {
    console.log(`✅ Sucesso. Código SAP: ${Codigo_SAP__c || recebido.KUNNR}`);
    return;
  }

  console.log("❌ Falhou. Mensagens do SAP:");
  for (const msg of recebido?.MESSAGES || []) {
    console.log(`  - [${msg.TYPE}] ${msg.MESSAGE}`);
  }

  // Compara com um envio de sucesso recente (qualquer Conta) pra apontar
  // quais campos provavelmente causaram o erro (normalmente os que estão
  // vazios no envio problemático mas preenchidos no de sucesso).
  // "JSON_Recebido__c" é texto longo — não filtra por LIKE/= no SOQL, então
  // traz os últimos N logs do mesmo tipo e filtra "SUCCESS":true no código.
  const logsRecentes = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT JSON_Enviado__c, JSON_Recebido__c FROM Log_Integracao__c WHERE Tipo_Log__c = '${log.Tipo_Log__c}' ORDER BY CreatedDate DESC LIMIT 50`,
  });
  const logSucesso = logsRecentes.records.find((r) => {
    try {
      return JSON.parse(r.JSON_Recebido__c || "{}").SUCCESS === true;
    } catch {
      return false;
    }
  });

  const vaziosNoFalho = camposVaziosNoEnvio(log.JSON_Enviado__c);
  if (logSucesso) {
    const vaziosNoSucesso = new Set(camposVaziosNoEnvio(logSucesso.JSON_Enviado__c));
    const suspeitos = vaziosNoFalho.filter((campo) => !vaziosNoSucesso.has(campo));
    console.log("\nCampos vazios neste envio que NÃO estavam vazios num envio de sucesso (prováveis causas):");
    console.log(suspeitos.length ? suspeitos.map((c) => `  - ${c}`).join("\n") : "  (nenhum — comparar manualmente)");
  } else {
    console.log("\nCampos vazios neste envio (sem referência de sucesso pra comparar):");
    console.log(vaziosNoFalho.map((c) => `  - ${c}`).join("\n"));
  }
}

main().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
