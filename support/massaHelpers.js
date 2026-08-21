// Garante que existe massa disponível pra um spec de aprovação rodar sem
// depender de OUTRO spec ter rodado antes na mesma suíte (CT 8 pra Cimed
// Tech) nem de alguém ter rodado scripts/gerar-massa-para-suite.js
// manualmente antes (Milimetric/CG Cloud). Testes devem ser independentes
// (CLAUDE.md item 18) — cada CT de aprovação passa a garantir sua própria
// pré-condição em vez de confiar em massa deixada por terceiros.
const { soqlQuery } = require("./soqlQuery");

// Hospitalar precisa ser criado pela usuária Nicole Gomes Amaral (Profile
// "Faturamento" — a única com layout que expõe "Forma de Contato Padrão")
// e avançado por Mayssara Aparecida de Sousa — ver
// scripts/criar-massa-hospitalar-nicole.js e [[project_lead_hospitalar_nicole]]
// na memória do projeto. A suposição antiga de que gerar massa não resolve
// (bloqueio de layout, ver README.md / [[project_lead_conversao_real]])
// estava incompleta: era bloqueio de PROFILE, não de Setup.
async function garantirMassaEmAnaliseFiscal(sfSession, tipoRegistro) {
  // IsConverted = false é essencial pro Hospitalar — o Status (customizado)
  // pode continuar em "Análise Fiscal" mesmo depois do Lead já ter
  // convertido de verdade (ver [[project_lead_hospitalar_nicole]]). Sem esse
  // filtro, essa checagem pode achar um Lead já convertido e concluir
  // (errado) que já existe massa disponível.
  const resultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id FROM Lead WHERE Status = 'Análise Fiscal' AND RecordType.Name = '${tipoRegistro}' AND IsConverted = false LIMIT 1`,
  });
  if (resultado.totalSize > 0) return; // já tem massa disponível — nada a fazer

  console.log(`Nenhum Lead "${tipoRegistro}" em Análise Fiscal — gerando massa fresca antes de continuar...`);

  // headless:false só funciona com um X Server disponível (máquina local).
  // No runner do GitHub Actions não há display — CI define process.env.CI,
  // então usamos isso pra decidir, headless em CI e visível localmente.
  const headless = !!process.env.CI;

  if (tipoRegistro === "CG Cloud") {
    const { criarEAprovarCadastral } = require("../scripts/criar-massa-cg-cloud");
    const { browser } = await criarEAprovarCadastral({ headless });
    await browser.close();
  } else if (tipoRegistro === "Hospitalar") {
    const { criarEAprovarCadastral } = require("../scripts/criar-massa-hospitalar-nicole");
    const { browser } = await criarEAprovarCadastral({ headless });
    await browser.close();
  } else {
    const { criarEAprovarCadastral } = require("../scripts/criar-massa-lead");
    const { browser } = await criarEAprovarCadastral(tipoRegistro, { headless });
    await browser.close();
  }

  console.log(`Massa "${tipoRegistro}" gerada com sucesso.`);
}

module.exports = { garantirMassaEmAnaliseFiscal };
