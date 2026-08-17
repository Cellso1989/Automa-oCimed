const { test, expect } = require("../../support/fixtures");
const { selecionarViaPesquisaAvancada, selecionarPicklist } = require("../../support/leadHelpers");

// Só cria o Lead Milimetric e completa a Análise Cadastral com dados válidos
// — sem enviar para aprovação nem aprovar. Usa o mesmo fluxo simples de
// criação (Sobrenome + Empresa) que Cimed Tech, mas com valores próprios
// (Grupo do cliente/Conta do Cliente diferentes — confirmados via massa
// real/scripts/criar-massa-lead.js). Milimetric não tem "Warehouse" na
// Análise Cadastral (é preenchido só depois, na Análise Fiscal).
test("cria um Lead Milimetric com Análise Cadastral completa e válida", async ({ page }) => {
  test.setTimeout(60000);
  const sufixo = Date.now().toString().slice(-8);
  const sobrenome = `Sobrenome Milimetric ${sufixo}`;
  const empresa = `Empresa Teste Milimetric ${sufixo}`;

  await page.getByText("Leads", { exact: true }).click();
  await page.getByRole("button", { name: "Criar" }).click();
  await page.waitForTimeout(1500);
  await page.getByText("Milimetric", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByRole("textbox", { name: "Sobrenome" }).fill(sobrenome);
  await page.getByRole("textbox", { name: "Empresa", exact: true }).fill(empresa);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page).toHaveURL(/\/lightning\/r\/(Lead\/)?00Q\w+\/view/, { timeout: 30000 });

  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.waitForTimeout(2000);

  await page.getByRole("textbox", { name: "Endereço de Faturamento" }).fill("Rua Teste, 123");
  await page.getByRole("textbox", { name: "CEP", exact: true }).fill("01310-100");
  await page.getByRole("textbox", { name: "Bairro", exact: true }).fill("Bairro Teste");
  await page.getByRole("textbox", { name: "Cidade", exact: true }).fill("São Paulo");
  await page.getByRole("textbox", { name: "Parceiro de Negócios Vendedor" }).fill("H15_BR001");

  await selecionarPicklist(page, "Situação AFE/AE", "Regular");
  await selecionarPicklist(page, "Classe do cliente", "01- Grandes Redes");
  await selecionarPicklist(page, "Grupo do cliente", "03- Especializados");
  await selecionarPicklist(page, "Pode comprar medicamento controlado", "Não");
  await selecionarPicklist(page, "Conta do Cliente", "ZOUT");

  // Business Unit "01 - Contas Nacionais" não tem preço cadastrado (achado
  // manual confirmado) — usar "03 - Varejo Independente" em vez disso.
  await selecionarViaPesquisaAvancada(page, "Business Unit", "03");

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(3000);

  await expect(page.getByText("H15_BR001")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Regular")).toBeVisible();
});
