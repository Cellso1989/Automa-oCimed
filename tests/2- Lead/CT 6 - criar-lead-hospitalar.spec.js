const { test, expect } = require("../../support/fixtures");
const { criarLeadHospitalarComoNicoleAteAnaliseCadastral } = require("../../support/leadHelpers");
const { soqlQuery } = require("../../support/soqlQuery");

// Cria o Lead Hospitalar e completa a Análise Cadastral com dados válidos,
// avançando o Status até "Análise Cadastral" (com aprovação REAL pendente
// pra Mayssara). Hospitalar usa o fluxo CNPJ-primeiro (igual CG Cloud, ver
// CT 7).
//
// Análise manual do usuário (2026-08-20) identificou a causa raiz do
// bloqueio documentado no README: os 82 Leads Hospitalar reais convertidos
// foram todos CRIADOS pela usuária NICOLE GOMES AMARAL (Profile
// "Faturamento") — confirmado via SOQL (CreatedById do Lead convertido
// analisado bate com o Id dela). O profile dela tem uma atribuição de
// layout diferente pro Record Type Hospitalar, que expõe campos (ex.
// "Forma de Contato Padrão") ausentes no layout visto pelo usuário de
// automação. Por isso o Lead precisa ser criado logado como ela (via "Login
// As", mesmo mecanismo já usado em `aprovarComoMayssara`) — toda a lógica de
// criação/preenchimento/avanço de Status está em
// `criarLeadHospitalarComoNicoleAteAnaliseCadastral` (support/leadHelpers.js),
// reaproveitada também por scripts de massa (ver
// scripts/criar-massa-hospitalar-nicole.js). Detalhes completos em
// [[project_lead_hospitalar_nicole]] na memória do projeto.
//
// Termina propositalmente em "Análise Cadastral" — pronto pra Mayssara dar
// seguimento (aprovação real de verdade, ver `aprovarEtapaPendente`/
// `avancarAnaliseFiscalHospitalarComoMayssara`), mas o avanço dela fica fora
// deste spec.
test("cria um Lead Hospitalar com Análise Cadastral completa e avança até o Status de Análise Cadastral", async ({ page, sfSession }) => {
  test.setTimeout(180000);

  const leadId = await criarLeadHospitalarComoNicoleAteAnaliseCadastral(page, sfSession);

  await expect(page.getByText("H01_SD100")).toBeVisible({ timeout: 15000 });

  // O atributo aria-selected/aria-current do componente de "Caminho" não
  // reflete de forma confiável qual etapa é a atual (visto em testes: a
  // etapa certa aparece destacada visualmente, mas com aria-selected="false")
  // — confirma via SOQL o campo Status de verdade, mesmo padrão já usado no
  // CT 12.
  await expect(async () => {
    const resultado = await soqlQuery({
      instanceHost: sfSession.instanceHost,
      sessionId: sfSession.sessionId,
      query: `SELECT Status FROM Lead WHERE Id = '${leadId}'`,
    });
    expect(resultado.records[0].Status).toBe("Análise Cadastral");
  }).toPass({ timeout: 15000 });
});
