const { test, expect } = require("../../support/fixtures");
const { soqlQuery } = require("../../support/soqlQuery");

// Oportunidade é criada a partir de uma Conta já convertida (Lead -> Account
// via mecanismo real, ver README) — usa aqui uma Conta fixa que sabemos que
// converteu com sucesso e tem integração SAP OK ("EMPRESA TESTE CIMED TECH
// 92955273", Status_Integracao__c = "Integrado com Sucesso"), em vez de criar
// uma Conta nova só para este teste.
const CONTA_ID = "001Ha00000znHRFIA2";

test("cria uma Oportunidade do tipo Licitação a partir de uma Conta convertida", async ({ page, sfSession }) => {
  await page.goto(`https://${sfSession.instanceHost}/lightning/r/Account/${CONTA_ID}/related/Opportunities/view`);
  await page.waitForTimeout(3000);

  await page.getByRole("button", { name: "Criar" }).click();
  await page.waitForTimeout(2500);
  // Só duas opções de Tipo de Registro aparecem aqui: "Licitação" e
  // "Distribuidor Hospitalar" (radio buttons) — "Licitação" já vem
  // selecionada por padrão, mas marca explicitamente por garantia.
  await page.getByRole("radio", { name: /^Licitação/ }).check();
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(2000);

  const nomeOportunidade = `Oportunidade Teste ${Date.now()}`;
  await page.getByRole("textbox", { name: "Nome da oportunidade" }).fill(nomeOportunidade);
  // "Nome da conta" já vem preenchido com a Conta de onde o "Criar" foi
  // acionado (não precisa selecionar via lookup).

  await page.getByRole("combobox", { name: "Fase", exact: true }).click();
  await page.getByRole("option", { name: "Novo", exact: true }).click();

  await page.getByRole("combobox", { name: "Categoria de previsão" }).click();
  await page.getByRole("option", { name: "Pipeline", exact: true }).click();

  const hoje = new Date();
  const dataFormatada = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
  await page.getByRole("textbox", { name: "Data de fechamento" }).fill(dataFormatada);
  // Clica no cabeçalho do modal (área neutra) pra fechar o date picker sem
  // arriscar cancelar o modal inteiro (Escape faz isso, igual no CT4).
  await page.getByRole("heading", { name: /Criar Oportunidade/ }).click();
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(4000);

  // Depois de salvar, às vezes navega pro registro novo e às vezes volta
  // pra related list (varia entre execuções) — confirmar via SOQL é mais
  // confiável do que depender da URL final.
  const resultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id, StageName, RecordType.Name FROM Opportunity WHERE Name = '${nomeOportunidade}' AND AccountId = '${CONTA_ID}'`,
  });
  expect(resultado.totalSize).toBe(1);
  expect(resultado.records[0].RecordType.Name).toBe("Licitação");
});
