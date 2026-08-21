const { test, expect } = require("../../support/fixtures");
const {
  abrirLeadEmAnaliseFiscalPorTipo,
  completarFiscalLogisticaEConverter,
  aprovarAnaliseFiscalComEdicao,
} = require("../../support/leadHelpers");
const { garantirMassaEmAnaliseFiscal } = require("../../support/massaHelpers");
const { soqlQuery } = require("../../support/soqlQuery");

// Pré-condição: existir um Lead Hospitalar em "Análise Fiscal". Mesma lógica
// dos CT 9/10/11 (Cimed Tech/Milimetric/CG Cloud): `garantirMassaEmAnaliseFiscal`
// procura massa existente via SOQL primeiro e só gera nova (criação completa
// como Nicole + avanço como Mayssara, ver
// scripts/criar-massa-hospitalar-nicole.js) se não achar nada — deixando o
// spec independente (CLAUDE.md item 18).
//
// RESOLVIDO 2026-08-20: o "Segmento" do Lead precisava ser "Distribuidor
// Hospitalar" (não o default "Farmácia/Distribuidor farmacêutico") pra
// destravar a aprovação REAL — com isso, "Editar Lead Aprovação" + "Salvar e
// Aprovar" converte de verdade igual Cimed Tech/Milimetric/CG Cloud (mesmo
// mecanismo, `aprovarAnaliseFiscalComEdicao`), e a integração SAP dispara
// sozinha com sucesso. As tentativas anteriores com o botão nativo
// "Converter" ou truques de path/Status ficaram obsoletas — não são mais
// necessárias. Ver [[project_lead_hospitalar_nicole]] na memória do
// projeto pro histórico completo da investigação.
test("aprova um Lead Hospitalar e converte de verdade", async ({ page, sfSession }) => {
  // Timeout ampliado pra cobrir o pior caso: gerar massa do zero (fluxo mais
  // longo da suíte — criação completa como Nicole + avanço como Mayssara,
  // com trocas de "Login As" no meio — já visto levar ~8min) + fluxo normal
  // de aprovação.
  test.setTimeout(600000);
  await garantirMassaEmAnaliseFiscal(sfSession, "Hospitalar");

  // `garantirMassaEmAnaliseFiscal` gera massa numa aba/browser totalmente
  // separada — a `page` deste teste fica ociosa durante esse tempo (pode
  // passar de 8min), tempo suficiente pra sessão do Salesforce expirar por
  // inatividade e essa `page` cair na tela de login. Reautentica via
  // frontdoor antes de continuar, por garantia.
  await page.goto(`https://${sfSession.instanceHost}/secur/frontdoor.jsp?sid=${sfSession.sessionId}`);
  await page.waitForTimeout(2000);

  await abrirLeadEmAnaliseFiscalPorTipo(page, sfSession, "Hospitalar");
  const leadId = page.url().match(/00Q\w+/)[0];

  await completarFiscalLogisticaEConverter(page, "Hospitalar", sfSession, leadId);
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
