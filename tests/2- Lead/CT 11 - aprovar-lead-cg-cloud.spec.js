const { test, expect } = require("../../support/fixtures");
const {
  abrirLeadEmAnaliseFiscalPorTipo,
  completarFiscalLogisticaEConverter,
  aprovarAnaliseFiscalComEdicao,
} = require("../../support/leadHelpers");
const { soqlQuery } = require("../../support/soqlQuery");

// Papel de analista: não cria o Lead. Pré-condição: existir um Lead do tipo
// CG Cloud em "Análise Fiscal" (massa já existente no sistema, ou gerada por
// um fluxo de criação + aprovação da Análise Cadastral como Mayssara).
//
// Diferente de Cimed Tech/Milimetric/Hospitalar: pra CG Cloud, a aprovação
// real da etapa "Análise Fiscal" acontece via "Editar Lead Aprovação" +
// "Salvar e Aprovar" (não o botão simples "Aprovar" do Histórico de
// aprovação) — e isso já dispara sozinho a conversão NATIVA do Salesforce
// (IsConverted = true, Account/Contact criados de verdade), sem precisar de
// nenhum clique adicional no path pra "Convertido". Confirmado testando com
// um Lead real (aprovação manual) e replicado via automação.
test("aprova um Lead CG Cloud e converte de verdade (Account real)", async ({ page, sfSession }) => {
  test.setTimeout(90000);
  await abrirLeadEmAnaliseFiscalPorTipo(page, sfSession, "CG Cloud");
  const leadId = page.url().match(/00Q\w+/)[0];

  await completarFiscalLogisticaEConverter(page, "CG Cloud", sfSession, leadId);
  await aprovarAnaliseFiscalComEdicao(page);

  // Confirma a conversão REAL via SOQL — IsConverted/ConvertedAccountId só
  // existem quando o Salesforce realmente converteu o Lead (diferente do
  // campo Status customizado, que não garante isso pros outros tipos).
  await page.waitForTimeout(3000);
  const resultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT IsConverted, ConvertedAccountId FROM Lead WHERE Id = '${leadId}'`,
  });
  expect(resultado.records[0].IsConverted).toBe(true);
  expect(resultado.records[0].ConvertedAccountId).not.toBeNull();
});
