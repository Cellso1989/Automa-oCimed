const { test, expect } = require("../../../support/fixtures");
const { abrirLeadEmAnaliseFiscalPorTipo } = require("../../../support/leadHelpers");
const { garantirMassaEmAnaliseFiscal } = require("../../../support/massaHelpers");
const { soqlQuery } = require("../../../support/soqlQuery");

// Reaproveita a mesma pré-condição do CT 9 (Lead Cimed Tech em "Análise
// Fiscal", via `garantirMassaEmAnaliseFiscal`/`abrirLeadEmAnaliseFiscalPorTipo"),
// mas NÃO chama `completarFiscalLogisticaEConverter` antes de tentar
// aprovar — comportamento documentado no próprio `leadHelpers.js`
// (`aprovarAnaliseFiscalComEdicao`): "Pré-condição: `completarFiscalLogistica
// EConverter` já deve ter rodado..., senão o 'Salvar e Aprovar' falha com
// 'Campo obrigatório exigido'." Mensagem real, não inventada.
test("bloqueia 'Salvar e Aprovar' na Análise Fiscal sem completar Fiscal/Financeira/Logística", async ({ page, sfSession }) => {
  test.setTimeout(180000);
  await garantirMassaEmAnaliseFiscal(sfSession, "Cimed Tech");
  await abrirLeadEmAnaliseFiscalPorTipo(page, sfSession, "Cimed Tech");
  const leadId = page.url().match(/00Q\w+/)[0];

  // Tenta aprovar direto, sem completar os campos de Fiscal/Financeira/
  // Logística (diferente do CT 9, que chama `completarFiscalLogisticaEConverter`
  // antes disto).
  await page.getByRole("button", { name: "Editar Lead Aprovação" }).click();
  await page.waitForTimeout(3000);

  const botaoSalvarEAprovar = page.getByRole("button", { name: "Salvar e Aprovar", exact: true });
  if (!(await botaoSalvarEAprovar.count())) {
    await page.getByRole("button", { name: "Editar Lead Aprovação" }).click();
    await page.waitForTimeout(3000);
  }
  await botaoSalvarEAprovar.click({ timeout: 30000 });
  await page.waitForTimeout(4000);

  await expect(page.getByText("Campo obrigatório exigido").first()).toBeVisible({ timeout: 10000 });

  // Confirma que o Lead NÃO foi convertido de verdade.
  const resultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT IsConverted FROM Lead WHERE Id = '${leadId}'`,
  });
  expect(resultado.records[0].IsConverted).toBe(false);
});
