// Cria um Lead Hospitalar (fluxo CNPJ-primeiro, igual CG Cloud) e preenche a
// Análise Cadastral com valores reais.
const { chromium } = require("@playwright/test");
const { soapLogin } = require("../support/soapLogin");
const { selecionarPicklist, aprovarComoMayssara } = require("../support/leadHelpers");
const env = require("../env.json");

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

async function editarTexto(page, nomeCampo, valor) {
  await page.getByRole("button", { name: `Editar ${nomeCampo}`, exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole("textbox", { name: nomeCampo, exact: true }).fill(valor);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(1500);
}

async function main() {
  const sfSession = await soapLogin({
    username: env.sfUsername,
    password: env.sfPassword,
    securityToken: env.sfSecurityToken || "",
  });
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`https://${sfSession.instanceHost}/secur/frontdoor.jsp?sid=${sfSession.sessionId}`);
  await page.goto(`https://${sfSession.instanceHost}/lightning/page/home`);
  await page.waitForURL(/\/lightning\//, { timeout: 60000 });

  await page.getByText("Leads", { exact: true }).click();
  await page.getByRole("button", { name: "Criar" }).click();
  await page.waitForTimeout(1500);
  await page.getByText("Hospitalar", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(2000);

  const cnpjInput = page.getByRole("textbox", { name: "CNPJ" });
  await cnpjInput.fill(gerarCnpjValido());
  await cnpjInput.press("Tab");
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(3000);

  const sufixo = Date.now().toString().slice(-8);
  await page.getByRole("textbox", { name: "Sobrenome" }).fill(`Sobrenome Hospitalar ${sufixo}`);
  await page.getByRole("textbox", { name: "Razão Social" }).fill(`Hospitalar Teste ${sufixo}`);

  // Business Unit "01 - Contas Nacionais" não tem preço cadastrado (achado
  // manual confirmado) — usar "03 - Varejo Independente" em vez disso.
  const buInput = page.getByRole("combobox", { name: "Business Unit" });
  await buInput.click();
  await buInput.fill("03");
  await page.waitForTimeout(2000);
  await page.getByText("03 - Varejo Independente").click();
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForURL(/\/lightning\/r\/(Lead\/)?00Q\w+\/view/, { timeout: 30000 });
  const leadId = page.url().match(/00Q\w+/)[0];
  console.log("LEAD_ID::" + leadId);
  await page.waitForTimeout(2000);

  // Warehouse (CIMED CONTAGEM) já vem preenchido automaticamente. Falta
  // Parceiro de Negócios Vendedor (Análise Cadastral).
  await editarTexto(page, "Parceiro de Negócios Vendedor", "H01_SD100");

  // Avança Status de "Rascunho" pra "Pronto para Aprovação" — sem isso o
  // "Enviar para aprovação" falha com "Nenhum processo de aprovação
  // aplicável" (mesmo comportamento visto no CG Cloud).
  await page.goto(`https://${sfSession.instanceHost}/lightning/r/Lead/${leadId}/view`);
  await page.waitForTimeout(3000);
  await page.getByRole("option", { name: /Pronto para Apro/ }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Marcar como Status atual" }).click();
  await page.waitForTimeout(2500);

  await page.getByRole("button", { name: "Enviar para aprovação" }).click();
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await page.waitForTimeout(3000);
  console.log("enviado para aprovação");

  await aprovarComoMayssara(page, sfSession, leadId);
  console.log("Análise Cadastral aprovada como Mayssara — Lead Hospitalar deve estar em Análise Fiscal");

  await browser.close();
}
main();
