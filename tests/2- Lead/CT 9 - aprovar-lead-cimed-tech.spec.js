const { test, expect } = require("../../support/fixtures");
const {
  abrirLeadEmAnaliseFiscalPorTipo,
  completarFiscalLogisticaEConverter,
  aprovarAnaliseFiscalComEdicao,
} = require("../../support/leadHelpers");
const { garantirMassaEmAnaliseFiscal } = require("../../support/massaHelpers");
const { soqlQuery } = require("../../support/soqlQuery");

// Pré-condição: existir um Lead Cimed Tech em "Análise Fiscal". Normalmente
// já existe (o CT 8, que roda antes na mesma suíte, sempre deixa um pronto),
// mas o teste não depende disso — `garantirMassaEmAnaliseFiscal` confere
// antes e gera na hora se precisar, pra este spec funcionar sozinho mesmo
// rodado isolado (testes devem ser independentes — CLAUDE.md item 18).
// Completa os campos restantes e aprova via "Editar Lead Aprovação" +
// "Salvar e Aprovar" — mecanismo confirmado como o verdadeiro gatilho da
// conversão nativa do Salesforce (IsConverted = true, Account/Contact
// criados), testado com Lead recém-criado (não reaproveitado).
test("aprova um Lead Cimed Tech e converte de verdade", async ({ page, sfSession }) => {
  // Timeout ampliado pra cobrir o pior caso: gerar massa do zero (~40s) +
  // fluxo normal de aprovação.
  test.setTimeout(180000);
  await garantirMassaEmAnaliseFiscal(sfSession, "Cimed Tech");
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
