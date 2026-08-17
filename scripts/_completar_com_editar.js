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
    await busca.fill("ACNEZIL GEL SECATIVO BG 10 G");
    await page.waitForTimeout(2000);

    await page.getByRole("button", { name: "Editar", exact: true }).click();
    await page.waitForTimeout(3000);

    const cel = page.locator('[data-cursor="1_1"]').first();
    await cel.click();
    await page.waitForTimeout(800);

    // Procura um input real dentro da celula agora em modo "is-editing"
    const inputInterno = cel.locator("input");
    const totalInputs = await inputInterno.count();
    console.log("Inputs dentro da celula apos click:", totalInputs);

    if (totalInputs > 0) {
      await inputInterno.first().fill("15");
      await page.waitForTimeout(500);
      const valorAtual = await inputInterno.first().inputValue().catch(()=>"erro");
      console.log("Valor do input apos fill:", valorAtual);
    } else {
      // Tenta digitar diretamente
      await page.keyboard.type("15", {delay:100});
      await page.waitForTimeout(500);
    }

    await page.keyboard.press("Tab");
    await page.waitForTimeout(1000);

    const textoCelula = await cel.innerText().catch(()=>"erro");
    console.log("Texto da celula apos digitar:", textoCelula);

    // Clica no botao Salvar (do modo edicao)
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page.waitForTimeout(4000);
    console.log("Salvou.");

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
