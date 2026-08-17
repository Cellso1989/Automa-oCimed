// Gera massa de teste: cria um novo Lead CG Cloud, preenche TODOS os campos
// válidos (cadastral, fiscal, financeira, logística, contatos) e aprova a
// Análise Cadastral como Mayssara — parando propositalmente em "Análise
// Fiscal", pronto pra o CT 11 (ou aprovação manual) continuar.
//
// Uso: node scripts/criar-massa-cg-cloud.js
const { chromium } = require("@playwright/test");
const { soapLogin } = require("../support/soapLogin");
const https = require("https");
const {
  selecionarViaPesquisaAvancada,
  selecionarPicklist,
  aprovarComoMayssara,
} = require("../support/leadHelpers");
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

const CNPJ = gerarCnpjValido();

function apiPatch(instanceHost, sessionId, path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: instanceHost,
        path,
        method: "PATCH",
        headers: { Authorization: "Bearer " + sessionId, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) },
      },
      (res) => {
        let respData = "";
        res.on("data", (c) => (respData += c));
        res.on("end", () => resolve({ status: res.statusCode, body: respData }));
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function editarTexto(page, nomeCampo, valor) {
  await page.getByRole("button", { name: `Editar ${nomeCampo}`, exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole("textbox", { name: nomeCampo, exact: true }).fill(valor);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(1500);
}

async function editarPicklist(page, nomeCampo, valor) {
  await page.getByRole("button", { name: `Editar ${nomeCampo}`, exact: true }).click();
  await page.waitForTimeout(800);
  const combo = page.getByRole("combobox", { name: nomeCampo, exact: true });
  await combo.click();
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: valor, exact: true }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(1500);
}

// Não fecha o browser — reaproveitado por scripts/criar-e-converter-lead.js
// pra continuar o fluxo até a conversão. Uso standalone via CLI em main().
async function criarEAprovarCadastral({ headless = false } = {}) {
  const sfSession = await soapLogin({
    username: env.sfUsername,
    password: env.sfPassword,
    securityToken: env.sfSecurityToken || "",
  });
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`https://${sfSession.instanceHost}/secur/frontdoor.jsp?sid=${sfSession.sessionId}`);
  await page.goto(`https://${sfSession.instanceHost}/lightning/page/home`);
  await page.waitForURL(/\/lightning\//, { timeout: 60000 });

  // --- Criação do Lead (CG Cloud) ---
  await page.getByText("Leads", { exact: true }).click();
  await page.getByRole("button", { name: "Criar" }).click();
  await page.waitForTimeout(2000);
  await page.getByText("CG Cloud", { exact: true }).click({ force: true });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(1500);

  const cnpjInput = page.getByRole("textbox", { name: "CNPJ" });
  await cnpjInput.fill(CNPJ);
  await cnpjInput.press("Tab");
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(3000);

  const sufixo = Date.now().toString().slice(-8);
  const sobrenome = `Sobrenome CG Cloud ${sufixo}`;
  const razaoSocial = `CG Cloud Teste ${sufixo}`;
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
  await page.waitForURL(/\/lightning\/r\/(Lead\/)?00Q\w+\/view/, { timeout: 30000 });
  const leadId = page.url().match(/00Q\w+/)[0];
  console.log("LEAD_ID::" + leadId);
  await page.waitForTimeout(2000);

  // --- Campos básicos (Endereço/CEP/Bairro/Inscrição Estadual) ---
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.waitForTimeout(2000);
  await page.getByRole("textbox", { name: "Endereço de Faturamento" }).fill("Duque de caxias");
  await page.getByRole("textbox", { name: "CEP", exact: true }).fill("09890-340");
  await page.getByRole("textbox", { name: "Bairro", exact: true }).fill("Planalto");
  await page.getByRole("textbox", { name: "Inscrição Estadual" }).fill("720563016313");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(2500);

  // --- Análise Cadastral ---
  await editarTexto(page, "Parceiro de Negócios Vendedor", "H01_SD100");
  await editarPicklist(page, "Situação AFE/AE", "Regular");
  await editarPicklist(page, "Grupo do cliente", "04-Farmácias");
  await editarPicklist(page, "Conta do Cliente", "ZMED");

  await page.getByRole("button", { name: "Editar Warehouse", exact: true }).click();
  await page.waitForTimeout(800);
  await selecionarViaPesquisaAvancada(page, "Warehouse", "SP");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(1500);

  // --- Análise Fiscal ---
  await editarPicklist(page, "Setor Industrial", "0001");
  await editarPicklist(page, "Categoria CFOP do cliente", "0");
  await editarPicklist(page, "Classificação fiscal", "1");
  await editarPicklist(page, "Esquema cliente", "1");
  await editarPicklist(page, "Descrição Contribuinte ICMS", "Não contribuinte");
  await editarTexto(page, "Categoria de lista de preços", "18");

  // --- Análise Logística ---
  await editarPicklist(page, "UF", "SP");
  await editarTexto(page, "Cidade", "Sao paulo");
  await editarTexto(page, "Zona de Transporte", "ZDBRSP-509");
  await editarTexto(page, "Partner", "501372");

  // --- Campos de contato/entrada exigidos pelo processo de aprovação ---
  await editarTexto(page, "Número Endereço", "100");
  await page.getByRole("button", { name: "Editar Telefone", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByRole("textbox", { name: "Telefone", exact: true }).fill("(11) 2995-4308");
  await page.getByRole("textbox", { name: "Celular", exact: true }).fill("(11) 99345-6115");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(1500);
  await editarTexto(page, "E-MAIL Cobrança", "financeiro@cgcloudteste.com.br");
  await editarTexto(page, "E-mail envio NF-e (XML e PDF)", "nfe@cgcloudteste.com.br");
  await editarPicklist(page, "Validade de lote que o cliente aceita?", "Qualquer validade");
  await editarPicklist(page, "Forma de Contato Padrão", "e-mail");

  console.log("todos os campos preenchidos");

  // --- Checkboxes de documento anexado + Cadeira (Org Unit) — via API,
  // mecanismo de UI ainda não identificado pra nenhum dos dois. Cadeira é
  // obrigatória pra converter (mesmo não aparecendo em nenhuma tela de
  // edição normal do Lead) — sem ela a conversão falha com "O campo
  // Cadeira (Org Unit) está vazio", confirmado testando um Lead fresco sem
  // esse campo. "H01_SP100" (Id a3NU40000000ZVnMAM) é uma Cadeira real de
  // SP, mesmo padrão de código do Warehouse/Parceiro já usado pra CG Cloud.
  await apiPatch(sfSession.instanceHost, sfSession.sessionId, `/services/data/v60.0/sobjects/Lead/${leadId}`, {
    AFE_anexado__c: true,
    Alvara_Sanitario_anexado__c: true,
    CRF_anexado__c: true,
    Contrato_Social_anexado__c: true,
    Cadeira_Org_Unit__c: "a3NU40000000ZVnMAM",
  });
  console.log("checkboxes de documento e Cadeira (Org Unit) marcados via API");

  // --- Avança Status pra "Pronto para Aprovação" ---
  await page.goto(`https://${sfSession.instanceHost}/lightning/r/Lead/${leadId}/view`);
  await page.waitForTimeout(3000);
  await page.getByRole("option", { name: /Pronto para Apro/ }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Marcar como Status atual" }).click();
  await page.waitForTimeout(2500);

  // --- Envia para aprovação ---
  await page.getByRole("button", { name: "Enviar para aprovação" }).click();
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await page.waitForTimeout(3000);
  console.log("enviado para aprovação");

  // --- Aprova a Análise Cadastral como Mayssara (para em Análise Fiscal) ---
  await aprovarComoMayssara(page, sfSession, leadId);
  console.log("Análise Cadastral aprovada como Mayssara — Lead deve estar em Análise Fiscal");

  return { sfSession, browser, page, leadId };
}

async function main() {
  const { browser } = await criarEAprovarCadastral();
  await browser.close();
}

module.exports = { criarEAprovarCadastral };

if (require.main === module) {
  main();
}
