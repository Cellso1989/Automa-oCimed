const { test, expect } = require("../../support/fixtures");
const { selecionarViaPesquisaAvancada, selecionarPicklist } = require("../../support/leadHelpers");

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

  await page.getByRole("textbox", { name: "Endereço de Faturamento" }).fill("Rua Teste, 123");
  await page.getByRole("textbox", { name: "CEP", exact: true }).fill("01310-100");
  await page.getByRole("textbox", { name: "Bairro", exact: true }).fill("Bairro Teste");
  await page.getByRole("textbox", { name: "Cidade", exact: true }).fill("São Paulo");
  await page.getByRole("textbox", { name: "Parceiro de Negócios Vendedor" }).fill("H07_IS306");
  await page.getByRole("textbox", { name: "Número AE" }).fill("AE001");
  await page.getByRole("textbox", { name: "Nome Farmacêutico Responsável" }).fill("Farmacêutico Teste");
  await page.getByRole("textbox", { name: "Número CRF Farmacêutico Responsável" }).fill("CRF001");
  await page.getByRole("textbox", { name: "Data de vencimento CRF" }).fill("31/12/2030");
  await page.getByRole("textbox", { name: "Documentos Faltantes" }).fill("Nenhum");
  await page.getByRole("textbox", { name: "Número Alvará Sivisa" }).fill("SIVISA001");
  await page.getByRole("textbox", { name: "Data de Vencimento Alvará Sivisa" }).fill("31/12/2030");

  await selecionarPicklist(page, "Situação AFE/AE", "Regular");
  await selecionarPicklist(page, "Classe do cliente", "01- Grandes Redes");
  await selecionarPicklist(page, "Grupo do cliente", "01-Grandes contas");
  await selecionarPicklist(page, "Pode comprar medicamento controlado", "Não");
  await selecionarPicklist(page, "Conta do Cliente", "ZMED");

  // Business Unit "01 - Contas Nacionais" não tem preço cadastrado (achado
  // manual confirmado) — usar "03 - Varejo Independente" em vez disso.
  await selecionarViaPesquisaAvancada(page, "Business Unit", "03");
  await selecionarViaPesquisaAvancada(page, "Warehouse", "SP");

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(3000);

  // Confirma que os dados persistiram de verdade (não só que o clique em
  // "Salvar" aconteceu) — o valor preenchido deve aparecer na visualização.
  await expect(page.getByText("H07_IS306")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Regular")).toBeVisible();
});
