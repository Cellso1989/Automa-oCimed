const { test, expect } = require("../../../support/fixtures");

// Reaproveita o fluxo de criação do CT 3 (Contato vinculado a Conta),
// preenchendo "Sobrenome" só com espaços em branco.
test("não cria um Contato com Sobrenome preenchido só com espaços", async ({ page }) => {
  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Contact/new"));

  await page.getByRole("textbox", { name: "Sobrenome" }).fill("   ");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();

  await expect(page).not.toHaveURL(/\/lightning\/r\/(Contact\/)?003\w+\/view/);
});
