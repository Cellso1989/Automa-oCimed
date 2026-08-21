const { test, expect } = require("../../../support/fixtures");
const { soqlQuery } = require("../../../support/soqlQuery");

// Reaproveita o fluxo do CT 15 (Oportunidade Licitação) — mesma Conta
// convertida fixa — deixando "Categoria de previsão" sem selecionar.
//
// DESCOBERTA (rodando este teste): diferente de "Fase"/"Nome da
// oportunidade"/"Data de fechamento" (ver CT 22/23/30), "Categoria de
// previsão" NÃO é obrigatória neste formulário — a Oportunidade é criada
// normalmente sem ela (provavelmente derivada automaticamente da Fase pelo
// Salesforce padrão). Preenchida no fluxo positivo do CT 15/16 por
// completude, não porque o "Salvar" exige.
const CONTA_ID = "001Ha00000znHRFIA2";

test("cria a Oportunidade normalmente mesmo sem selecionar Categoria de previsão", async ({ page, sfSession }) => {
  await page.goto(`https://${sfSession.instanceHost}/lightning/r/Account/${CONTA_ID}/related/Opportunities/view`);
  await page.waitForTimeout(3000);

  await page.getByRole("button", { name: "Criar" }).click();
  await page.waitForTimeout(2500);
  await page.getByRole("radio", { name: /^Licitação/ }).check();
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(2000);

  const nomeOportunidade = `Oportunidade Sem Categoria ${Date.now()}`;
  await page.getByRole("textbox", { name: "Nome da oportunidade" }).fill(nomeOportunidade);
  await page.getByRole("combobox", { name: "Fase", exact: true }).click();
  await page.getByRole("option", { name: "Novo", exact: true }).click();
  // "Categoria de previsão" fica sem selecionar de propósito.

  const hoje = new Date();
  const dataFormatada = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
  await page.getByRole("textbox", { name: "Data de fechamento" }).fill(dataFormatada);
  await page.getByRole("heading", { name: /Criar Oportunidade/ }).click();
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(3000);

  const resultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id FROM Opportunity WHERE Name = '${nomeOportunidade}' AND AccountId = '${CONTA_ID}'`,
  });
  expect(resultado.totalSize).toBe(1);
});
