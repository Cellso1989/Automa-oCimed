// Script standalone pra completar Fiscal/Logística/Financeira e aprovar um
// Lead ESPECÍFICO (Análise Fiscal em diante) — mesma lógica do CT 9/10/11/12,
// mas direcionada por Id/Empresa em vez de pegar "qualquer Lead do tipo X em
// Análise Fiscal" (o que pode acabar pegando um Lead diferente do que se
// pretende, como aconteceu ao rodar o CT 9 sem Id específico).
//
// Detecta o Tipo de Registro automaticamente: CG Cloud usa "Editar Lead
// Aprovação" + "Salvar e Aprovar" (mecanismo que dispara a conversão nativa
// real, com Account/Contact criados); os demais tipos (Cimed Tech,
// Milimetric, Hospitalar) usam o fluxo antigo (aprovar etapa + marcar
// Status como "Convertido" manualmente) — pra esses, "Convertido" é só o
// campo customizado, a conversão real depende da integração SAP externa.
//
// Uso:
//   node scripts/converter-lead.js <LeadId ou Empresa>
const { chromium } = require("@playwright/test");
const { soapLogin } = require("../support/soapLogin");
const { soqlQuery } = require("../support/soqlQuery");
const {
  aprovarEtapaPendente,
  completarFiscalLogisticaEConverter,
  marcarStatusConvertido,
  aprovarAnaliseFiscalComEdicao,
} = require("../support/leadHelpers");
const env = require("../env.json");

async function resolverLeadId(sfSession, argumento) {
  if (/^00Q\w{12,15}$/.test(argumento)) {
    return argumento;
  }

  const resultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id, Company FROM Lead WHERE Company = '${argumento.replace(/'/g, "\\'")}'`,
  });

  if (resultado.totalSize === 0) {
    throw new Error(`Nenhum Lead encontrado com Empresa "${argumento}".`);
  }
  if (resultado.totalSize > 1) {
    throw new Error(
      `Mais de um Lead encontrado com Empresa "${argumento}" (${resultado.totalSize}) — passe o Id do Lead (prefixo "00Q") em vez do nome.`
    );
  }

  return resultado.records[0].Id;
}

async function main() {
  const argumento = process.argv[2];
  if (!argumento) {
    console.error("Uso: node scripts/converter-lead.js <LeadId ou Empresa>");
    process.exit(1);
  }

  const sfSession = await soapLogin({
    username: env.sfUsername,
    password: env.sfPassword,
    securityToken: env.sfSecurityToken || "",
  });

  const leadId = await resolverLeadId(sfSession, argumento);

  const tipoResultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT RecordType.Name FROM Lead WHERE Id = '${leadId}'`,
  });
  const tipoRegistro = tipoResultado.records[0].RecordType.Name;
  console.log(`Processando Lead ${leadId} (Tipo de Registro: ${tipoRegistro})...`);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(`https://${sfSession.instanceHost}/secur/frontdoor.jsp?sid=${sfSession.sessionId}`);
  await page.goto(`https://${sfSession.instanceHost}/lightning/page/home`);
  await page.waitForURL(/\/lightning\//, { timeout: 60000 });

  await page.goto(`https://${sfSession.instanceHost}/lightning/r/Lead/${leadId}/view`);
  await page.waitForTimeout(3000);

  await completarFiscalLogisticaEConverter(page, tipoRegistro, sfSession, leadId);

  if (tipoRegistro === "CG Cloud") {
    await aprovarAnaliseFiscalComEdicao(page);
    console.log('Aprovado via "Editar Lead Aprovação" + "Salvar e Aprovar" — conversão nativa real deve ter ocorrido.');
  } else {
    await aprovarEtapaPendente(page);
    await marcarStatusConvertido(page);
    console.log('Status marcado como "Convertido" (campo customizado — não é conversão nativa do Salesforce pra esse tipo).');
  }

  console.log("Processamento concluído. Verifique o Lead no navegador antes de fechar.");
  await browser.close();
}

main().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
