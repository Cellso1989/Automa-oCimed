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

    await page.getByRole("button", { name: "Editar", exact: true }).click();
    await page.waitForTimeout(3000);

    const dialogCount = await page.getByRole("dialog").count();
    console.log("Dialogs abertos:", dialogCount);
    if (dialogCount > 0) {
      const dialogTexto = await page.getByRole("dialog").first().innerText({timeout:5000}).catch(e=>"erro:"+e.message);
      console.log("Texto do dialog:", dialogTexto.slice(0,1000));
    }

    // Lista comboboxes/textboxes visiveis agora
    const combos = await page.getByRole("combobox").allInnerTexts().catch(()=>[]);
    console.log("Comboboxes visiveis:", JSON.stringify(combos));
  } finally {
    await browser.close().catch(()=>{});
  }
}
main().catch(e => console.log("ERRO:", e.message));
