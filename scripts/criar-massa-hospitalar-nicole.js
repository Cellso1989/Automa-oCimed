// Cria um Lead Hospitalar do zero (como Nicole Gomes Amaral, único jeito
// confirmado de preencher campos como "Forma de Contato Padrão" — ver
// [[project_lead_hospitalar_nicole]] na memória do projeto), avança até
// "Análise Cadastral" e depois, como Mayssara Aparecida de Sousa, avança até
// "Análise Fiscal" — deixando massa pronta pro CT 12 continuar (completar
// Fiscal/Financeira/Logística + aprovar de verdade).
//
// Substitui `criar-massa-lead.js` pra esse tipo, que não suporta o fluxo
// CNPJ-primeiro nem o layout específico da Nicole (trava esperando
// "Sobrenome" simples, que só existe nos fluxos de Cimed Tech/Milimetric).
//
// Uso: node scripts/criar-massa-hospitalar-nicole.js
const { chromium } = require("@playwright/test");
const { soapLogin } = require("../support/soapLogin");
const {
  criarLeadHospitalarComoNicoleAteAnaliseCadastral,
  avancarAnaliseFiscalHospitalarComoMayssara,
} = require("../support/leadHelpers");
const env = require("../env.json");

// Não fecha o browser (quem chamou decide) — mesmo padrão de
// criar-massa-lead.js/criar-massa-cg-cloud.js, reaproveitado por
// support/massaHelpers.js (`garantirMassaEmAnaliseFiscal`).
async function criarEAprovarCadastral({ headless = false } = {}) {
  const sfSession = await soapLogin({
    username: env.sfUsername,
    password: env.sfPassword,
    securityToken: env.sfSecurityToken || "",
  });
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`https://${sfSession.instanceHost}/secur/frontdoor.jsp?sid=${sfSession.sessionId}`);
  await page.goto(`https://${sfSession.instanceHost}/lightning/page/home`);
  await page.waitForURL(/\/lightning\//, { timeout: 60000 });

  const leadId = await criarLeadHospitalarComoNicoleAteAnaliseCadastral(page, sfSession);
  console.log("LEAD_ID::" + leadId);
  console.log("Lead Hospitalar criado e em Análise Cadastral — avançando como Mayssara...");

  await avancarAnaliseFiscalHospitalarComoMayssara(page, sfSession, leadId);
  console.log("Lead Hospitalar avançado por Mayssara — deve estar em Análise Fiscal");

  return { sfSession, browser, page, leadId };
}

async function main() {
  const { browser } = await criarEAprovarCadastral({ headless: !!process.env.CI });
  await browser.close();
}

module.exports = { criarEAprovarCadastral };

if (require.main === module) {
  main();
}
