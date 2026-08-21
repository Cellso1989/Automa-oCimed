const { test, expect } = require("../../../support/fixtures");

// Reaproveita o fluxo de criação do CT 2 (Conta Customer), preenchendo
// "Nome da conta" só com espaços em branco.
test("não cria uma Conta Customer com Nome da conta preenchido só com espaços", async ({ page }) => {
  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Account/new"));
  await page.getByText("Customer", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();

  await page.getByLabel("Nome da conta").fill("   ");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();

  await expect(page).not.toHaveURL(/\/lightning\/r\/(Account\/)?001\w+\/view/);
});
