const { test, expect } = require("../../../support/fixtures");
const { selectLookupOption } = require("../../../support/lookup");

// Reaproveita o fluxo de criação do CT 13 (Pedido Hospitalar), mas deixando
// "Status" (preenchido no fluxo positivo) sem selecionar.
test("não cria um Pedido sem selecionar Status", async ({ page }) => {
  const nomeConta = `Conta Teste Pedido Sem Status ${Date.now()}`;

  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Account/new"));
  await page.getByText("Customer", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByLabel("Nome da conta").fill(nomeConta);
  await page.getByLabel("Código SAP").fill(`S${Date.now().toString().slice(-8)}`);
  await page.getByRole("combobox", { name: "Tipo de documento de venda" }).click();
  await page.getByRole("option", { name: "ZNOR" }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page).toHaveURL(/\/lightning\/r\/(Account\/)?001\w+\/view/, { timeout: 30000 });

  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Order/list?filterName=__Recent"));
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Novo" }).click();
  await page.getByText("Hospitalar", { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText("Hospitalar", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();

  await selectLookupOption(page, "Nome da conta", nomeConta);

  // "Status" fica sem selecionar de propósito.
  const hoje = new Date();
  const dataFormatada = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
  await page.getByRole("textbox", { name: "Data de início do pedido" }).fill(dataFormatada);
  await page.getByRole("heading", { name: "Novo Pedido: Hospitalar" }).click();
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(2000);

  await expect(page).not.toHaveURL(/\/lightning\/r\/(Order\/)?801\w+\/view/);
});
