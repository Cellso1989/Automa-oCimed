// Helpers compartilhados entre os specs de Lead (CT 4-12).

// Campo oculto (não aparece em nenhuma tela de edição normal do Lead) exigido
// pela validação de conversão pra TODO Tipo de Registro — descoberto primeiro
// em CG Cloud ("O campo Cadeira (Org Unit) está vazio."), depois confirmado
// que também bloqueia Cimed Tech e Milimetric (ver relatório de execução da
// suíte de 2026-08-16). Só existe um jeito conhecido de preenchê-lo: API
// PATCH direto no Lead (mesmo mecanismo já usado em
// scripts/criar-massa-cg-cloud.js pros checkboxes de documento anexado).
// "a3NU40000000ZVnMAM" = "H01_SP100", uma Cadeira real de SP.
const CADEIRA_ORG_UNIT_ID = "a3NU40000000ZVnMAM";

function apiPatch(instanceHost, sessionId, path, body) {
  const https = require("https");
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

// Preenche o campo Cadeira (Org Unit) via API — pré-requisito pra conversão
// real de QUALQUER Tipo de Registro, não só CG Cloud.
async function preencherCadeiraOrgUnit(sfSession, leadId) {
  await apiPatch(sfSession.instanceHost, sfSession.sessionId, `/services/data/v60.0/sobjects/Lead/${leadId}`, {
    Cadeira_Org_Unit__c: CADEIRA_ORG_UNIT_ID,
  });
}

// Marca os checkboxes de documento anexado via API — sem mecanismo de UI
// identificado pra eles (mesmo padrão já usado em
// scripts/criar-massa-cg-cloud.js). Não confundir com anexar um arquivo de
// verdade: a validação de "Marcar Status" do Hospitalar também exige
// "anexos" reais, que esses booleans sozinhos não substituem.
//
// `sessionId` opcional: pra Hospitalar, o usuário pediu que esses campos
// fiquem atribuídos à Nicole (quem realmente cria o Lead), não ao usuário de
// automação — passe o sessionId dela (ver
// `obterSessionIdDoUsuarioImpersonado` em userHelpers.js) pra isso. Sem
// passar, usa `sfSession.sessionId` (comportamento antigo, usado por CG
// Cloud).
async function preencherAnexosDocumento(sfSession, leadId, sessionId = sfSession.sessionId) {
  await apiPatch(sfSession.instanceHost, sessionId, `/services/data/v60.0/sobjects/Lead/${leadId}`, {
    AFE_anexado__c: true,
    Alvara_Sanitario_anexado__c: true,
    CRF_anexado__c: true,
    Contrato_Social_anexado__c: true,
  });
}

// Busca "Business Unit"/"Warehouse" via pesquisa avançada (a busca rápida do
// lookup não retorna opção direta pra esses dois campos nesta org — só
// "Exibir mais resultados") e seleciona o primeiro resultado por radio button.
async function selecionarViaPesquisaAvancada(page, nomeCampo, termoBusca) {
  const combo = page.getByRole("combobox", { name: nomeCampo });
  await combo.scrollIntoViewIfNeeded();
  await combo.click();
  await combo.pressSequentially(termoBusca, { delay: 150 });
  await page.waitForTimeout(1500);

  // Escopado no listbox deste campo específico (via aria-controls) — várias
  // instâncias de "Exibir mais resultados" ficam na página ao mesmo tempo
  // (uma por campo já pesquisado), então buscar pelo texto solto no
  // documento inteiro pega a errada.
  const listboxId = await combo.getAttribute("aria-controls");
  await page.locator(`#${listboxId}`).getByText(/Exibir mais resultados/).click();
  await page.waitForTimeout(1500);

  await page.getByRole("dialog", { name: "Pesquisa avançada" }).getByRole("button", { name: "Pesquisar" }).click();
  await page.waitForTimeout(2500);
  // O input radio real fica escondido atrás do span estilizado
  // (.slds-radio_faux) — clicar no input direto (mesmo com force) não
  // dispara o handler interno do componente; precisa clicar no span visível.
  await page.getByRole("dialog", { name: "Pesquisa avançada" }).locator(".slds-radio_faux").first().click({ force: true });
  await page.getByRole("dialog", { name: "Pesquisa avançada" }).getByRole("button", { name: "Selecionar" }).click();
}

// Picklists simples (Setor Industrial, UF etc.) são combobox customizados do
// Lightning, não <select> nativos — precisa abrir e clicar na opção. Em
// formulários longos (ex.: Milimetric, com muitas seções) o dropdown demora
// mais pra renderizar as opções do que os 300ms originais.
//
// A tela às vezes re-renderiza no meio da interação (autosave/validação de
// outro campo) e fecha o dropdown já aberto — se isso acontecer bem no
// momento do clique, a opção nunca mais reaparece e um clique único fica
// esperando por ela indefinidamente (travado até estourar o timeout do
// teste inteiro). Por isso reabre o combobox a cada tentativa (mesmo padrão
// já validado em selectLookupOption/lookup.js) em vez de confiar num único
// clique.
async function selecionarPicklist(page, nomeCampo, valor, { tentativas = 3 } = {}) {
  const combo = page.getByRole("combobox", { name: nomeCampo, exact: true });
  const opcao = page.getByRole("option", { name: valor, exact: true });
  await combo.scrollIntoViewIfNeeded();

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    await combo.click();
    try {
      await opcao.waitFor({ state: "visible", timeout: 5000 });
      await opcao.click();
      return;
    } catch (erro) {
      if (tentativa === tentativas) throw erro;
    }
  }
}

