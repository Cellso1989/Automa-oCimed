// Cria um novo Lead do tipo pedido (Cimed Tech, Hospitalar ou Milimetric),
// preenche a Análise Cadastral com valores reais e aprova como Mayssara,
// deixando pronto em "Análise Fiscal" pro CT 9/10/12 (ou aprovação manual)
// continuar.
//
// Uso:
//   node scripts/criar-massa-lead.js "Cimed Tech"
//   node scripts/criar-massa-lead.js "Hospitalar"
//   node scripts/criar-massa-lead.js "Milimetric"
const { chromium } = require("@playwright/test");
const { soapLogin } = require("../support/soapLogin");
const { selecionarViaPesquisaAvancada, selecionarPicklist, aprovarComoMayssara } = require("../support/leadHelpers");
const env = require("../env.json");

// SAP exige CNPJ (STCD1) como campo obrigatório de entrada — sem ele a
// integração falha com "Nº ID fiscal 1 (KNA1-STCD1) é um campo de entrada
// obrigatório", mesmo o Lead tendo convertido normalmente no Salesforce.
// Cimed Tech/Milimetric são criados pelo fluxo simples (Sobrenome+Empresa,
// sem pedir CNPJ de cara como CG Cloud/Hospitalar), então precisa preencher
// à parte, na Análise Cadastral.
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

// Parceiro de Negócios Vendedor e busca de Warehouse por tipo — valores
// reais confirmados via SOQL em Leads já convertidos (ver
// support/leadHelpers.js / VALORES_FISCAL_POR_TIPO pros campos de
// Fiscal/Financeira/Logística, preenchidos depois pelo CT correspondente).
const DADOS_CADASTRAL_POR_TIPO = {
  "Cimed Tech": { parceiro: "H07_IS306", warehouseBusca: "SP", contaDoCliente: "ZMED", grupoDoCliente: "01-Grandes contas" },
  Hospitalar: { parceiro: "H01_SD100", warehouseBusca: "CONTAGEM", contaDoCliente: "ZMED", grupoDoCliente: "01-Grandes contas" },
  // Warehouse é preenchido depois por completarFiscalLogisticaEConverter
  // (exigido pela validação de conversão, mesmo Leads reais tendo esse campo
  // vazio — ver CAMPOS_CONVERSAO_POR_TIPO em support/leadHelpers.js).
  Milimetric: { parceiro: "H15_BR001", warehouseBusca: null, contaDoCliente: "ZOUT", grupoDoCliente: "03- Especializados" },
};

