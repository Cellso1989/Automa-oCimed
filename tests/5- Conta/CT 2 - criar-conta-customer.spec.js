const { test, expect } = require("../../support/fixtures");

test("cria uma nova conta do tipo Customer", async ({ page }) => {
  const nomeConta = `Conta Teste Playwright ${Date.now()}`;

  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Account/new"));

  // O modal "Nova Conta" pede primeiro o tipo de registro (Record Type) —
  // "Customer" é exibido em português como "Cliente" no formulário seguinte.
  await page.getByText("Customer", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();

  await page.getByLabel("Nome da conta").fill(nomeConta);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();

  // Depois de salvar, o Salesforce navega para a página de detalhes do
  // registro criado e exibe o nome digitado como título da página. A URL às
  // vezes inclui o nome do objeto ("Account") no caminho, às vezes só o ID
  // com o prefixo "001" (varia conforme o contexto de navegação da SPA).
  await expect(page).toHaveURL(/\/lightning\/r\/(Account\/)?001\w+\/view/, { timeout: 30000 });
  await expect(page.getByRole("heading", { name: nomeConta })).toBeVisible({ timeout: 15000 });
});