// Bloco de campos da Análise Cadastral repetido em todo spec que cria/edita
// um Lead até essa etapa (CT 4, CT 6, CT 8) — extraído aqui pra evitar que
// uma mudança de layout no Salesforce precise ser replicada em cada spec
// manualmente. O Lead precisa já estar em modo de edição (botão "Editar" já
// clicado) antes de chamar isso.
//
// `parceiro` varia por Tipo de Registro (ex.: "H07_IS306" pra Cimed Tech,
// "H01_SD100" pra Hospitalar — códigos reais de Parceiro de Negócios
// Vendedor, não intercambiáveis).
//
// `incluirBusinessUnitWarehouse` é false pro fluxo CNPJ-primeiro (Hospitalar/
// CG Cloud): Business Unit já foi definido no wizard de criação e Warehouse
// já vem pré-selecionado por padrão pro Tipo de Registro — reabrir a busca
// avançada num campo já preenchido rompe o fluxo (ver nota em
// completarFiscalLogisticaEConverter sobre o mesmo problema).
async function completarAnaliseCadastralComum(page, { parceiro, incluirBusinessUnitWarehouse = true }) {
  await page.getByRole("textbox", { name: "Endereço de Faturamento" }).fill("Rua Teste, 123");
  await page.getByRole("textbox", { name: "CEP", exact: true }).fill("01310-100");
  await page.getByRole("textbox", { name: "Bairro", exact: true }).fill("Bairro Teste");
  await page.getByRole("textbox", { name: "Cidade", exact: true }).fill("São Paulo");
  await page.getByRole("textbox", { name: "Parceiro de Negócios Vendedor" }).fill(parceiro);
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

  if (incluirBusinessUnitWarehouse) {
    // Business Unit "01 - Contas Nacionais" não tem preço cadastrado (achado
    // manual confirmado) — usar "03 - Varejo Independente" em vez disso.
    await selecionarViaPesquisaAvancada(page, "Business Unit", "03");
    await selecionarViaPesquisaAvancada(page, "Warehouse", "SP");
  }
}

