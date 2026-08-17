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

    const busca = page.getByPlaceholder(/Pesquisar produtos nesta lista/);
    await busca.waitFor({ state: "visible", timeout: 15000 });
    await page.locator('[data-cursor="1_0"]').click();
    await page.waitForTimeout(1500);

    await page.getByRole("button", { name: "Adicionar item" }).click();
    await page.getByText("Lista de produtos", { exact: false }).first().waitFor({ state: "visible", timeout: 30000 });
    await page.waitForTimeout(3000);

    const comboModelo = page.getByRole("combobox", { name: /Modelo do item do pedido/i });
    await comboModelo.click();
    await page.waitForTimeout(1000);
    await page.getByRole("option", { name: "Itens gratuitos", exact: true }).click();
    await page.waitForTimeout(3000);

    const totalRows = await page.getByRole("row").count();
    console.log("Rows com Itens gratuitos:", totalRows);

    const linhaProduto = page.getByRole("row").nth(1);
    const nomeProduto = (await linhaProduto.innerText()).replace(/\s+/g, " ").trim();
    console.log("Produto escolhido:", nomeProduto);
    await linhaProduto.getByRole("checkbox").click({ force: true, timeout: 15000 });
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Adicionar", exact: true }).click();
    await page.waitForTimeout(3000);

    await page.getByText("Cesta", { exact: true }).first().click({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Tenta editar quantidade
    const cel = page.locator('[data-cursor="1_1"]').first();
    const box = await cel.boundingBox().catch(() => null);
    console.log("boundingBox da celula de quantidade:", JSON.stringify(box));
    if (box) {
      await cel.dblclick();
      await page.waitForTimeout(500);
      await page.keyboard.type("10", { delay: 100 });
      await page.waitForTimeout(500);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(1000);
    }

    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page.waitForTimeout(5000);

    const itemResultado = await soqlQuery({
      instanceHost: sfSession.instanceHost,
      sessionId: sfSession.sessionId,
      query: `SELECT Id, cgcloud__Quantity__c, cgcloud__Base_Price__c, cgcloud__Value__c FROM cgcloud__Order_Item__c WHERE cgcloud__Order__c = '${pedidoId}'`,
    });
    console.log("ITENS PERSISTIDOS:", JSON.stringify(itemResultado.records, null, 2));
  } finally {
    await browser.close().catch(()=>{});
  }
}
main().catch(e => console.log("ERRO:", e.message));
