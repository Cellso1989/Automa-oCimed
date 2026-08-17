const { test, expect } = require("../../support/fixtures");
const { soqlQuery } = require("../../support/soqlQuery");

// Mesma Conta convertida usada no CT 15 (ver aquele spec pro motivo de reusar
// uma Conta fixa em vez de criar uma nova).
const CONTA_ID = "001Ha00000znHRFIA2";

test("cria uma Oportunidade do tipo Distribuidor Hospitalar a partir de uma Conta convertida", async ({ page, sfSession }) => {
  await page.goto(`https://${sfSession.instanceHost}/lightning/r/Account/${CONTA_ID}/related/Opportunities/view`);
  await page.waitForTimeout(3000);

  await page.getByRole("button", { name: "Criar" }).click();
  await page.waitForTimeout(2500);
  // O radio "Distribuidor Hospitalar" fica fora do viewport visível do
  // modal (precisa rolar) e um <div> por cima intercepta cliques normais
  // (mesmo com scrollIntoViewIfNeeded do Playwright) — clica via DOM
  // (element.click()) depois de rolar explicitamente até ele.
  const radioHospitalar = page.getByRole("radio", { name: /^Distribuidor Hospitalar/ });
  await radioHospitalar.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await radioHospitalar.evaluate((el) => el.click());
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(2000);

  const nomeOportunidade = `Oportunidade Hospitalar Teste ${Date.now()}`;
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
  // arriscar cancelar o modal inteiro (Escape faz isso, igual no CT4/CT1).
  await page.getByRole("heading", { name: /Criar Oportunidade/ }).click();
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(4000);

  // Comportamento pós-"Salvar" é inconsistente (às vezes navega pro
  // registro, às vezes volta pra related list) — confirmar via SOQL é mais
  // confiável do que depender da URL final (mesmo problema do CT 15).
  const resultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id, StageName, RecordType.Name FROM Opportunity WHERE Name = '${nomeOportunidade}' AND AccountId = '${CONTA_ID}'`,
  });
  expect(resultado.totalSize).toBe(1);
  expect(resultado.records[0].RecordType.Name).toBe("Distribuidor Hospitalar");
});