// Preenche o formulário de edição do Lead Hospitalar quando logado como
// NICOLE GOMES AMARAL (Profile "Faturamento") — ver nota no CT 6. O layout
// dela é DIFERENTE do layout visto pelo usuário de automação: em vez de
// Cadastral/Fiscal/Logística em telas/etapas separadas, é um único formulário
// grande com todos os campos juntos (inclusive "Forma de Contato Padrão",
// ausente no layout do usuário de automação — essa é a causa raiz do
// bloqueio documentado no README). O Lead precisa já estar em modo de edição
// (botão "Editar" já clicado) antes de chamar isso.
//
// Valores baseados no único Lead Hospitalar convertido de verdade analisado
// via SOQL até agora (segmento "Órgão Público") — `grupoDoCliente`,
// `tipoEntidadeGovernamental` etc. podem não generalizar para Hospitalar
// fora desse segmento; ajustar se um Lead não-governamental convertido for
// analisado depois.
async function completarAnaliseCadastralHospitalarComoNicole(page) {
  await page.getByRole("textbox", { name: "Endereço de Faturamento" }).fill("Rua Teste, 123");
  await page.getByRole("textbox", { name: "Complemento" }).fill("Sala 1");
  await page.getByRole("textbox", { name: "Número Endereço" }).fill("123");
  await page.getByRole("textbox", { name: "Bairro", exact: true }).fill("Bairro Teste");
  await page.getByRole("textbox", { name: "CEP", exact: true }).fill("01310-100");
  await page.getByRole("textbox", { name: "Telefone", exact: true }).fill("(11) 3055-0100");
  await page.getByRole("textbox", { name: "Telefone Cobrança" }).fill("(11) 3055-0100");
  await page.getByRole("textbox", { name: "Celular" }).fill("(11) 98888-0000");
  await page.getByRole("textbox", { name: "Inscrição Estadual" }).fill("ISENTO");
  await page.getByRole("textbox", { name: "E-MAIL Cobrança" }).fill("leadteste@teste.com");
  await page.getByRole("textbox", { name: "E-mail envio NF-e (XML e PDF)" }).fill("leadteste@teste.com");
  await page.getByRole("textbox", { name: "Email", exact: true }).fill("leadteste@teste.com");
  await page.getByRole("textbox", { name: "Parceiro de Negócios Vendedor" }).fill("H01_SD100");
  await page.getByRole("textbox", { name: "Número AE" }).fill("AE001");
  await page.getByRole("textbox", { name: "Nome Farmacêutico Responsável" }).fill("Farmacêutico Teste");
  await page.getByRole("textbox", { name: "Número CRF Farmacêutico Responsável" }).fill("CRF001");
  await page.getByRole("textbox", { name: "Data de vencimento CRF" }).fill("31/12/2030");
  await page.getByRole("textbox", { name: "Número Alvará Sivisa" }).fill("SIVISA001");
  await page.getByRole("textbox", { name: "Data de Vencimento Alvará Sivisa" }).fill("31/12/2030");
  await page.getByRole("textbox", { name: "Categoria de lista de preços" }).fill("18");
  await page.getByRole("textbox", { name: "Cidade", exact: true }).fill("São Paulo");
  await page.getByRole("textbox", { name: "Zona de Transporte" }).fill("ZDBRSP-129");
  await page.getByRole("textbox", { name: "Partner", exact: true }).fill("501537");

  await selecionarPicklist(page, "Situação AFE/AE", "Regular");
  await selecionarPicklist(page, "Classe do cliente", "04-Hospitalar");
  await selecionarPicklist(page, "Pode comprar medicamento controlado", "Não");
  await selecionarPicklist(page, "Conta do Cliente", "ZMED");
  await selecionarPicklist(page, "Grupo do cliente", "07- Órgão público");
  await selecionarPicklist(page, "Setor Industrial", "0001");
  await selecionarPicklist(page, "Categoria CFOP do cliente", "0");
  await selecionarPicklist(page, "Classificação fiscal", "1");
  await selecionarPicklist(page, "Descrição Contribuinte ICMS", "Não contribuinte");
  await selecionarPicklist(page, "Grupo de substituição fiscal", "001");
  await selecionarPicklist(page, "Esquema cliente", "1");
  await selecionarPicklist(page, "UF", "SP");
  await selecionarPicklist(page, "Validade de lote que o cliente aceita?", "Qualquer validade");
  await selecionarPicklist(page, "Forma de Contato Padrão", "e-mail");
  await page.getByRole("checkbox", { name: "Aceita contato por e-mail?" }).check();

  // "Tipo Entidade Governamental" (LEGAL_ENTY no payload SAP) — sem ele, a
  // integração falha com "Indicar a chave completa para a área de vendas"
  // junto com o Business Unit errado (ver comentário em
  // criarLeadHospitalarComoNicoleAteAnaliseCadastral). "Consórcio Público"
  // (value "05") é o valor confirmado no único Lead Hospitalar convertido
  // com integração SAP bem-sucedida analisado até agora.
  await selecionarPicklist(page, "Tipo Entidade Governamental", "Consórcio Público");

  // "Segmento" (default do wizard de criação é "Farmácia/Distribuidor
  // farmacêutico") — pedido do usuário (2026-08-20): o Lead Hospitalar
  // precisa ser criado com "Órgão Público" ou "Distribuidor Hospitalar", não
  // com o default. Confirmado que "Órgão Público" já destrava o processo de
  // aprovação real (Histórico de aprovação deixa de ficar sempre em 0); o
  // usuário pediu pra usar "Distribuidor Hospitalar" especificamente.
  await selecionarPicklist(page, "Segmento", "Distribuidor Hospitalar");
}

