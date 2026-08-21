const { test, expect } = require("../../support/fixtures");
const { completarAnaliseCadastralComum, aprovarComoMayssara } = require("../../support/leadHelpers");

// IMPORTANTE: no fluxo real, quem aprova a etapa "Análise Cadastral" é a
// Mayssara Aparecida de Sousa, não o usuário de automação (Celso Sabino).
// Autoaprovar como o próprio Celso não reflete o processo real. Por isso
// este spec usa o recurso nativo do Salesforce "Login" (logar como outro
// usuário sem senha, disponível pra administradores em sandbox — uso
// autorizado explicitamente) pra aprovar de verdade como ela, na mesma aba
// (o "Login As" navega na própria página, não abre uma nova), antes de
// confirmar que o Lead chegou em "Análise Fiscal".
test("cria um Lead, envia e aprova a Análise Cadastral como Mayssara", async ({ page, sfSession }) => {
  test.setTimeout(120000); // fluxo longo: cadastral completo + envio + login-as + aprovação
  const sobrenome = `Sobrenome Lead Conv ${Date.now()}`;
  const empresa = `Empresa Teste Conv ${Date.now()}`;

  // Cria o Lead (Cimed Tech, o Record Type mais simples de criar).
  await page.getByText("Leads", { exact: true }).click();
  await page.getByRole("button", { name: "Criar" }).click();
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByRole("textbox", { name: "Sobrenome" }).fill(sobrenome);
  await page.getByRole("textbox", { name: "Empresa", exact: true }).fill(empresa);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page).toHaveURL(/\/lightning\/r\/(Lead\/)?00Q\w+\/view/, { timeout: 30000 });

  const leadId = page.url().match(/00Q\w+/)[0];

  // A conversão só é possível se existir ao menos uma aprovação no
  // "Histórico de aprovação" — condição pra sair de "Análise Cadastral" e
  // chegar em "Análise Fiscal". Pra isso, a etapa de Análise Cadastral
  // precisa estar totalmente preenchida antes de enviar para aprovação.
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.waitForTimeout(2000);

  await completarAnaliseCadastralComum(page, { parceiro: "H07_IS306" });

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(3000);

  // Envia pra aprovação.
  await page.getByRole("button", { name: "Enviar para aprovação" }).click();
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await page.waitForTimeout(3000);

  // Aprova como Mayssara (via "Login" nativo, sem senha dela — o helper já
  // deixa a página de volta no Lead ao final).
  await aprovarComoMayssara(page, sfSession, leadId);

  // A etapa concluída fica marcada como opção selecionada no "Caminho".
  await expect(page.getByRole("option", { name: "Análise Fiscal", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
    { timeout: 15000 }
  );
});
