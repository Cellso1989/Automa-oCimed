const { test, expect } = require("../../../support/fixtures");

// Reaproveita o fluxo de criação do CT 4 (Lead Cimed Tech), mas deixando o
// campo obrigatório "Sobrenome" em branco de propósito.
test("não cria um Lead Cimed Tech sem preencher Sobrenome", async ({ page }) => {
  const empresa = `Empresa Teste Cimed Tech ${Date.now()}`;

  await page.getByText("Leads", { exact: true }).click();
  await page.getByRole("button", { name: "Criar" }).click();
  await page.getByRole("button", { name: "Avançar" }).click();
  // Sobrenome fica em branco de propósito.
  await page.getByRole("textbox", { name: "Empresa", exact: true }).fill(empresa);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();

  await expect(page).not.toHaveURL(/\/lightning\/r\/(Lead\/)?00Q\w+\/view/);
  await expect(page.locator(".slds-has-error")).not.toHaveCount(0);
});
