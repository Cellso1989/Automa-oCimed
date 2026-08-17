const { test, expect } = require("../../support/fixtures");
const {
  abrirLeadEmAnaliseFiscalPorTipo,
  completarFiscalLogisticaEConverter,
  aprovarAnaliseFiscalComEdicao,
} = require("../../support/leadHelpers");
const { soqlQuery } = require("../../support/soqlQuery");

// Papel de analista: não cria o Lead. Pré-condição: existir um Lead do tipo
// Milimetric em "Análise Fiscal" (massa já existente no sistema). Completa
// os campos restantes e aprova via "Editar Lead Aprovação" + "Salvar e
// Aprovar" — mesmo mecanismo confirmado real pra Cimed Tech e CG Cloud.
test("aprova um Lead Milimetric e converte de verdade", async ({ page, sfSession }) => {
  test.setTimeout(90000);
  await abrirLeadEmAnaliseFiscalPorTipo(page, sfSession, "Milimetric");
  const leadId = page.url().match(/00Q\w+/)[0];

  await completarFiscalLogisticaEConverter(page, "Milimetric", sfSession, leadId);
  await aprovarAnaliseFiscalComEdicao(page);

  await page.waitForTimeout(3000);
  const resultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT IsConverted, ConvertedAccountId FROM Lead WHERE Id = '${leadId}'`,
  });
  expect(resultado.records[0].IsConverted).toBe(true);
  expect(resultado.records[0].ConvertedAccountId).not.toBeNull();
});
