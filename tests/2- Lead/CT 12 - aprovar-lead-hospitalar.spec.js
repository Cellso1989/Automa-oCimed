const { test, expect } = require("../../support/fixtures");
const {
  abrirLeadEmAnaliseFiscalPorTipo,
  aprovarEtapaPendente,
  completarFiscalLogisticaEConverter,
  marcarStatusConvertido,
} = require("../../support/leadHelpers");

// Papel de analista: não cria o Lead. Pré-condição: existir um Lead do tipo
// Hospitalar em "Análise Fiscal".
//
// Nota: até a criação deste spec não havia massa de Hospitalar em "Análise
// Fiscal" no sistema (verificado via SOQL) — este teste deve falhar com uma
// mensagem clara enquanto essa massa não existir, em vez de dar um erro
// confuso.
test("aprova um Lead Hospitalar e leva até Convertido", async ({ page, sfSession }) => {
  test.setTimeout(90000);
  await abrirLeadEmAnaliseFiscalPorTipo(page, sfSession, "Hospitalar");
  const leadId = page.url().match(/00Q\w+/)[0];
  await aprovarEtapaPendente(page);
  await completarFiscalLogisticaEConverter(page, "Hospitalar", sfSession, leadId);
  await marcarStatusConvertido(page);

  await expect(page.getByRole("button", { name: "Alterar Status convertido" })).toBeVisible({ timeout: 15000 });
});
