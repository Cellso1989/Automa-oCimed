const { test, expect } = require("../../../support/fixtures");
const { selectLookupOption } = require("../../../support/lookup");

// Regra de negócio documentada no CT 13: "Código SAP e Tipo de documento de
// venda são exigidos por uma regra de validação do Pedido (a conta
// relacionada precisa ter os dois preenchidos), mesmo não sendo obrigatórios
// no formulário da própria Conta." — cria a Conta SEM esses dois campos
// (diferente do CT 13, que os preenche) e tenta criar um Pedido vinculado a
// ela.
test("bloqueia a criação de Pedido vinculado a uma Conta sem Código SAP e Tipo de documento de venda", async ({ page }) => {
  test.setTimeout(90000);
  const nomeConta = `Conta Sem SAP Teste ${Date.now()}`;

  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Account/new"));
  await page.getByText("Customer", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByLabel("Nome da conta").fill(nomeConta);
  // "Código SAP" e "Tipo de documento de venda" ficam em branco de
  // propósito — diferente do fluxo positivo do CT 13.
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page).toHaveURL(/\/lightning\/r\/(Account\/)?001\w+\/view/, { timeout: 30000 });

  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Order/list?filterName=__Recent"));
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Novo" }).click();
  await page.getByText("Hospitalar", { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText("Hospitalar", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();

  await selectLookupOption(page, "Nome da conta", nomeConta);

  await page.getByRole("combobox", { name: "Status", exact: true }).click();
  await page.getByRole("option", { name: "Aberto" }).click();

  const hoje = new Date();
  const dataFormatada = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
  await page.getByRole("textbox", { name: "Data de início do pedido" }).fill(dataFormatada);
  await page.getByRole("heading", { name: "Novo Pedido: Hospitalar" }).click();
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(3000);

  // O Pedido não deve ter sido criado — a regra de validação da Conta
  // relacionada (Código SAP / Tipo de documento de venda vazios) deve
  // bloquear o "Salvar".
  await expect(page).not.toHaveURL(/\/lightning\/r\/(Order\/)?801\w+\/view/);
});
