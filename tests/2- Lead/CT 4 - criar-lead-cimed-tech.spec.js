const { test, expect } = require("../../support/fixtures");
const { completarAnaliseCadastralComum } = require("../../support/leadHelpers");

// Só cria o Lead Cimed Tech e completa a Análise Cadastral com dados
// válidos (mesmos valores reais usados no CT 8/scripts de massa) — sem
// enviar para aprovação nem aprovar. Cimed Tech usa o fluxo simples de
// criação (Sobrenome + Empresa, sem CNPJ na etapa inicial).
test("cria um Lead Cimed Tech com Análise Cadastral completa e válida", async ({ page }) => {
  test.setTimeout(60000);
  const sufixo = Date.now().toString().slice(-8);
  const sobrenome = `Sobrenome Cimed Tech ${sufixo}`;
  const empresa = `Empresa Teste Cimed Tech ${sufixo}`;

  await page.getByText("Leads", { exact: true }).click();
  await page.getByRole("button", { name: "Criar" }).click();
  // "Cimed Tech" já vem pré-selecionado como Tipo de registro.
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByRole("textbox", { name: "Sobrenome" }).fill(sobrenome);
  await page.getByRole("textbox", { name: "Empresa", exact: true }).fill(empresa);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page).toHaveURL(/\/lightning\/r\/(Lead\/)?00Q\w+\/view/, { timeout: 30000 });

  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.waitForTimeout(2000);

  await completarAnaliseCadastralComum(page, { parceiro: "H07_IS306" });

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(3000);

  // Confirma que os dados persistiram de verdade (não só que o clique em
  // "Salvar" aconteceu) — o valor preenchido deve aparecer na visualização.
  await expect(page.getByText("H07_IS306")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Regular")).toBeVisible();
});
