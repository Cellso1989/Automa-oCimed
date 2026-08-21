const { test, expect } = require("../../../support/fixtures");
const { gerarCnpj } = require("../../../support/cnpj");

// Complementa o CT 38 — confirma o limite exato pro Lead CG Cloud: 35
// caracteres (o próprio limite, não 1 acima) deve ser aceito normalmente.
function formatarCnpj(cnpj) {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12, 14)}`;
}

function sobrenomeComTamanho(tamanho) {
  const base = "Sobrenome ";
  let resultado = (base + Date.now()).slice(0, tamanho);
  while (resultado.length < tamanho) resultado += "0";
  return resultado;
}

test("cria um Lead CG Cloud com Sobrenome de exatamente 35 caracteres (limite)", async ({ page }) => {
  test.setTimeout(60000);
  const cnpj = formatarCnpj(gerarCnpj());
  const sobrenome = sobrenomeComTamanho(35);
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

  await expect(page).toHaveURL(/\/lightning\/r\/(Lead\/)?00Q\w+\/view/, { timeout: 30000 });
});