// Cria + preenche a Análise Cadastral + aprova como Mayssara. Não fecha o
// browser (quem chamou decide o que fazer a seguir e quando fechar) —
// reaproveitado por scripts/criar-e-converter-lead.js pra continuar o fluxo
// até a conversão, além do uso standalone via CLI (ver main() no fim).
async function criarEAprovarCadastral(tipoRegistro, { headless = false } = {}) {
  const dados = DADOS_CADASTRAL_POR_TIPO[tipoRegistro];
  if (!dados) {
    throw new Error(`Tipo "${tipoRegistro}" não suportado. Use "Cimed Tech", "Hospitalar" ou "Milimetric".`);
  }

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

  await page.getByText("Leads", { exact: true }).click();
  await page.getByRole("button", { name: "Criar" }).click();
  await page.waitForTimeout(1500);
  // "Cimed Tech" já vem pré-selecionado; os demais tipos precisam do clique
  // no radio (o input nativo fica escondido atrás do texto, precisa force).
  if (tipoRegistro !== "Cimed Tech") {
    await page.getByText(tipoRegistro, { exact: true }).click({ force: true });
  }
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.waitForTimeout(1500);

  const sufixo = Date.now().toString().slice(-8);
  const sobrenome = `Sobrenome ${tipoRegistro} ${sufixo}`;
  const empresa = `Empresa Teste ${tipoRegistro} ${sufixo}`;
  await page.getByRole("textbox", { name: "Sobrenome" }).fill(sobrenome);
  await page.getByRole("textbox", { name: "Empresa", exact: true }).fill(empresa);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForURL(/\/lightning\/r\/(Lead\/)?00Q\w+\/view/, { timeout: 30000 });
  const leadId = page.url().match(/00Q\w+/)[0];
  console.log("LEAD_ID::" + leadId);
  await page.waitForTimeout(2000);

  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.waitForTimeout(2000);

  await page.getByRole("textbox", { name: "Endereço de Faturamento" }).fill("Rua Teste, 123");
  await page.getByRole("textbox", { name: "CEP", exact: true }).fill("01310-100");
  await page.getByRole("textbox", { name: "Bairro", exact: true }).fill("Bairro Teste");
  await page.getByRole("textbox", { name: "Cidade", exact: true }).fill("São Paulo");
  // E-MAIL Cobrança / Email: SEM esses campos o SAP rejeita a criação do
  // cliente ("Erro - E-mail COB Incorreto"/"Erro - E-mail Incorreto"),
  // mesmo com a conversão do Lead em si tendo funcionado (Account criada,
  // mas com Status_Integracao__c = "Falha na Integração"). Descoberto
  // analisando Log_Integracao__c de massa gerada sem esses campos.
  const emailCobranca = page.getByRole("textbox", { name: "E-MAIL Cobrança" });
  if (await emailCobranca.count()) {
    await emailCobranca.fill(`financeiro@${tipoRegistro.toLowerCase().replace(/\s/g, "")}teste.com.br`);
  }
  const emailNfe = page.getByRole("textbox", { name: "E-mail envio NF-e (XML e PDF)" });
  if (await emailNfe.count()) {
    await emailNfe.fill(`nfe@${tipoRegistro.toLowerCase().replace(/\s/g, "")}teste.com.br`);
  }
  const cnpj = page.getByRole("textbox", { name: "CNPJ", exact: true });
  if (await cnpj.count()) {
    await cnpj.fill(gerarCnpjValido());
  }
  // Nem todos os campos existem em todos os Tipos de Registro (ex.:
  // Milimetric não tem "Documentos Faltantes") — preenche só se existir.
  const preencherSeExistir = async (nomeCampo, valor) => {
    const campo = page.getByRole("textbox", { name: nomeCampo, exact: true });
    if (await campo.count()) await campo.fill(valor);
  };
  const selecionarSeExistir = async (nomeCampo, valor) => {
    const campo = page.getByRole("combobox", { name: nomeCampo, exact: true });
    if (!(await campo.count())) return;
    try {
      await selecionarPicklist(page, nomeCampo, valor);
    } catch {
      // Opção não existe nesse Tipo de Registro (picklists variam por tipo)
      // — Tab tira o foco do dropdown e fecha o listbox sem depender de
      // outro elemento estar visível (diferente de clicar em texto da
      // página, que já causou timeout em cascata aqui antes).
      console.warn(`Aviso: opção "${valor}" não encontrada em "${nomeCampo}" — campo deixado em branco.`);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(500);
    }
  };

  await preencherSeExistir("Parceiro de Negócios Vendedor", dados.parceiro);
  await preencherSeExistir("Número AE", "AE001");
  await preencherSeExistir("Nome Farmacêutico Responsável", "Farmacêutico Teste");
  await preencherSeExistir("Número CRF Farmacêutico Responsável", "CRF001");
  await preencherSeExistir("Data de vencimento CRF", "31/12/2030");
  await preencherSeExistir("Documentos Faltantes", "Nenhum");
  await preencherSeExistir("Número Alvará Sivisa", "SIVISA001");
  await preencherSeExistir("Data de Vencimento Alvará Sivisa", "31/12/2030");

  await selecionarSeExistir("Situação AFE/AE", "Regular");
  await selecionarSeExistir("Classe do cliente", "01- Grandes Redes");
  await selecionarSeExistir("Grupo do cliente", dados.grupoDoCliente);
  await selecionarSeExistir("Pode comprar medicamento controlado", "Não");
  await selecionarSeExistir("Conta do Cliente", dados.contaDoCliente);

  // Business Unit "01 - Contas Nacionais" não tem preço cadastrado (achado
  // manual confirmado) — usar "03 - Varejo Independente" em vez disso.
  await selecionarViaPesquisaAvancada(page, "Business Unit", "03");
  if (dados.warehouseBusca) {
    await selecionarViaPesquisaAvancada(page, "Warehouse", dados.warehouseBusca);
  }

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(3000);

  await page.getByRole("button", { name: "Enviar para aprovação" }).click();
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await page.waitForTimeout(3000);
  console.log("enviado para aprovação");

  await aprovarComoMayssara(page, sfSession, leadId);
  console.log(`Análise Cadastral aprovada como Mayssara — Lead ${tipoRegistro} deve estar em Análise Fiscal`);

  return { sfSession, browser, page, leadId };
}

async function main() {
  const tipoRegistro = process.argv[2];
  if (!DADOS_CADASTRAL_POR_TIPO[tipoRegistro]) {
    console.error(`Uso: node scripts/criar-massa-lead.js "<Cimed Tech|Hospitalar|Milimetric>"`);
    process.exit(1);
  }
  const { browser } = await criarEAprovarCadastral(tipoRegistro);
  await browser.close();
}

module.exports = { criarEAprovarCadastral, DADOS_CADASTRAL_POR_TIPO };

if (require.main === module) {
  main();
}
