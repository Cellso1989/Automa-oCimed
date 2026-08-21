const { test, expect } = require("../../../support/fixtures");
const { gerarCnpj } = require("../../../support/cnpj");

// Descoberto incidentalmente rodando um teste anterior (CG Cloud): a
// validação real do limite de 35 caracteres no "Sobrenome" é disparada pelo
// Flow "Preenchimento automático de campos Lead CG Cloud" — é ESPECÍFICA do
// Tipo de Registro CG Cloud, não um limite genérico do campo Lead.LastName
// (confirmado: o mesmo valor de 36 caracteres foi aceito sem erro no fluxo
// Cimed Tech). Por isso este teste reaproveita o fluxo CNPJ-primeiro do
// CT 7 (Lead CG Cloud), não o fluxo simples do CT 4.
function formatarCnpj(cnpj) {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12, 14)}`;
}

function sobrenomeComTamanho(tamanho) {
  const base = "Sobrenome ";
  let resultado = (base + Date.now()).slice(0, tamanho);
  while (resultado.length < tamanho) resultado += "0";
  return resultado;
}

test("bloqueia Lead CG Cloud com Sobrenome de 36 caracteres (1 acima do limite)", async ({ page }) => {
  test.setTimeout(60000);
  const cnpj = formatarCnpj(gerarCnpj());
  const sobrenome = sobrenomeComTamanho(36);
  const razaoSocial = `CG Cloud Teste ${Date.now()}`;

  await page.getByText("Leads", { exact: true }).click();
  await page.getByRole("button", { name: "Criar" }).click();
  await page.waitForTimeout(2000);
  await page.getByText("CG Cloud", { exact: true }).click({ force: true });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(1500);

  const cnpjInput = page.getByRole("textbox", { name: "CNPJ" });
  await cnpjInput.fill(cnpj);
  await cnpjInput.press("Tab");
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(3000);

  await page.getByRole("textbox", { name: "Sobrenome" }).fill(sobrenome);
  await page.getByRole("textbox", { name: "Razão Social" }).fill(razaoSocial);
  const buInput = page.getByRole("combobox", { name: "Business Unit" });
  await buInput.click();
  await buInput.fill("03");
  await page.waitForTimeout(2000);
  await page.getByText("03 - Varejo Independente").click();
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(3000);

  // Mensagem real do Flow "Preenchimento automático de campos Lead CG
  // Cloud" (ver comentário acima).
  await expect(page.getByText("O sobrenome deve conter até 35 caracteres").first()).toBeVisible({ timeout: 10000 });
  await expect(page).not.toHaveURL(/\/lightning\/r\/(Lead\/)?00Q\w+\/view/);
});
