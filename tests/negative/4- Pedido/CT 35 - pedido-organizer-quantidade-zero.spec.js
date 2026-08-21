const { test, expect } = require("../../../support/fixtures");
const { loginComoUsuario } = require("../../../support/userHelpers");
const { soqlQuery } = require("../../../support/soqlQuery");

// Reaproveita o fluxo do CT 14 (Pedido a partir de uma Visita, no Organizer,
// como Sales Rep — tests/4- Pedido/CT 14 - criar-pedido-via-visita-
// organizer.spec.js), mas tentando definir a quantidade do item como "0" em
// vez de um valor válido.
test.use({ screenshot: "on" });

const CONTA_CG_CLOUD = "CG CLOUD TESTE 85793198";
const USUARIO_SALES_REP = "salesrep@grupocimed.com.br.uat";
const PRODUTO = "ACNEZIL GEL SECATIVO BG 10 G";

test("bloqueia quantidade zero num item de Pedido no Organizer", async ({ page, sfSession }) => {
  test.setTimeout(180000);

  await loginComoUsuario(page, sfSession, USUARIO_SALES_REP);

  await page.goto(`https://${sfSession.instanceHost}/lightning/o/Account/list?filterName=__Recent`);
  await page.waitForTimeout(3000);
  await page.getByRole("link", { name: CONTA_CG_CLOUD }).click();
  await page.waitForTimeout(3000);
  await expect(page).toHaveURL(/\/lightning\/r\/(Account\/)?001\w+\/view/, { timeout: 30000 });
  const contaId = page.url().match(/\/r\/(?:Account\/)?(001\w+)\/view/)[1];

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

  const visitaResultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id FROM Visit WHERE AccountId = '${contaId}' ORDER BY CreatedDate DESC LIMIT 1`,
  });
  const visitaId = visitaResultado.records[0].Id;
  await page.goto(`https://${sfSession.instanceHost}/lightning/r/Visit/${visitaId}/view`);
  await page.waitForTimeout(3000);
  await expect(page).toHaveURL(/\/lightning\/r\/Visit\/\w+\/view/, { timeout: 30000 });

  await page.getByRole("button", { name: "Criar Pedido", exact: true }).click();
  await page.waitForTimeout(3000);
  const centroDistribuicao = page.getByText("Selecione uma opção...");
  await centroDistribuicao.click();
  await page.waitForTimeout(1000);
  await page.getByText("CD: SP 3000").click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Criar", exact: true }).click();
  await page.waitForTimeout(6000);
  await expect(page).toHaveURL(/\/lightning\/r\/cgcloud__Order__c\/\w+\/view/, { timeout: 30000 });
  const pedidoId = page.url().match(/cgcloud__Order__c\/(\w+)\/view/)[1];

  const busca = page.getByPlaceholder(/Pesquisar produtos nesta lista/);
  await busca.waitFor({ state: "visible", timeout: 15000 });
  await busca.fill(PRODUTO);
  await page.waitForTimeout(2500);

  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.waitForTimeout(3000);

  const celulaQuantidade = page.locator('[data-cursor="1_1"]').first();
  await celulaQuantidade.click();
  await page.waitForTimeout(800);
  // Quantidade "0" (inválida) em vez de um valor real — diferente do CT 14.
  await celulaQuantidade.locator("input").first().fill("0");
  await page.waitForTimeout(500);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(4000);

  // O item não deve persistir com quantidade zero — ou o "Salvar" bloqueia a
  // edição (nenhum item criado), ou o produto não aparece nos itens do
  // Pedido com essa quantidade.
  const itemResultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id, cgcloud__Quantity__c FROM cgcloud__Order_Item__c WHERE cgcloud__Order__c = '${pedidoId}'`,
  });
  const itemComQuantidadeZero = itemResultado.records.some((r) => r.cgcloud__Quantity__c === 0);
  expect(itemComQuantidadeZero).toBe(false);
});
