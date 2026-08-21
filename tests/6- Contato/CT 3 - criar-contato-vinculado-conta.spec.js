const { test, expect } = require("../../support/fixtures");
const { selectLookupOption } = require("../../support/lookup");

test("cria um Contato vinculado a uma Conta", async ({ page }) => {
  // O timeout padrão de 60s do projeto não sobra margem suficiente pro
  // retry de `selectLookupOption` (até 6 tentativas de ~8s cada, esperando a
  // Conta recém-criada ficar pesquisável) somado ao resto do fluxo — sem
  // isso, o teste estourava o timeout global e o Playwright derrubava o
  // browser no meio da execução (visto na 1ª execução real após trocar a
  // espera fixa de 10s pelo retry).
  test.setTimeout(120000);
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
  // O lookup "Nome da conta" do Contato busca no índice de pesquisa do
  // Salesforce, que não é atualizado em tempo real — uma Conta recém-criada
  // pode levar alguns segundos pra ficar pesquisável (reproduzido de forma
  // consistente local e no CI, não é flakiness). Em vez de uma espera fixa
  // arbitrária, usa o retry já existente do `selectLookupOption` (retypa e
  // espera a opção aparecer a cada tentativa) com mais tentativas — poll
  // real até a indexação terminar, sem depender de adivinhar quanto tempo
  // ela leva.
  await selectLookupOption(page, "Nome da conta", nomeConta, { tentativas: 6 });

  await page.getByRole("button", { name: "Salvar", exact: true }).click();

  // Prefixo "003" identifica registros de Contato (Contact).
  await expect(page).toHaveURL(/\/lightning\/r\/(Contact\/)?003\w+\/view/, { timeout: 30000 });
  await expect(page.getByRole("heading", { name: sobrenome })).toBeVisible({ timeout: 15000 });
});
