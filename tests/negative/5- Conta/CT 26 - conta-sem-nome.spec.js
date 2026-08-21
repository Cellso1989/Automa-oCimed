const { test, expect } = require("../../../support/fixtures");

// Reaproveita o fluxo de criação do CT 2 (Conta Customer), mas deixando
// "Nome da conta" (único campo obrigatório conhecido no formulário) em
// branco de propósito.
test("não cria uma Conta Customer sem preencher Nome da conta", async ({ page }) => {
  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Account/new"));
  await page.getByText("Customer", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();

  // Não preenche "Nome da conta" — só tenta salvar direto.
  await page.getByRole("button", { name: "Salvar", exact: true }).click();

  // A Conta não deve ter sido criada: a URL não deve navegar para a página
  // de detalhes de um registro novo (prefixo "001").
  await expect(page).not.toHaveURL(/\/lightning\/r\/(Account\/)?001\w+\/view/);
  // O Lightning marca o campo obrigatório vazio com o estado de erro nativo
  // do design system (slds-has-error) — sinal de bloqueio independente do
  // texto exato da mensagem exibida.
  await expect(page.locator(".slds-has-error")).not.toHaveCount(0);
});
