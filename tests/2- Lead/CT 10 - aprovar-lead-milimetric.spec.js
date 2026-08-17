const { test, expect } = require("../../support/fixtures");
const {
  abrirLeadEmAnaliseFiscalPorTipo,
  completarFiscalLogisticaEConverter,
  aprovarAnaliseFiscalComEdicao,
} = require("../../support/leadHelpers");
const { garantirMassaEmAnaliseFiscal } = require("../../support/massaHelpers");
const { soqlQuery } = require("../../support/soqlQuery");

// Pré-condição: existir um Lead Milimetric em "Análise Fiscal". Diferente do
// Cimed Tech (que o CT 8 sempre abastece), nenhum outro CT desta suíte gera
// massa Milimetric pronta — por isso `garantirMassaEmAnaliseFiscal` confere
// e gera na hora se precisar, deixando o spec independente (CLAUDE.md item
// 18) em vez de depender de rodar scripts/gerar-massa-para-suite.js à parte
// antes. Completa os campos restantes e aprova via "Editar Lead Aprovação" +
// "Salvar e Aprovar" — mesmo mecanismo confirmado real pra Cimed Tech e
// CG Cloud.
test("aprova um Lead Milimetric e converte de verdade", async ({ page, sfSession }) => {
  // Timeout ampliado pra cobrir o pior caso: gerar massa do zero (fluxo
  // completo de criação + aprovação como Mayssara, ~1m30s-2min, não os ~30s
  // estimados originalmente) + fluxo normal de aprovação. Mesmo valor usado
  // no CT 11, que cobre o mesmo cenário (massa gerada na hora).
  test.setTimeout(480000);
  await garantirMassaEmAnaliseFiscal(sfSession, "Milimetric");
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
