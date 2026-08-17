const { chromium } = require("@playwright/test");
const { soapLogin } = require("../support/soapLogin");
const { loginComoUsuario } = require("../support/userHelpers");
const { soqlQuery } = require("../support/soqlQuery");
const env = require("../env.json");

const CONTA_ID = "001Ha00000znDu5IAE"; // CG CLOUD TESTE 85793198

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

    await page.goto(`https://${sfSession.instanceHost}/lightning/r/Account/${CONTA_ID}/view`);
    await page.waitForTimeout(4000);

    await page.getByRole("button", { name: "Criar nova visita" }).click();
    await page.waitForTimeout(2000);
    const modeloVisita = page.getByPlaceholder(/Pesquisar Modelos de visita/);
    await modeloVisita.click();
    await modeloVisita.fill("Tirada de pedido");
    await page.waitForTimeout(2000);
    await page.getByText("Tirada de pedido", { exact: false }).last().click();
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page.waitForTimeout(4000);
    console.log("Visita criada");

    const visitaResultado = await soqlQuery({
      instanceHost: sfSession.instanceHost,
      sessionId: sfSession.sessionId,
      query: `SELECT Id FROM Visit WHERE AccountId = '${CONTA_ID}' ORDER BY CreatedDate DESC LIMIT 1`,
    });
    const visitaId = visitaResultado.records[0].Id;
    await page.goto(`https://${sfSession.instanceHost}/lightning/r/Visit/${visitaId}/view`);
    await page.waitForTimeout(3000);

    await page.getByRole("button", { name: "Criar Pedido", exact: true }).click();
    await page.waitForTimeout(3000);
    await page.getByText("Selecione uma opção...").click();
    await page.waitForTimeout(1000);
    await page.getByText("CD: SP 3000").click();
    await page.waitForTimeout(1000);
    await page.getByRole("button", { name: "Criar", exact: true }).click();
    await page.waitForTimeout(6000);
    const pedidoId = page.url().match(/cgcloud__Order__c\/(\w+)\/view/)?.[1];
    console.log("PEDIDO:", pedidoId, "URL:", page.url());
    if (!pedidoId) { console.log("ABORTANDO: pedido nao criado."); return; }

    // Filtra especificamente pelo mesmo produto do pedido que deu certo
    const busca = page.getByPlaceholder(/Pesquisar produtos nesta lista/);
    await busca.waitFor({ state: "visible", timeout: 15000 });
    await busca.fill("ACNEZIL GEL SECATIVO BG 10 G");
    await page.waitForTimeout(2500);
    await page.locator('[data-cursor="1_0"]').click();
    await page.waitForTimeout(1500);

    // Tenta abrir o modal ate 3 vezes, esperando mais entre tentativas
    let sucesso = false;
    for (let tentativa = 1; tentativa <= 3 && !sucesso; tentativa++) {
      console.log(`--- Tentativa ${tentativa} de abrir modal com produtos ---`);
      await page.getByRole("button", { name: "Adicionar item" }).click();
      await page.getByText("Lista de produtos", { exact: false }).first().waitFor({ state: "visible", timeout: 30000 });
      await page.waitForTimeout(5000);

      const totalRows = await page.getByRole("row").count();
      console.log(`Tentativa ${tentativa}: total de rows no modal =`, totalRows);

      if (totalRows > 1) {
        sucesso = true;
        const linhaProduto = page.getByRole("row").nth(1);
        const nomeProduto = (await linhaProduto.innerText()).replace(/\s+/g, " ").trim();
        console.log("Produto encontrado:", nomeProduto);
        await linhaProduto.getByRole("checkbox").click({ force: true, timeout: 15000 });
        await page.waitForTimeout(1000);
        await page.getByRole("button", { name: "Adicionar", exact: true }).click();
        await page.waitForTimeout(3000);
      } else {
        // Fecha o modal e tenta de novo
        await page.getByRole("button", { name: "Cancelar", exact: true }).click().catch(()=>{});
        await page.waitForTimeout(3000);
      }
    }

    if (!sucesso) {
      console.log("FALHOU apos 3 tentativas: modal continua vazio.");
      return;
    }

    await page.getByText("Cesta", { exact: true }).first().click({ timeout: 15000 });
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await page.waitForTimeout(4000);
    console.log("Salvou. Verificando itens gravados...");

    const itemResultado = await soqlQuery({
      instanceHost: sfSession.instanceHost,
      sessionId: sfSession.sessionId,
      query: `SELECT Id, cgcloud__Quantity__c, cgcloud__Base_Price__c, cgcloud__Value__c FROM cgcloud__Order_Item__c WHERE cgcloud__Order__c = '${pedidoId}'`,
    });
    console.log("ITENS PERSISTIDOS:", JSON.stringify(itemResultado.records, null, 2));

    if (itemResultado.totalSize > 0) {
      await page.getByRole("button", { name: "Submeter Pedido", exact: true }).click();
      await page.waitForTimeout(4000);
      console.log("Pedido submetido.");
    }
  } finally {
    await browser.close().catch(()=>{});
  }
}
main().catch(e => console.log("ERRO:", e.message));
