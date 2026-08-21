const { test, expect } = require("../../../support/fixtures");

// Reaproveita o fluxo de criação do CT 13 (Pedido Hospitalar), mas deixando
// "Nome da conta" (obrigatório) em branco de propósito.
test("não cria um Pedido sem selecionar Nome da conta", async ({ page }) => {
  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Order/list?filterName=__Recent"));
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Novo" }).click();
  await page.getByText("Hospitalar", { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText("Hospitalar", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();

  // "Nome da conta" fica em branco de propósito.
  await page.getByRole("combobox", { name: "Status", exact: true }).click();
  await page.getByRole("option", { name: "Aberto" }).click();

  const hoje = new Date();
  const dataFormatada = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
  await page.getByRole("textbox", { name: "Data de início do pedido" }).fill(dataFormatada);
  await page.getByRole("heading", { name: "Novo Pedido: Hospitalar" }).click();
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(2000);

  await expect(page).not.toHaveURL(/\/lightning\/r\/(Order\/)?801\w+\/view/);
  await expect(page.locator(".slds-has-error")).not.toHaveCount(0);
});