function gerarCnpjValidoHospitalar() {
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

// Cria um Lead Hospitalar do zero como Nicole Gomes Amaral (fluxo
// CNPJ-primeiro), completa a Análise Cadastral com o layout dela e avança o
// Status até "Pronto para Aprovação" — extraído do CT 6
// (tests/2- Lead/CT 6 - criar-lead-hospitalar.spec.js) pra ser reaproveitado
// também por scripts de massa (ver scripts/criar-massa-hospitalar-nicole.js).
//
// DESCOBERTA-CHAVE (2026-08-20): com "Segmento" = "Distribuidor Hospitalar"
// (campo antes deixado no default errado "Farmácia/Distribuidor
// farmacêutico"), clicar "Marcar como Status atual" pra "Pronto para
// Aprovação" dispara sozinho uma aprovação REAL (cria um Histórico de
// aprovação de verdade, "Análise Cadastral" pendente) — o mesmo mecanismo
// que já funcionava pra Cimed Tech/Milimetric/CG Cloud. Antes disso, sem o
// Segmento certo, nenhuma aprovação real era criada, e por isso todo o resto
// do fluxo (Mayssara, Fiscal, conversão) tinha que ser simulado via
// truques de Status/path — não é mais necessário. Ver
// [[project_lead_hospitalar_nicole]] na memória do projeto pro raciocínio
// completo por trás de cada passo. Retorna o Id do Lead criado.
async function criarLeadHospitalarComoNicoleAteAnaliseCadastral(page, sfSession) {
  const { loginComoUsuario } = require("./userHelpers");
  await loginComoUsuario(page, sfSession, "Nicole Gomes Amaral");

  const cnpj = gerarCnpjValidoHospitalar();
  const sufixo = Date.now().toString().slice(-8);
  const sobrenome = `Sobrenome Hospitalar ${sufixo}`;
  const razaoSocial = `Hospitalar Teste ${sufixo}`;

  // Login As Nicole já abre direto no app "CIMED - Hospitalar" com a lista
  // de Leads ativa — não precisa navegar até "Leads" primeiro.
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

  await page.getByRole("textbox", { name: "Sobrenome" }).fill(sobrenome);
  await page.getByRole("textbox", { name: "Razão Social" }).fill(razaoSocial);

  // Diferente dos outros tipos (Cimed Tech/Milimetric/CG Cloud, onde "01 -
  // Contas Nacionais" não tem preço cadastrado e "03 - Varejo Independente"
  // é o substituto certo), pra Hospitalar o Business Unit certo é **"04 -
  // Hospitalar"** — descoberto comparando o JSON_Enviado__c de uma Conta
  // convertida com sucesso no SAP (VKORG/VWERK = "1014") contra uma que
  // falhou com "03 - Varejo Independente" (VKORG/VWERK vinham nulos, SAP
  // rejeitava com "Indicar a chave completa para a área de vendas" — a
  // configuração de Centro/Organização de Vendas do "03" não cobre
  // Hospitalar). Ver [[project_lead_hospitalar_nicole]].
  const buInput = page.getByRole("combobox", { name: "Business Unit" });
  await buInput.click();
  await buInput.pressSequentially("04", { delay: 150 });
  await page.waitForTimeout(2000);
  await page.getByText("04 - Hospitalar").click();
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForURL(/\/lightning\/r\/(Lead\/)?00Q\w+\/view/, { timeout: 30000 });
  const leadId = page.url().match(/00Q\w+/)[0];

  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.waitForTimeout(2000);
  await completarAnaliseCadastralHospitalarComoNicole(page);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(3000);

  // Pedido do usuário (2026-08-20) era atribuir esses checkboxes à Nicole —
  // testado e IMPOSSÍVEL: o profile dela ("Faturamento") não tem permissão
  // de escrita nesses campos nem via API (erro real:
  // "INVALID_FIELD_FOR_INSERT_UPDATE ... verify that it is read/write for
  // your profile or permission set"), consistente com o campo nem aparecer
  // no layout dela. Mantido com a sessão do usuário de automação.
  await preencherAnexosDocumento(sfSession, leadId);

  await page.goto(`https://${sfSession.instanceHost}/lightning/r/Lead/${leadId}/view`);
  await page.waitForTimeout(3000);
  await page.getByRole("option", { name: /Pronto para Apro/ }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Marcar como Status atual" }).click();
  await page.waitForTimeout(3000);

  // Com o Segmento certo, esse clique já dispara a aprovação real — o Status
  // (customizado) já reflete "Análise Cadastral" na sequência, com um
  // Histórico de aprovação de verdade pendente pra Mayssara (ver
  // `aprovarEtapaPendente`). Não precisa de mais nenhum clique de path aqui.

  return leadId;
}

// Abre um Lead com Status "Análise Fiscal" do Tipo de registro pedido. A
// lista de Leads da UI só mostra "Recentes" (nem toda a massa do sistema) e
// o layout de detalhes não expõe "Tipo de registro" como campo — por isso
// busca via API (SOQL) em vez de vasculhar a lista/abrir registro por
// registro.
async function abrirLeadEmAnaliseFiscalPorTipo(page, sfSession, tipoRegistro) {
  const { soqlQuery } = require("./soqlQuery");
  // ORDER BY CreatedDate DESC é essencial — pode haver vários Leads antigos
  // (de sessões de teste anteriores, possivelmente incompletos/sem campos
  // exigidos por regras de validação que mudaram desde então) parados nesse
  // Status. Sem isso, o SOQL pode devolver um registro arbitrário e
  // desatualizado em vez da massa fresca que acabou de ser gerada.
  //
  // IsConverted = false é essencial pro Hospitalar: descobrimos que o campo
  // Status (customizado) pode continuar em "Análise Fiscal" mesmo DEPOIS do
  // Lead já ter convertido de verdade (visto tanto em Leads reais de
  // produção quanto em massa de teste nossa) — sem esse filtro, essa query
  // pode pegar um Lead já convertido e quebrar tudo que vem depois.
  const resultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id FROM Lead WHERE Status = 'Análise Fiscal' AND RecordType.Name = '${tipoRegistro}' AND IsConverted = false ORDER BY CreatedDate DESC LIMIT 1`,
  });

  if (resultado.totalSize === 0) {
    throw new Error(
      `Nenhum Lead do tipo "${tipoRegistro}" encontrado com Status "Análise Fiscal" — sem massa disponível pra aprovar esse segmento ainda.`
    );
  }

  const leadId = resultado.records[0].Id;
  await page.goto(`https://${sfSession.instanceHost}/lightning/r/Lead/${leadId}/view`);
  await page.waitForTimeout(3000);
}

// Aprova a etapa pendente no "Histórico de aprovação" da página atual (o
// Lead precisa já estar aberto). Não assume que a próxima etapa some
// automaticamente — isso variou entre registros (alguns encadeiam pra
// "Análise Financeira" na hora, outros não) — quem chama confere o efeito
// que precisa.
async function aprovarEtapaPendente(page) {
  // .first(): em alguns layouts (Hospitalar) existem 2 links cujo nome bate
  // com essa regex — o título do card em si e o "Exibir tudo" dele — sem
  // isso, o Playwright falha com "strict mode violation". O primeiro é
  // sempre o título do card, que é o que queremos clicar.
  await page.getByRole("link", { name: /Histórico de aprovação/ }).first().click();
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Aprovar", exact: true }).click();
  await page.waitForTimeout(2000);
  await page.getByRole("dialog", { name: "Aprovar Lead" }).getByRole("button", { name: "Aprovar" }).click();
  await page.waitForTimeout(3000);

  // Depois de aprovar, fica na página da lista relacionada "Histórico de
  // aprovação" — volta pra página de detalhes do Lead (goBack desfaz a
  // navegação do clique em "Histórico de aprovação").
  await page.goBack();
  await page.waitForTimeout(3000);
}

// Valores reais por Tipo de Registro (confirmados via SOQL em Leads
// convertidos com sucesso na integração SAP, exceto Hospitalar — sem Leads
// com Retorno_SAP_Sucesso__c = true; usados valores de Leads reais já
// "Convertido"). Cada tipo tem seu próprio padrão de código — não são
// intercambiáveis (ex.: Descrição Contribuinte ICMS é "Não contribuinte"
// pra Cimed Tech/Hospitalar mas "NF" pra Milimetric).
const VALORES_FISCAL_POR_TIPO = {
  "Cimed Tech": {
    grupoContabilCliente: "01",
    zonaTransporte: "ZDBRSP-SJP",
    chaveCondicoesPagamento: "1016",
    partner: "500779",
    setorIndustrial: "0007",
    categoriaCfopDoCliente: "0",
    descricaoContribuinteIcms: "Não contribuinte",
    categoriaDeListaDePrecos: "18",
    grupoSubstituicaoFiscal: "001",
  },
  Hospitalar: {
    grupoContabilCliente: "01",
    zonaTransporte: "ZDBRSP-509",
    chaveCondicoesPagamento: "1002",
    partner: "501372",
    setorIndustrial: "0001",
    categoriaCfopDoCliente: "0",
    descricaoContribuinteIcms: "Não contribuinte",
    categoriaDeListaDePrecos: "18",
    grupoSubstituicaoFiscal: "001",
  },
  Milimetric: {
    grupoContabilCliente: "1",
    zonaTransporte: "ZDBRSP-138",
    chaveCondicoesPagamento: "1016",
    partner: "500920",
    setorIndustrial: "0002",
    categoriaCfopDoCliente: "6",
    descricaoContribuinteIcms: "NF",
    categoriaDeListaDePrecos: "18",
    grupoSubstituicaoFiscal: "999",
  },
  "CG Cloud": {
    grupoContabilCliente: "01",
    zonaTransporte: "ZDBRSP-509",
    chaveCondicoesPagamento: "1016",
    partner: "501372",
    setorIndustrial: "0001",
    categoriaCfopDoCliente: "0",
    descricaoContribuinteIcms: "Não contribuinte",
    categoriaDeListaDePrecos: "18",
    grupoSubstituicaoFiscal: "001",
  },
};

// Campos que a validação de conversão (Database.convertLead) exige, mas que
// não fazem parte do formulário de Fiscal/Financeira/Logística em si —
// descobertos um de cada vez pelas mensagens de erro reais do Salesforce ao
// clicar "Salvar e Aprovar" ("O campo bairro está vazio.", "O campo Grupo de
// Cliente está vazio.", "O campo Warehouse está vazio."). Preenchidos aqui
// de forma defensiva (mesmo que a Análise Cadastral já devesse ter isso)
// porque um script de criação de massa que falha no meio do caminho pode
// perder edições não salvas do Lead inteiro, deixando esses campos vazios
// sem nenhum aviso até a tentativa de conversão.
// `warehouseBusca` só se aplica a tipos que costumam ficar SEM Warehouse na
// Análise Cadastral (Milimetric). Pra Cimed Tech, o CT 4 já preenche
// Warehouse na criação — tentar de novo aqui reabre a busca avançada em cima
// de um valor já selecionado e trava (o combobox de busca vira um "chip"
// quando já preenchido, não o mesmo campo de texto).
const CAMPOS_CONVERSAO_POR_TIPO = {
  "Cimed Tech": { bairro: "Bairro Teste", warehouseBusca: null, grupoDoCliente: "01-Grandes contas" },
  Milimetric: { bairro: "Bairro Teste", warehouseBusca: "SP", grupoDoCliente: "03- Especializados" },
};

// Completa os campos de Fiscal/Financeira/Logística que faltam (o Lead
// precisa já estar aberto, com Análise Cadastral já preenchida). NÃO aprova
// nem converte — isso agora é responsabilidade de `aprovarAnaliseFiscalComEdicao`
// (ver abaixo), que é o que de fato dispara a conversão real.
// "Inscrição Estadual" só é obrigatório em alguns registros (ex.: Leads reais
// com CNPJ já preenchido) — preenche se o campo existir na página.
//
// `tipoRegistro` seleciona o conjunto de valores reais em
// VALORES_FISCAL_POR_TIPO (default "Cimed Tech"). "Grupo de substituição
// fiscal" é obrigatório na etapa de aprovação da Análise Fiscal (descoberto
// ao usar "Editar Lead Aprovação" — sem ele, "Salvar e Aprovar" falha com
// "Campo obrigatório exigido"), mesmo não sendo obrigatório na edição normal
// do Lead — por isso preenchido aqui mesmo quando o mecanismo de conversão
// real não se aplica a esse tipo.
// `sfSession`/`leadId` são opcionais só por compatibilidade com chamadas
// antigas — sem eles, o campo Cadeira (Org Unit) fica vazio e a conversão
// real falha mais adiante em `aprovarAnaliseFiscalComEdicao`. Passe sempre
// que possível.
async function completarFiscalLogisticaEConverter(page, tipoRegistro = "Cimed Tech", sfSession = null, leadId = null) {
  const valores = VALORES_FISCAL_POR_TIPO[tipoRegistro];
  if (!valores) {
    throw new Error(`Nenhum valor de Fiscal/Financeira/Logística cadastrado pra "${tipoRegistro}".`);
  }

  if (sfSession && leadId) {
    await preencherCadeiraOrgUnit(sfSession, leadId);
  }

  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.waitForTimeout(2000);

  await page.getByRole("textbox", { name: "Grupo Contábil Cliente" }).fill(valores.grupoContabilCliente);
  await page.getByRole("textbox", { name: "Zona de Transporte" }).fill(valores.zonaTransporte);
  await page.getByRole("textbox", { name: "Chave Condições Pagamento" }).fill(valores.chaveCondicoesPagamento);
  await page.getByRole("textbox", { name: "Partner", exact: true }).fill(valores.partner);
  const inscricaoEstadual = page.getByRole("textbox", { name: "Inscrição Estadual" });
  if (await inscricaoEstadual.count()) {
    await inscricaoEstadual.fill("ISENTO");
  }

  await selecionarPicklist(page, "Setor Industrial", valores.setorIndustrial);
  await selecionarPicklist(page, "Classificação fiscal", "1");
  await selecionarPicklist(page, "Esquema cliente", "1");
  await selecionarPicklist(page, "UF", "SP");
  await selecionarPicklist(page, "Categoria CFOP do cliente", valores.categoriaCfopDoCliente);
  await selecionarPicklist(page, "Descrição Contribuinte ICMS", valores.descricaoContribuinteIcms);
  await page.getByRole("textbox", { name: "Categoria de lista de preços" }).fill(valores.categoriaDeListaDePrecos);
  const grupoSubstituicaoFiscal = page.getByRole("combobox", { name: "Grupo de substituição fiscal", exact: true });
  if (await grupoSubstituicaoFiscal.count()) {
    await selecionarPicklist(page, "Grupo de substituição fiscal", valores.grupoSubstituicaoFiscal);
  }

  // Campos exigidos pela conversão real, mas fora do formulário de Fiscal —
  // ver CAMPOS_CONVERSAO_POR_TIPO. Preenche só se o campo existir na página
  // e o tipo tiver valores cadastrados (CG Cloud/Hospitalar já vêm com esses
  // campos preenchidos por outros fluxos).
  const camposConversao = CAMPOS_CONVERSAO_POR_TIPO[tipoRegistro];
  if (camposConversao) {
    const bairro = page.getByRole("textbox", { name: "Bairro", exact: true });
    if ((await bairro.count()) && !(await bairro.inputValue())) {
      await bairro.fill(camposConversao.bairro);
    }
    const grupoDoCliente = page.getByRole("combobox", { name: "Grupo do cliente", exact: true });
    if (await grupoDoCliente.count()) {
      await selecionarPicklist(page, "Grupo do cliente", camposConversao.grupoDoCliente);
    }
    const warehouse = page.getByRole("combobox", { name: "Warehouse", exact: true });
    // Quando o Warehouse já vem preenchido (Lead reaproveitado que já passou
    // por outro fluxo), o campo mostra um botão "Limpar Warehouse seleção" em
    // vez do combobox de busca vazio — reabrir a pesquisa avançada nesse
    // estado nunca mostra "Exibir mais resultados" e trava em timeout (mesmo
    // problema já visto com Bairro/Grupo do cliente em Leads Cimed Tech/
    // Hospitalar já preenchidos na criação).
    const warehouseJaPreenchido = await page.getByRole("button", { name: "Limpar Warehouse seleção" }).count();
    if (camposConversao.warehouseBusca && (await warehouse.count()) && !warehouseJaPreenchido) {
      await selecionarViaPesquisaAvancada(page, "Warehouse", camposConversao.warehouseBusca);
    }
  }

  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(3000);
}

// Avança o path até "Convertido" via edição manual do campo Status (o Lead
// precisa já estar aberto, com Fiscal/Financeira/Logística preenchidos e a
// etapa de aprovação Fiscal já aprovada via `aprovarEtapaPendente`).
//
// USO: Cimed Tech / Milimetric / Hospitalar. Para esses tipos, só a etapa
// "Análise Cadastral" é uma aprovação real (ProcessInstance) — as etapas
// seguintes do path (Fiscal, Financeira, Aprovado, Convertido) são só
// controladas por este campo Status customizado, sem gerar aprovação real
// nem conversão nativa do Salesforce (confirmado: Leads reais desses tipos
// nunca têm IsConverted = true, mesmo já convertidos "de fato" via
// integração SAP externa — ver [[project_lead_mayssara_aprovacao]] e
// pendência documentada no README). Portanto "Convertido" aqui é só esse
// marco interno, não uma Account real. Para CG Cloud, usar
// `aprovarAnaliseFiscalComEdicao` em vez desta função — lá a aprovação real
// da etapa Fiscal já dispara a conversão sozinha, sem precisar disso.
async function marcarStatusConvertido(page) {
  // O botão "Selecionar Status convertido" abre um modal com um <select>
  // nativo de Status — precisa de `selectOption`, não clique manual na opção
  // (o combobox custom do path é diferente do <select> nativo do modal).
  await page.getByRole("option", { name: "Convertido", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Selecionar Status convertido" }).click();
  await page.waitForTimeout(2500);
  const dialog = page.getByRole("dialog", { name: "Alterar Lead Status" });
  await dialog.getByRole("combobox", { name: "Status" }).selectOption("Convertido");
  await page.waitForTimeout(500);
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await page.waitForTimeout(3000);
}

// Aprova a etapa "Análise Fiscal" via "Editar Lead Aprovação" + "Salvar e
// Aprovar" — mecanismo confirmado como o gatilho REAL da conversão nativa do
// Salesforce (IsConverted = true, Account/Contact criados), diferente do
// botão simples "Aprovar" do "Histórico de aprovação" (que só atualiza o
// campo Status, sem converter de verdade). Descoberto testando com um Lead
// real: o usuário aprovou manualmente por esse caminho e a Conta foi criada;
// replicado via automação com sucesso.
//
// USO: confirmado pra CG Cloud E Cimed Tech (testado com Lead recém-criado
// em ambos, IsConverted = true nos dois). Uma primeira tentativa em Cimed
// Tech tinha "falhado" (nem avançou o Status), mas foi um falso negativo —
// o Lead usado já tinha sido processado/aprovado numa run de teste anterior
// (sem nada pendente de verdade pra aprovar); com um Lead genuinamente
// fresco o mecanismo funcionou igual ao CG Cloud. Ainda não testado em
// Milimetric/Hospitalar (Hospitalar nem tem processo de aprovação ativo
// nesta org — ver README). `marcarStatusConvertido` continua disponível
// como alternativa só se este mecanismo realmente não se aplicar a um tipo.
//
// Pré-condição: `completarFiscalLogisticaEConverter` já deve ter rodado
// (todos os campos de Fiscal/Financeira/Logística preenchidos), senão o
// "Salvar e Aprovar" falha com "Campo obrigatório exigido".
async function aprovarAnaliseFiscalComEdicao(page) {
  await page.getByRole("button", { name: "Editar Lead Aprovação" }).click();
  await page.waitForTimeout(3000);

  // O modal às vezes não abre de primeira (clique perdido ou página ainda
  // se ajustando após navegação recente) — em vez de só aumentar o timeout
  // (que já falhou mesmo em 45s numa run real), tenta de novo clicando
  // "Editar Lead Aprovação" uma segunda vez antes de desistir.
  const botaoSalvarEAprovar = page.getByRole("button", { name: "Salvar e Aprovar", exact: true });
  if (!(await botaoSalvarEAprovar.count())) {
    await page.getByRole("button", { name: "Editar Lead Aprovação" }).click();
    await page.waitForTimeout(3000);
  }
  await botaoSalvarEAprovar.click({ timeout: 30000 });
  await page.waitForTimeout(4000);

  const erroObrigatorio = page.getByText("Campo obrigatório exigido");
  if (await erroObrigatorio.count()) {
    throw new Error(
      'Ainda há campo(s) obrigatório(s) vazio(s) no modal "Editar Lead Aprovação" — confira quais campos aparecem em branco e preencha antes de chamar aprovarAnaliseFiscalComEdicao.'
    );
  }
}

// Converte o Lead de verdade usando o botão nativo "Converter" (a tela
// padrão de conversão do Salesforce — Conta/Contato/Oportunidade — não o
// mecanismo de "Editar Lead Aprovação"). Esse botão só existe pra alguns
// Tipos de Registro (Hospitalar e CG Cloud têm; Cimed Tech/Milimetric não).
//
// DESCOBERTA DO USUÁRIO (2026-08-20): pra Hospitalar, diferente de Cimed
// Tech/Milimetric/CG Cloud, "Editar Lead Aprovação" + "Salvar e Aprovar" NÃO
// converte de verdade (mostra "Sucesso!" mas `IsConverted` continua false —
// não existe nenhum Histórico de aprovação real por trás, ver
// [[project_lead_hospitalar_nicole]]). O passo que realmente falta é esse
// botão "Converter" nativo — testado manualmente pelo usuário e confirmado
// via SOQL (`IsConverted = true`, Account/Contact reais criados) — depois
// replicado aqui via automação com o mesmo resultado.
//
// O modal já vem com "Criar nova Conta"/"Criar novo Contato"/"Criar nova
// Oportunidade" pré-selecionados e pré-preenchidos com nomes derivados do
// Lead — não precisa mexer em nada, só confirmar. Pré-condição: Fiscal/
// Financeira/Logística já preenchidos (`completarFiscalLogisticaEConverter`)
// e Cadeira (Org Unit) já setada, senão a validação de conversão barra antes
// do modal aparecer, com os mesmos erros já documentados
// ("O campo bairro está vazio." etc.).
async function converterLeadNativo(page) {
  await page.getByRole("button", { name: "Converter", exact: true }).click();
  await page.waitForTimeout(3000);
  await page.getByRole("dialog").getByRole("button", { name: "Converter", exact: true }).click();
  await page.waitForTimeout(5000);
}

// Aprova a etapa "Análise Cadastral" pendente de um Lead usando o recurso
// nativo do Salesforce "Login" (logar como outro usuário, sem precisar da
// senha dele — disponível pra administradores em orgs sandbox). Necessário
// porque, no fluxo real, só a Mayssara Aparecida de Sousa pode aprovar essa
// etapa — usar o usuário de automação pra aprovar a própria submissão não
// reflete o processo real. Uso autorizado explicitamente pelo usuário.
async function aprovarComoMayssara(page, sfSession, leadId) {
  const { loginComoUsuario } = require("./userHelpers");
  await loginComoUsuario(page, sfSession, "Mayssara Aparecida de Sousa");

  await page.goto(`https://${sfSession.instanceHost}/lightning/r/Lead/${leadId}/view`);
  await page.waitForTimeout(3000);
  await page.getByRole("link", { name: /Histórico de aprovação/ }).click();
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Aprovar", exact: true }).click();
  await page.waitForTimeout(2000);
  await page.getByRole("dialog", { name: "Aprovar Lead" }).getByRole("button", { name: "Aprovar" }).click();
  await page.waitForTimeout(3000);

  // Volta pra tela do Lead (ainda autenticado como Mayssara — dá pra
  // conferir o resultado normalmente; não precisa voltar a ser o Celso).
  await page.goto(`https://${sfSession.instanceHost}/lightning/r/Lead/${leadId}/view`);
  await page.waitForTimeout(3000);
}

// Avança o Lead Hospitalar de "Análise Cadastral" pra "Análise Fiscal" como
// Mayssara Aparecida de Sousa, aprovando a etapa pendente de verdade via
// "Histórico de aprovação" (mesmo mecanismo de `aprovarEtapaPendente`, usado
// por Cimed Tech).
//
// CORRIGIDO 2026-08-20: antes achávamos que não existia aprovação real pra
// Hospitalar (Histórico de aprovação sempre em 0) — na real, faltava o
// "Segmento" certo no Lead ("Distribuidor Hospitalar", ver
// `completarAnaliseCadastralHospitalarComoNicole`). Com o Segmento certo, a
// submissão é automática (só chegar em "Pronto para Aprovação" já cria o
// Histórico de aprovação pendente) e a aprovação de Mayssara é o botão
// "Aprovar" de verdade — não precisa mais de nenhum truque de path/Status.
//
// A `page` precisa estar autenticada como outro usuário (Nicole, que criou o
// Lead) antes de chamar isso — por isso desloga primeiro e reautentica via
// frontdoor com a sessão do usuário de automação, senão `loginComoUsuario`
// não encontra a página de detalhes do usuário (a org desloga da sessão
// inteira, não só da personificação, ao clicar "Fazer logout como X").
async function avancarAnaliseFiscalHospitalarComoMayssara(page, sfSession, leadId) {
  const { loginComoUsuario } = require("./userHelpers");

  const logoutLink = page.getByRole("link", { name: /Fazer logout como/ });
  if (await logoutLink.count()) {
    await logoutLink.click();
    await page.waitForTimeout(4000);
    await page.goto(`https://${sfSession.instanceHost}/secur/frontdoor.jsp?sid=${sfSession.sessionId}`);
    await page.goto(`https://${sfSession.instanceHost}/lightning/page/home`);
    await page.waitForURL(/\/lightning\//, { timeout: 60000 });
    await page.waitForTimeout(2000);
  }

  // Essa transição específica (deslogar da Nicole na MESMA página e logar
  // como Mayssara em seguida) mostrou ser mais instável que um "Login As"
  // direto numa sessão nova (confirmado testando as duas formas) — trata com
  // uma segunda tentativa antes de desistir, reautenticando via frontdoor de
  // novo entre as tentativas.
  try {
    await loginComoUsuario(page, sfSession, "Mayssara Aparecida de Sousa");
  } catch (erro) {
    await page.goto(`https://${sfSession.instanceHost}/secur/frontdoor.jsp?sid=${sfSession.sessionId}`);
    await page.goto(`https://${sfSession.instanceHost}/lightning/page/home`);
    await page.waitForURL(/\/lightning\//, { timeout: 60000 });
    await page.waitForTimeout(2000);
    await loginComoUsuario(page, sfSession, "Mayssara Aparecida de Sousa");
  }

  await page.goto(`https://${sfSession.instanceHost}/lightning/r/Lead/${leadId}/view`);
  await page.waitForTimeout(3000);
  await aprovarEtapaPendente(page);
}

module.exports = {
  selecionarViaPesquisaAvancada,
  selecionarPicklist,
  completarAnaliseCadastralComum,
  avancarAnaliseFiscalHospitalarComoMayssara,
  completarAnaliseCadastralHospitalarComoNicole,
  criarLeadHospitalarComoNicoleAteAnaliseCadastral,
  abrirLeadEmAnaliseFiscalPorTipo,
  aprovarEtapaPendente,
  completarFiscalLogisticaEConverter,
  marcarStatusConvertido,
  aprovarAnaliseFiscalComEdicao,
  converterLeadNativo,
  aprovarComoMayssara,
  preencherCadeiraOrgUnit,
  preencherAnexosDocumento,
};
