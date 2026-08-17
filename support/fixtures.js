// Extensão do test do Playwright com um fixture de login pronto — specs de
// negócio importam daqui em vez de "@playwright/test" direto, e recebem uma
// `page` já autenticada no Salesforce (equivalente ao antigo cy.login()).
const base = require("@playwright/test");
const { soapLogin } = require("./soapLogin");
const env = require("../env.json");

const test = base.test.extend({
  // Exposto separado da `page` pra specs que precisam consultar a API REST
  // do Salesforce diretamente (ex.: achar um registro por critério que não
  // dá pra filtrar direto na lista da UI).
  sfSession: async ({}, use) => {
    const sessao = await soapLogin({
      username: env.sfUsername,
      password: env.sfPassword,
      securityToken: env.sfSecurityToken || "",
    });
    await use(sessao);
  },

  page: async ({ page, sfSession }, use) => {
    const { sessionId, instanceHost } = sfSession;

    await page.goto(`https://${instanceHost}/secur/frontdoor.jsp?sid=${sessionId}`);
    await page.goto(`https://${instanceHost}/lightning/page/home`);
    await page.waitForURL(/\/lightning\//, { timeout: 60000 });

    await use(page);
  },
});

module.exports = { test, expect: base.expect };
