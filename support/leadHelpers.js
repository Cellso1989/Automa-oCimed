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
// mais pra renderizar as opções do que os 300ms originais — por isso tenta
// de novo com espera maior antes de desistir, em vez de falhar na primeira.
async function selecionarPicklist(page, nomeCampo, valor) {
  const combo = page.getByRole("combobox", { name: nomeCampo, exact: true });
  await combo.scrollIntoViewIfNeeded();
  await combo.click();
  const opcao = page.getByRole("option", { name: valor, exact: true });
  for (let tentativa = 0; tentativa < 3 && !(await opcao.count()); tentativa++) {
    await page.waitForTimeout(1000);
  }
  await opcao.click();
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
  const resultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id FROM Lead WHERE Status = 'Análise Fiscal' AND RecordType.Name = '${tipoRegistro}' ORDER BY CreatedDate DESC LIMIT 1`,
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
  await page.getByRole("link", { name: /Histórico de aprovação/ }).click();
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

module.exports = {
  selecionarViaPesquisaAvancada,
  selecionarPicklist,
  abrirLeadEmAnaliseFiscalPorTipo,
  aprovarEtapaPendente,
  completarFiscalLogisticaEConverter,
  marcarStatusConvertido,
  aprovarAnaliseFiscalComEdicao,
  aprovarComoMayssara,
  preencherCadeiraOrgUnit,
};
