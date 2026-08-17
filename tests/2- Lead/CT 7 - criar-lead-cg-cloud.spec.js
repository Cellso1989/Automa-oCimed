const { test, expect } = require("../../support/fixtures");
const { selecionarViaPesquisaAvancada } = require("../../support/leadHelpers");
const { gerarCnpj } = require("../../support/cnpj");
const https = require("https");

function formatarCnpj(cnpj) {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12, 14)}`;
}

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

// Cria o Lead CG Cloud e completa TODOS os campos exigidos pelos critérios
// de entrada do processo de aprovação (Cadastral + Fiscal + Logística +
// contato + documentos anexados) — sem enviar para aprovação nem aprovar.
//
// Diferente de Cimed Tech/Milimetric/Hospitalar, CG Cloud usa o fluxo
// CNPJ-primeiro (pede o CNPJ antes de Sobrenome/Razão Social, numa etapa
// própria do wizard).
//
// IMPORTANTE: confirmado manualmente que preencher só a Análise Cadastral
// (como nos outros 3 tipos) NÃO é suficiente pra esse tipo — tentar "Enviar
// para aprovação" com só a Cadastral preenchida não faz nada (Status
// continua "Rascunho", Histórico de aprovação continua vazio, sem erro
// visível na tela). O processo de aprovação do CG Cloud exige também os
// campos de Fiscal/Logística, telefone/e-mail e os documentos marcados
// como anexados — por isso preenche tudo isso aqui também (mesmos campos
// de scripts/criar-massa-cg-cloud.js), garantindo que o Lead fica
// realmente pronto pra ser enviado depois.
test("cria um Lead CG Cloud com todos os campos exigidos pela aprovação preenchidos", async ({ page, sfSession }) => {
  test.setTimeout(150000);
  const cnpj = formatarCnpj(gerarCnpj());
  const sufixo = Date.now().toString().slice(-8);
  const sobrenome = `Sobrenome CG Cloud ${sufixo}`;
  const razaoSocial = `CG Cloud Teste ${sufixo}`;

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
  const leadId = page.url().match(/00Q\w+/)[0];

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

  // --- Checkboxes de documento anexado (via API — mecanismo de UI ainda
  // não identificado, ver scripts/criar-massa-cg-cloud.js) ---
  await apiPatch(sfSession.instanceHost, sfSession.sessionId, `/services/data/v60.0/sobjects/Lead/${leadId}`, {
    AFE_anexado__c: true,
    Alvara_Sanitario_anexado__c: true,
    CRF_anexado__c: true,
    Contrato_Social_anexado__c: true,
  });

  // --- Avança o Status (Caminho) pra "Pronto para Aprovação" ---
  // Confirmado que sem isso "Enviar para aprovação" não faz nada (Status
  // continua "Rascunho", Histórico de aprovação continua vazio, sem erro
  // visível) — mesmo com todos os campos acima preenchidos. É o critério de
  // entrada real do processo de aprovação do CG Cloud, não os campos em si.
  await page.goto(`https://${sfSession.instanceHost}/lightning/r/Lead/${leadId}/view`);
  await page.waitForTimeout(3000);
  await page.getByRole("option", { name: /Pronto para Apro/ }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Marcar como Status atual" }).click();
  await page.waitForTimeout(2500);

  // Confirma que os dados persistiram de verdade (não só que os cliques em
  // "Salvar" aconteceram).
  await expect(page.getByText("H01_SD100")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Regular")).toBeVisible();
  await expect(page.getByRole("option", { name: /Pronto para Apro/ })).toHaveAttribute("aria-selected", "true", {
    timeout: 15000,
  });
  expect(leadId).toMatch(/^00Q/);
});
