const { test, expect } = require("../../../support/fixtures");

// Reaproveita o fluxo do CT 15 (Oportunidade Licitação) — mesma Conta
// convertida fixa — deixando "Nome da oportunidade" (obrigatório) em branco.
const CONTA_ID = "001Ha00000znHRFIA2";

test("não cria uma Oportunidade sem preencher Nome da oportunidade", async ({ page, sfSession }) => {
  await page.goto(`https://${sfSession.instanceHost}/lightning/r/Account/${CONTA_ID}/related/Opportunities/view`);
  await page.waitForTimeout(3000);

  await page.getByRole("button", { name: "Criar" }).click();
  await page.waitForTimeout(2500);
  await page.getByRole("radio", { name: /^Licitação/ }).check();
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(2000);

  // "Nome da oportunidade" fica em branco de propósito.
  await page.getByRole("combobox", { name: "Fase", exact: true }).click();
  await page.getByRole("option", { name: "Novo", exact: true }).click();
  await page.getByRole("combobox", { name: "Categoria de previsão" }).click();
  await page.getByRole("option", { name: "Pipeline", exact: true }).click();

  const hoje = new Date();
  const dataFormatada = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
  await page.getByRole("textbox", { name: "Data de fechamento" }).fill(dataFormatada);
  await page.getByRole("heading", { name: /Criar Oportunidade/ }).click();
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(2000);

  await expect(page.locator(".slds-has-error")).not.toHaveCount(0);
});
