const { test, expect } = require("../../../support/fixtures");
const { gerarCnpj } = require("../../../support/cnpj");

function formatarCnpj(cnpj) {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12, 14)}`;
}

// Reaproveita o fluxo de criação do CT 7 (Lead CG Cloud) — cria um primeiro
// Lead com um CNPJ novo e tenta criar um segundo com o MESMO CNPJ.
test("bloqueia criação de Lead CG Cloud com CNPJ já usado por outro Lead", async ({ page }) => {
  test.setTimeout(90000);
  const cnpj = formatarCnpj(gerarCnpj());
  const sufixo = Date.now().toString().slice(-8);

  // Cria o primeiro Lead CG Cloud com esse CNPJ (fluxo mínimo, só até a
  // etapa de Sobrenome/Razão Social — não precisa completar o resto pra
  // este CNPJ já existir na base).
  await page.getByText("Leads", { exact: true }).click();
  await page.getByRole("button", { name: "Criar" }).click();
  await page.waitForTimeout(2000);
  await page.getByText("CG Cloud", { exact: true }).click({ force: true });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(1500);

  let cnpjInput = page.getByRole("textbox", { name: "CNPJ" });
  await cnpjInput.fill(cnpj);
  await cnpjInput.press("Tab");
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(3000);
  await page.getByRole("textbox", { name: "Sobrenome" }).fill(`Sobrenome CG Cloud ${sufixo}`);
  await page.getByRole("textbox", { name: "Razão Social" }).fill(`CG Cloud Teste ${sufixo}`);
  // Business Unit também é obrigatório nesta etapa (mesmo campo preenchido
  // no CT 7) — sem ele o botão "Salvar" fica desabilitado.
  const buInput = page.getByRole("combobox", { name: "Business Unit" });
  await buInput.click();
  await buInput.fill("03");
  await page.waitForTimeout(2000);
  await page.getByText("03 - Varejo Independente").click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page).toHaveURL(/\/lightning\/r\/(Lead\/)?00Q\w+\/view/, { timeout: 30000 });

  // Tenta criar um SEGUNDO Lead CG Cloud com o MESMO CNPJ.
  await page.getByText("Leads", { exact: true }).click();
  await page.getByRole("button", { name: "Criar" }).click();
  await page.waitForTimeout(2000);
  await page.getByText("CG Cloud", { exact: true }).click({ force: true });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(1500);

  cnpjInput = page.getByRole("textbox", { name: "CNPJ" });
  await cnpjInput.fill(cnpj);
  await cnpjInput.press("Tab");
  await page.waitForTimeout(3000);

  // Mensagem real documentada em support/cnpj.js (comentário original do
  // projeto) — o Salesforce trava a duplicidade nesse ponto do wizard, antes
  // mesmo de chegar na etapa de Sobrenome/Razão Social.
  await expect(page.getByText("Lead já existe em nossa base de dados").first()).toBeVisible({ timeout: 10000 });
});
