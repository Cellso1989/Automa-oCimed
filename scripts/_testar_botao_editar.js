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
    console.log("Pedido:", pedidoId);
    await page.goto(`https://${sfSession.instanceHost}/lightning/r/cgcloud__Order__c/${pedidoId}/view`);
    await page.waitForTimeout(5000);

    // Filtra pra achar o produto (mesmo que ja tenha um selecionado antes)
    const busca = page.getByPlaceholder(/Pesquisar produtos nesta lista/);
    await busca.waitFor({ state: "visible", timeout: 15000 });
    await busca.fill("GINSENG");
    await page.waitForTimeout(2000);

    console.log("Clicando no botao Editar (superior)...");
    await page.getByRole("button", { name: "Editar", exact: true }).click();
    await page.waitForTimeout(3000);

    const bodyText = await page.locator("body").innerText({timeout:8000});
    const idx = bodyText.indexOf("GINSENG");
    console.log("Trecho apos Editar:", bodyText.slice(Math.max(0,idx-100), idx+400));

    // Verifica se a celula de quantidade agora tem boundingBox valido
    const cel = page.locator('[data-cursor="1_1"]').first();
    const box = await cel.boundingBox().catch(()=>null);
    console.log("boundingBox apos Editar:", JSON.stringify(box));
  } finally {
    await browser.close().catch(()=>{});
  }
}
main().catch(e => console.log("ERRO:", e.message));
