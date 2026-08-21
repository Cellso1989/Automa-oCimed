// Fluxo completo, ponta a ponta: cria um Lead do tipo pedido, preenche a
// Análise Cadastral, aprova como Mayssara (Login As), completa Fiscal/
// Financeira/Logística, aprova via "Editar Lead Aprovação" + "Salvar e
// Aprovar" (mecanismo real de conversão — ver support/leadHelpers.js) e
// confirma o resultado (IsConverted, ConvertedAccountId, Status_Integracao__c
// da Conta) via SOQL.
//
// Tipos suportados (confirmados end-to-end): "Cimed Tech", "Milimetric",
// "CG Cloud", "Hospitalar". Hospitalar precisa ser criado como Nicole Gomes
// Amaral com "Segmento" = "Distribuidor Hospitalar" pra aprovação real
// disparar — ver [[project_lead_hospitalar_nicole]] na memória do projeto e
// a seção "Hospitalar" do README.md.
//
// Uso:
//   node scripts/criar-e-converter-lead.js "Cimed Tech"
//   node scripts/criar-e-converter-lead.js "Milimetric"
//   node scripts/criar-e-converter-lead.js "CG Cloud"
//   node scripts/criar-e-converter-lead.js "Hospitalar"
const { completarFiscalLogisticaEConverter, aprovarAnaliseFiscalComEdicao } = require("../support/leadHelpers");
const { soqlQuery } = require("../support/soqlQuery");
const { criarEAprovarCadastral: criarCgCloud } = require("./criar-massa-cg-cloud");
const { criarEAprovarCadastral: criarHospitalar } = require("./criar-massa-hospitalar-nicole");
const { criarEAprovarCadastral: criarOutroTipo } = require("./criar-massa-lead");

async function main() {
  const tipoRegistro = process.argv[2];
  if (!tipoRegistro) {
    console.error(`Uso: node scripts/criar-e-converter-lead.js "<Cimed Tech|Milimetric|CG Cloud|Hospitalar>"`);
    process.exit(1);
  }

  console.log(`Criando Lead ${tipoRegistro} e aprovando Análise Cadastral como Mayssara...`);
  let resultadoCriacao;
  if (tipoRegistro === "CG Cloud") {
    resultadoCriacao = await criarCgCloud();
  } else if (tipoRegistro === "Hospitalar") {
    resultadoCriacao = await criarHospitalar();
  } else {
    resultadoCriacao = await criarOutroTipo(tipoRegistro);
  }
  const { sfSession, browser, page, leadId } = resultadoCriacao;

  console.log(`LEAD_ID::${leadId}`);
  console.log("Preenchendo Fiscal/Financeira/Logística...");
  await completarFiscalLogisticaEConverter(page, tipoRegistro, sfSession, leadId);

  console.log('Aprovando via "Editar Lead Aprovação" + "Salvar e Aprovar"...');
  await aprovarAnaliseFiscalComEdicao(page);

  await page.waitForTimeout(3000);
  const resultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT IsConverted, ConvertedAccountId, ConvertedContactId FROM Lead WHERE Id = '${leadId}'`,
  });
  const lead = resultado.records[0];

  if (!lead.IsConverted) {
    console.error("FALHOU: o Lead não converteu (IsConverted = false). Confira o navegador pra ver o erro na tela.");
    await browser.close();
    process.exit(1);
  }

  console.log(`Conversão real confirmada — Account: ${lead.ConvertedAccountId}, Contact: ${lead.ConvertedContactId}`);

  const conta = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Name, Status_Integracao__c, Codigo_SAP__c FROM Account WHERE Id = '${lead.ConvertedAccountId}'`,
  });
  console.log(
    `Integração SAP: ${conta.records[0].Status_Integracao__c} (Código SAP: ${conta.records[0].Codigo_SAP__c || "—"})`
  );
  if (conta.records[0].Status_Integracao__c !== "Integrado com Sucesso") {
    console.log(
      'Dica: rode "node scripts/diagnosticar-integracao-sap.js ' +
        lead.ConvertedAccountId +
        '" pra ver o erro exato retornado pelo SAP.'
    );
  }

  await browser.close();
}

main().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
