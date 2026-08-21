const { test, expect } = require("../../../support/fixtures");

// Reaproveita o fluxo de criação do CT 3 (Contato vinculado a Conta), mas
// deixando o lookup "Nome da conta" vazio de propósito.
//
// DESCOBERTA (rodando este teste): diferente do padrão do Salesforce
// (Contact.AccountId normalmente é opcional), esta org bloqueia a criação
// do Contato sem uma Conta vinculada — o "Salvar" não navega pra página do
// registro novo, fica preso em "/lightning/o/Contact/new". "Nome da conta"
// é, portanto, um campo obrigatório de fato aqui, não só uma convenção do
// fluxo positivo.
test("não cria um Contato sem vincular a uma Conta", async ({ page }) => {
  const sobrenome = `Sobrenome Sem Conta ${Date.now()}`;

  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Contact/new"));
  await page.getByRole("textbox", { name: "Sobrenome" }).fill(sobrenome);
  // "Nome da conta" fica vazio de propósito.
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(2000);

  await expect(page).not.toHaveURL(/\/lightning\/r\/(Contact\/)?003\w+\/view/);
});
