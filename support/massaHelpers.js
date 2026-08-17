// Garante que existe massa disponível pra um spec de aprovação rodar sem
// depender de OUTRO spec ter rodado antes na mesma suíte (CT 8 pra Cimed
// Tech) nem de alguém ter rodado scripts/gerar-massa-para-suite.js
// manualmente antes (Milimetric/CG Cloud). Testes devem ser independentes
// (CLAUDE.md item 18) — cada CT de aprovação passa a garantir sua própria
// pré-condição em vez de confiar em massa deixada por terceiros.
const { soqlQuery } = require("./soqlQuery");

// Hospitalar fica de fora de propósito: já investigado que gerar massa não
// resolve (bloqueio de layout no Setup do Salesforce, não de dado faltando)
// — ver README.md / [[project_lead_conversao_real]].
async function garantirMassaEmAnaliseFiscal(sfSession, tipoRegistro) {
  const resultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id FROM Lead WHERE Status = 'Análise Fiscal' AND RecordType.Name = '${tipoRegistro}' LIMIT 1`,
  });
  if (resultado.totalSize > 0) return; // já tem massa disponível — nada a fazer

  console.log(`Nenhum Lead "${tipoRegistro}" em Análise Fiscal — gerando massa fresca antes de continuar...`);

  if (tipoRegistro === "CG Cloud") {
    const { criarEAprovarCadastral } = require("../scripts/criar-massa-cg-cloud");
    const { browser } = await criarEAprovarCadastral({ headless: false });
    await browser.close();
  } else {
    const { criarEAprovarCadastral } = require("../scripts/criar-massa-lead");
    const { browser } = await criarEAprovarCadastral(tipoRegistro, { headless: false });
    await browser.close();
  }

  console.log(`Massa "${tipoRegistro}" gerada com sucesso.`);
}

module.exports = { garantirMassaEmAnaliseFiscal };
