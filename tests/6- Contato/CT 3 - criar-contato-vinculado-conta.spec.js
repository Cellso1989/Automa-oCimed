const { test, expect } = require("../../support/fixtures");
const { selectLookupOption } = require("../../support/lookup");

test("cria um Contato vinculado a uma Conta", async ({ page }) => {
  const nomeConta = `Conta Teste Contato ${Date.now()}`;
  const sobrenome = `Sobrenome Teste ${Date.now()}`;

  // Cria a conta que o contato vai referenciar, pra este teste não depender
  // de nenhum dado criado por outro spec.
  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Account/new"));
  await page.getByText("Customer", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByLabel("Nome da conta").fill(nomeConta);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page).toHaveURL(/\/lightning\/r\/(Account\/)?001\w+\/view/, { timeout: 30000 });

  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Contact/new"));

  await page.getByRole("textbox", { name: "Sobrenome" }).fill(sobrenome);
  await selectLookupOption(page, "Nome da conta", nomeConta);

  await page.getByRole("button", { name: "Salvar", exact: true }).click();

  // Prefixo "003" identifica registros de Contato (Contact).
  await expect(page).toHaveURL(/\/lightning\/r\/(Contact\/)?003\w+\/view/, { timeout: 30000 });
  await expect(page.getByRole("heading", { name: sobrenome })).toBeVisible({ timeout: 15000 });
});
