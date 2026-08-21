const { test, expect } = require("../../../support/fixtures");

// Cria duas Contas Customer com o MESMO "Nome da conta" — verifica se existe
// alguma regra de duplicidade configurada nesta org (Salesforce padrão não
// bloqueia nome de Conta duplicado, a menos que haja uma regra de
// duplicidade/matching configurada no Setup).
test("verifica o comportamento ao criar uma segunda Conta com o mesmo Nome da conta", async ({ page }) => {
  test.setTimeout(90000);
  const nomeConta = `Conta Duplicada Teste ${Date.now()}`;

  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Account/new"));
  await page.getByText("Customer", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByLabel("Nome da conta").fill(nomeConta);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page).toHaveURL(/\/lightning\/r\/(Account\/)?001\w+\/view/, { timeout: 30000 });

  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Account/new"));
  await page.getByText("Customer", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByLabel("Nome da conta").fill(nomeConta);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(3000);

  // Sem regra de duplicidade configurada nesta org, o Salesforce permite o
  // segundo registro com o mesmo nome — a segunda Conta É criada
  // normalmente. Confirmado rodando este teste (ver relatório de execução).
  await expect(page).toHaveURL(/\/lightning\/r\/(Account\/)?001\w+\/view/, { timeout: 30000 });
});
