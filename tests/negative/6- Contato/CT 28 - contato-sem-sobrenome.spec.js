const { test, expect } = require("../../../support/fixtures");

// Reaproveita o fluxo de criação do CT 3 (Contato vinculado a Conta), mas
// deixando "Sobrenome" (único campo obrigatório conhecido no formulário) em
// branco de propósito.
test("não cria um Contato sem preencher Sobrenome", async ({ page }) => {
  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Contact/new"));

  // Sobrenome fica em branco de propósito — tenta salvar direto.
  await page.getByRole("button", { name: "Salvar", exact: true }).click();

  await expect(page).not.toHaveURL(/\/lightning\/r\/(Contact\/)?003\w+\/view/);
  await expect(page.locator(".slds-has-error")).not.toHaveCount(0);
});
