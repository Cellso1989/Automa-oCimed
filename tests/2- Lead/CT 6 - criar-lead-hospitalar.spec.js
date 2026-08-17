const { test, expect } = require("../../support/fixtures");
const { selecionarPicklist } = require("../../support/leadHelpers");

function gerarCnpjValido() {
  const calcularDigito = (base) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const raiz = Date.now().toString().slice(-8);
  const base12 = raiz + "0001";
  const dv1 = calcularDigito(base12);
  const dv2 = calcularDigito(base12 + dv1);
  const cnpj = base12 + dv1 + dv2;
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12, 14)}`;
}

// Só cria o Lead Hospitalar e completa a Análise Cadastral com dados
// válidos — sem enviar para aprovação nem aprovar. Hospitalar usa o fluxo
// CNPJ-primeiro (igual CG Cloud, ver CT 7) — o "Avançar" da 1ª etapa fica
// desabilitado até o CNPJ ser preenchido, diferente de Cimed Tech/
// Milimetric (fluxo simples Sobrenome+Empresa).
//
// Nota: Hospitalar não tem processo de aprovação ativo no Setup (ver
// README) — este spec só valida a criação/preenchimento em si, não a
// aprovação (que de qualquer forma não é o objetivo aqui).
test("cria um Lead Hospitalar com Análise Cadastral completa e válida", async ({ page }) => {
  test.setTimeout(60000);
  const cnpj = gerarCnpjValido();
  const sufixo = Date.now().toString().slice(-8);
  const sobrenome = `Sobrenome Hospitalar ${sufixo}`;
  const razaoSocial = `Hospitalar Teste ${sufixo}`;

  await page.getByText("Leads", { exact: true }).click();
  await page.getByRole("button", { name: "Criar" }).click();
  await page.waitForTimeout(1500);
  await page.getByText("Hospitalar", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(1500);

  const cnpjInput = page.getByRole("textbox", { name: "CNPJ" });
  await cnpjInput.fill(cnpj);
  await cnpjInput.press("Tab");
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(3000);

  // Diferente de Cimed Tech/Milimetric, a 2ª etapa do wizard CNPJ-primeiro
  // pede "Razão Social" (não "Empresa") e "Segmento"/"Business Unit"
  // (Segmento já vem com "Farmácia/Distribuidor farmacêutico" selecionado).
  await page.getByRole("textbox", { name: "Sobrenome" }).fill(sobrenome);
  await page.getByRole("textbox", { name: "Razão Social" }).fill(razaoSocial);

  // Business Unit "01 - Contas Nacionais" não tem preço cadastrado (achado
  // manual confirmado) — usar "03 - Varejo Independente" em vez disso.
  const buInput = page.getByRole("combobox", { name: "Business Unit" });
  await buInput.click();
  await buInput.fill("03");
  await page.waitForTimeout(2000);
  await page.getByText("03 - Varejo Independente").click();
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page).toHaveURL(/\/lightning\/r\/(Lead\/)?00Q\w+\/view/, { timeout: 30000 });

  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.waitForTimeout(2000);

  await page.getByRole("textbox", { name: "Endereço de Faturamento" }).fill("Rua Teste, 123");
  await page.getByRole("textbox", { name: "CEP", exact: true }).fill("01310-100");
  await page.getByRole("textbox", { name: "Bairro", exact: true }).fill("Bairro Teste");
  await page.getByRole("textbox", { name: "Cidade", exact: true }).fill("São Paulo");
  await page.getByRole("textbox", { name: "Parceiro de Negócios Vendedor" }).fill("H01_SD100");
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

  // Business Unit já foi definido na etapa de criação (wizard CNPJ-primeiro)
  // e o Warehouse já vem com "CIMED CONTAGEM" pré-selecionado por padrão
  // pra esse Tipo de Registro — nenhum dos dois precisa de busca aqui
  // (tentar reabrir o lookup já preenchido rompe o fluxo de "Pesquisa
  // avançada", que espera o campo vazio).

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(3000);

  await expect(page.getByText("H01_SD100")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Regular")).toBeVisible();
});
