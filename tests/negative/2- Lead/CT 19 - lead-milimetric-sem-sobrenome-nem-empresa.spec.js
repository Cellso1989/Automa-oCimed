const { test, expect } = require("../../../support/fixtures");

// Reaproveita o fluxo de criação do CT 5 (Lead Milimetric), mas deixando
// Sobrenome e Empresa (ambos obrigatórios) em branco de propósito.
test("não cria um Lead Milimetric sem preencher Sobrenome nem Empresa", async ({ page }) => {
  await page.getByText("Leads", { exact: true }).click();
  await page.getByRole("button", { name: "Criar" }).click();
  await page.waitForTimeout(1500);
  await page.getByText("Milimetric", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();
  // Sobrenome e Empresa ficam em branco de propósito.
  await page.getByRole("button", { name: "Salvar", exact: true }).click();

  await expect(page).not.toHaveURL(/\/lightning\/r\/(Lead\/)?00Q\w+\/view/);
  await expect(page.locator(".slds-has-error")).not.toHaveCount(0);
});
