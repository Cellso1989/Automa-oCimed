const { test, expect } = require("../../support/fixtures");
const {
  abrirLeadEmAnaliseFiscalPorTipo,
  completarFiscalLogisticaEConverter,
  aprovarAnaliseFiscalComEdicao,
} = require("../../support/leadHelpers");
const { soqlQuery } = require("../../support/soqlQuery");

// Papel de analista: não cria o Lead. Pré-condição: existir um Lead do tipo
// Cimed Tech em "Análise Fiscal" (massa gerada pelo CT 8 — cadastral
// completo + aprovação). Completa os campos restantes e aprova via "Editar
// Lead Aprovação" + "Salvar e Aprovar" — mecanismo confirmado como o
// verdadeiro gatilho da conversão nativa do Salesforce (IsConverted = true,
// Account/Contact criados), testado com Lead recém-criado (não reaproveitado).
test("aprova um Lead Cimed Tech e converte de verdade", async ({ page, sfSession }) => {
  test.setTimeout(90000);
  await abrirLeadEmAnaliseFiscalPorTipo(page, sfSession, "Cimed Tech");
  const leadId = page.url().match(/00Q\w+/)[0];

  await completarFiscalLogisticaEConverter(page, "Cimed Tech", sfSession, leadId);
  await aprovarAnaliseFiscalComEdicao(page);

  // Confirma a conversão REAL via SOQL — IsConverted/ConvertedAccountId só
  // existem quando o Salesforce realmente converteu o Lead.
  await page.waitForTimeout(3000);
  const resultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT IsConverted, ConvertedAccountId FROM Lead WHERE Id = '${leadId}'`,
  });
  expect(resultado.records[0].IsConverted).toBe(true);
  expect(resultado.records[0].ConvertedAccountId).not.toBeNull();
});
