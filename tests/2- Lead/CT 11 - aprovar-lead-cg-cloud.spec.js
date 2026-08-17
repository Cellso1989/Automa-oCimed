const { test, expect } = require("../../support/fixtures");
const {
  abrirLeadEmAnaliseFiscalPorTipo,
  completarFiscalLogisticaEConverter,
  aprovarAnaliseFiscalComEdicao,
} = require("../../support/leadHelpers");
const { garantirMassaEmAnaliseFiscal } = require("../../support/massaHelpers");
const { soqlQuery } = require("../../support/soqlQuery");

// Pré-condição: existir um Lead CG Cloud em "Análise Fiscal". Nenhum outro
// CT desta suíte abastece isso (o CT 7 cria o Lead mas para de propósito em
// "Pronto para Aprovação", sem enviar) — por isso
// `garantirMassaEmAnaliseFiscal` confere e gera na hora se precisar, deixando
// o spec independente (CLAUDE.md item 18) em vez de depender de rodar
// scripts/gerar-massa-para-suite.js à parte antes.
//
// Diferente de Cimed Tech/Milimetric/Hospitalar: pra CG Cloud, a aprovação
// real da etapa "Análise Fiscal" acontece via "Editar Lead Aprovação" +
// "Salvar e Aprovar" (não o botão simples "Aprovar" do Histórico de
// aprovação) — e isso já dispara sozinho a conversão NATIVA do Salesforce
// (IsConverted = true, Account/Contact criados de verdade), sem precisar de
// nenhum clique adicional no path pra "Convertido". Confirmado testando com
// um Lead real (aprovação manual) e replicado via automação.
test("aprova um Lead CG Cloud e converte de verdade (Account real)", async ({ page, sfSession }) => {
  // Timeout ampliado pra cobrir o pior caso: gerar massa do zero (CG Cloud é
  // o tipo mais demorado de criar, ~1.5-2min, e o mais sensível à lentidão
  // da org — já visto passar de 5min em condições ruins) + fluxo normal de
  // aprovação.
  test.setTimeout(480000);
  await garantirMassaEmAnaliseFiscal(sfSession, "CG Cloud");
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
