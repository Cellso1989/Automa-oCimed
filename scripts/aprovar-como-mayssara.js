// Script standalone (fora da suíte Playwright) pra aprovar a etapa "Análise
// Cadastral" de um Lead específico via "Login As" como a Mayssara Aparecida
// de Sousa — mesmo mecanismo usado no CT 8, mas sem precisar rodar um spec
// de teste inteiro. Uso: quando o Lead já foi criado (manualmente ou por um
// spec) e só falta a aprovação real dela.
//
// Uso:
//   node scripts/aprovar-como-mayssara.js <LeadId ou Empresa>
//
// Se o argumento parecer um Id de Lead (prefixo "00Q"), usa direto. Caso
// contrário, busca por Empresa via SOQL (precisa casar exatamente 1 Lead).
const { chromium } = require("@playwright/test");
const { soapLogin } = require("../support/soapLogin");
const { soqlQuery } = require("../support/soqlQuery");
const { aprovarComoMayssara } = require("../support/leadHelpers");
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
    console.error("Uso: node scripts/aprovar-como-mayssara.js <LeadId ou Empresa>");
    process.exit(1);
  }

  const sfSession = await soapLogin({
    username: env.sfUsername,
    password: env.sfPassword,
    securityToken: env.sfSecurityToken || "",
  });

  const leadId = await resolverLeadId(sfSession, argumento);
  console.log(`Aprovando Lead ${leadId} como Mayssara Aparecida de Sousa...`);

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(`https://${sfSession.instanceHost}/secur/frontdoor.jsp?sid=${sfSession.sessionId}`);
  await page.goto(`https://${sfSession.instanceHost}/lightning/page/home`);
  await page.waitForURL(/\/lightning\//, { timeout: 60000 });

  await aprovarComoMayssara(page, sfSession, leadId);

  console.log("Aprovação processada. Verifique o Lead no navegador antes de fechar.");
  await browser.close();
}

main().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
