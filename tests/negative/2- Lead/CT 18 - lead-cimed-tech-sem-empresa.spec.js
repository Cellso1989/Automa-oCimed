const { test, expect } = require("../../../support/fixtures");

// Reaproveita o fluxo de criação do CT 4 (Lead Cimed Tech), mas deixando o
// campo obrigatório "Empresa" em branco de propósito.
test("não cria um Lead Cimed Tech sem preencher Empresa", async ({ page }) => {
  const sobrenome = `Sobrenome Cimed Tech ${Date.now()}`;

  await page.getByText("Leads", { exact: true }).click();
  await page.getByRole("button", { name: "Criar" }).click();
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByRole("textbox", { name: "Sobrenome" }).fill(sobrenome);
  // Empresa fica em branco de propósito.
  await page.getByRole("button", { name: "Salvar", exact: true }).click();

  await expect(page).not.toHaveURL(/\/lightning\/r\/(Lead\/)?00Q\w+\/view/);
  await expect(page.locator(".slds-has-error")).not.toHaveCount(0);
});
