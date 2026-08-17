const { chromium } = require("@playwright/test");
const { soapLogin } = require("../support/soapLogin");
const { loginComoUsuario } = require("../support/userHelpers");
const { soqlQuery } = require("../support/soqlQuery");
const env = require("../env.json");

const CONTA_ID = "001Ha00000znDu5IAE";

async function main() {
  const sfSession = await soapLogin({
    username: env.sfUsername,
    password: env.sfPassword,
    securityToken: env.sfSecurityToken || "",
  });
  const browser = await chromium.launch({ headless: false });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await page.goto(`https://${sfSession.instanceHost}/secur/frontdoor.jsp?sid=${sfSession.sessionId}`);
    await page.goto(`https://${sfSession.instanceHost}/lightning/page/home`);
    await page.waitForURL(/\/lightning\//, { timeout: 60000 });
    await loginComoUsuario(page, sfSession, "salesrep@grupocimed.com.br.uat");
    await page.waitForTimeout(3000);

    const pedidoResultado = await soqlQuery({
      instanceHost: sfSession.instanceHost,
      sessionId: sfSession.sessionId,
      query: `SELECT Id FROM cgcloud__Order__c WHERE cgcloud__Order_Account__c = '${CONTA_ID}' ORDER BY CreatedDate DESC LIMIT 1`,
    });
    const pedidoId = pedidoResultado.records[0].Id;
    await page.goto(`https://${sfSession.instanceHost}/lightning/r/cgcloud__Order__c/${pedidoId}/view`);
    await page.waitForTimeout(5000);

    const busca = page.getByPlaceholder(/Pesquisar produtos nesta lista/);
    await busca.waitFor({ state: "visible", timeout: 15000 });
    await busca.fill("ACNEZIL GEL SECATIVO BG 10 G");
    await page.waitForTimeout(2000);

    console.log("Botoes ANTES de clicar Editar:", JSON.stringify(await page.getByRole("button").allInnerTexts()));

    await page.getByRole("button", { name: "Editar", exact: true }).click();
    await page.waitForTimeout(3000);

    console.log("Botoes DEPOIS de clicar Editar:", JSON.stringify(await page.getByRole("button").allInnerTexts()));

    const cel = page.locator('[data-cursor="1_1"]').first();
    const box = await cel.boundingBox().catch(()=>null);
    console.log("boundingBox da celula de quantidade:", JSON.stringify(box));

    if (box) {
      console.log(">>> Celula visivel! Tentando clicar e digitar...");
      await cel.click();
      await page.waitForTimeout(500);
      const htmlCelula = await cel.evaluate(el => el.outerHTML);
      console.log("HTML da celula apos click simples:", htmlCelula.slice(0,300));
    }
  } finally {
    await browser.close().catch(()=>{});
  }
}
main().catch(e => console.log("ERRO:", e.message));
