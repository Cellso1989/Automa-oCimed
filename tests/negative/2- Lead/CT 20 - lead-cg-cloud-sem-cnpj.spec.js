const { test, expect } = require("../../../support/fixtures");

// Reaproveita o fluxo de criação do CT 7 (Lead CG Cloud), mas deixando o
// CNPJ (obrigatório na etapa inicial do wizard CNPJ-primeiro) em branco.
test("não avança o wizard de Lead CG Cloud sem preencher CNPJ", async ({ page }) => {
  await page.getByText("Leads", { exact: true }).click();
  await page.getByRole("button", { name: "Criar" }).click();
  await page.waitForTimeout(2000);
  await page.getByText("CG Cloud", { exact: true }).click({ force: true });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(1500);

  // CNPJ fica em branco de propósito — o botão "Avançar" já nasce
  // desabilitado enquanto o campo obrigatório não é preenchido (confirmado
  // rodando este teste: 100+ tentativas de clique falharam porque o botão
  // nunca fica "enabled" sem CNPJ).
  await expect(page.getByRole("button", { name: "Avançar" })).toBeDisabled();
  await expect(page.getByRole("textbox", { name: "CNPJ" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Sobrenome" })).not.toBeVisible();
});
