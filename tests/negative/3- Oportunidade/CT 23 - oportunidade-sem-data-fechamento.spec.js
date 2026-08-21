const { test, expect } = require("../../../support/fixtures");
const { soqlQuery } = require("../../../support/soqlQuery");

// Reaproveita o fluxo do CT 15 (Oportunidade Licitação) — mesma Conta
// convertida fixa — deixando "Data de fechamento" (obrigatório) em branco.
const CONTA_ID = "001Ha00000znHRFIA2";

test("não cria uma Oportunidade sem preencher Data de fechamento", async ({ page, sfSession }) => {
  await page.goto(`https://${sfSession.instanceHost}/lightning/r/Account/${CONTA_ID}/related/Opportunities/view`);
  await page.waitForTimeout(3000);

  await page.getByRole("button", { name: "Criar" }).click();
  await page.waitForTimeout(2500);
  await page.getByRole("radio", { name: /^Licitação/ }).check();
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(2000);

  const nomeOportunidade = `Oportunidade Sem Data ${Date.now()}`;
  await page.getByRole("textbox", { name: "Nome da oportunidade" }).fill(nomeOportunidade);
  await page.getByRole("combobox", { name: "Fase", exact: true }).click();
  await page.getByRole("option", { name: "Novo", exact: true }).click();
  await page.getByRole("combobox", { name: "Categoria de previsão" }).click();
  await page.getByRole("option", { name: "Pipeline", exact: true }).click();
  // "Data de fechamento" fica em branco de propósito.

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(3000);

  const resultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id FROM Opportunity WHERE Name = '${nomeOportunidade}' AND AccountId = '${CONTA_ID}'`,
  });
  expect(resultado.totalSize).toBe(0);
});
