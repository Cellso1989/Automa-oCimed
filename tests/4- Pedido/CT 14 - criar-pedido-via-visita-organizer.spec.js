const { test, expect } = require("../../support/fixtures");
const { loginComoUsuario } = require("../../support/userHelpers");
const { soqlQuery } = require("../../support/soqlQuery");

// Fluxo do "Organizer" (app CIMED REP, usado pelo Sales Rep em campo): logar
// como um Sales Rep real (via "Login As", mesmo mecanismo de
// aprovar-lead-mayssara), abrir uma Conta existente, criar uma Visita, e a
// partir da Visita criar um Pedido, adicionar um produto com quantidade e
// submeter. Diferente do CT 13 (que cria a Conta e o Pedido direto, sem
// Visita) — aqui o Pedido nasce de dentro da Visita.
//
// A tela de Itens do Pedido usa uma grade virtualizada (react-virtualized).
// O botão "Adicionar item" (modal "Lista de produtos") ficou como caminho
// secundário — o fluxo real e confiável pra definir quantidade é: filtrar
// o produto na busca, clicar no botão "Editar" (topo da página, ativa modo
// de edição inline na grade inteira), clicar na célula de quantidade
// (revela um <input> real dentro dela) e digitar o valor. Descoberto via
// teste manual — ver [[project_pedido_via_visita_organizer]].
// Screenshot ligado (retestado em 2026-08-16: o travamento do Chromium
// nessa grade virtualizada, que motivou desligar antes, não reproduziu mais
// — capturou normal, sem crash). Se voltar a travar em alguma execução
// futura, considerar desligar de novo.
test.use({ screenshot: "on" });

const CONTA_CG_CLOUD = "CG CLOUD TESTE 85793198";
const USUARIO_SALES_REP = "salesrep@grupocimed.com.br.uat";
const PRODUTO = "ACNEZIL GEL SECATIVO BG 10 G";
const QUANTIDADE = 15;

test("cria um Pedido a partir de uma Visita, no Organizer, como Sales Rep", async ({ page, sfSession }) => {
  // Fluxo longo (login as + varias telas do CG Cloud, cada uma lenta) —
  // o timeout padrao de 60s do projeto estoura no meio da navegacao.
  test.setTimeout(180000);

  await loginComoUsuario(page, sfSession, USUARIO_SALES_REP);

  // Abre a Conta pelo nome direto na lista de Contas (Recente), como o
  // Sales Rep veria no dia a dia.
  await page.goto(`https://${sfSession.instanceHost}/lightning/o/Account/list?filterName=__Recent`);
  await page.waitForTimeout(3000);
  await page.getByRole("link", { name: CONTA_CG_CLOUD }).click();
  await page.waitForTimeout(3000);
  await expect(page).toHaveURL(/\/lightning\/r\/(Account\/)?001\w+\/view/, { timeout: 30000 });
  const contaId = page.url().match(/\/r\/(?:Account\/)?(001\w+)\/view/)[1];

  // Cria a Visita ("Tirada de pedido" é o modelo que efetivamente permite
  // criar Pedido a partir dela — os demais modelos são de acompanhamento).
  await page.getByRole("button", { name: "Criar nova visita" }).click();
  await page.waitForTimeout(2000);
  const modeloVisita = page.getByPlaceholder(/Pesquisar Modelos de visita/);
  await modeloVisita.click();
  await modeloVisita.fill("Tirada de pedido");
  await page.waitForTimeout(2000);
  await page.getByText("Tirada de pedido", { exact: false }).last().click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(4000);

  // A related list "Visitas" na tela da Conta só mostra as 3 mais antigas
  // (link do href usa o Id puro, sem "/Visit/" no caminho) — mais simples e
  // confiável buscar a Visita recém-criada via SOQL (mais recente da Conta).
  const visitaResultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id FROM Visit WHERE AccountId = '${contaId}' ORDER BY CreatedDate DESC LIMIT 1`,
  });
  const visitaId = visitaResultado.records[0].Id;
  await page.goto(`https://${sfSession.instanceHost}/lightning/r/Visit/${visitaId}/view`);
  await page.waitForTimeout(3000);
  await expect(page).toHaveURL(/\/lightning\/r\/Visit\/\w+\/view/, { timeout: 30000 });

  // Cria o Pedido a partir da Visita.
  await page.getByRole("button", { name: "Criar Pedido", exact: true }).click();
  await page.waitForTimeout(3000);
  const centroDistribuicao = page.getByText("Selecione uma opção...");
  await centroDistribuicao.click();
  await page.waitForTimeout(1000);
  await page.getByText("CD: SP 3000").click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Criar", exact: true }).click();
  await page.waitForTimeout(6000);
  await expect(page).toHaveURL(/\/lightning\/r\/cgcloud__Order__c\/\w+\/view/, { timeout: 30000 });
  const pedidoId = page.url().match(/cgcloud__Order__c\/(\w+)\/view/)[1];

  // Filtra o produto na busca da grade "Todos os itens" (mais confiável do
  // que pegar a 1ª linha genérica, já que agora sabemos o nome certo do
  // produto que funciona de ponta a ponta nesta conta).
  const busca = page.getByPlaceholder(/Pesquisar produtos nesta lista/);
  await busca.waitFor({ state: "visible", timeout: 15000 });
  await busca.fill(PRODUTO);
  await page.waitForTimeout(2500);

  // O botão "Editar" (topo da página, nível do registro do Pedido) ativa
  // um modo de edição inline na grade inteira — é isso, e não o modal
  // "Adicionar item", que realmente permite definir a quantidade. Sem
  // clicar "Editar" primeiro, a célula de quantidade fica com bounding box
  // zerado (não clicável) mesmo com o produto já filtrado na tela.
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.waitForTimeout(3000);

  const celulaQuantidade = page.locator('[data-cursor="1_1"]').first();
  await celulaQuantidade.click();
  await page.waitForTimeout(800);
  // O clique revela um <input> real dentro da célula (diferente do "modo
  // Adicionar item", que não tem input nenhum) — usa fill() nele
  // diretamente em vez de keyboard.type().
  await celulaQuantidade.locator("input").first().fill(String(QUANTIDADE));
  await page.waitForTimeout(500);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(1000);

  // "Editar" troca o botão "Adicionar item" por "Cancelar"/"Salvar" — esse
  // "Salvar" é o que persiste a edição inline da grade.
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await page.waitForTimeout(4000);

  // Confirma via SOQL que a quantidade e o preço persistiram de verdade.
  const itemResultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id, cgcloud__Quantity__c, cgcloud__Base_Price__c, cgcloud__Value__c FROM cgcloud__Order_Item__c WHERE cgcloud__Order__c = '${pedidoId}'`,
  });
  console.log(`Itens persistidos no Pedido: ${JSON.stringify(itemResultado.records)}`);
  expect(itemResultado.totalSize).toBe(1);
  expect(itemResultado.records[0].cgcloud__Quantity__c).toBe(QUANTIDADE);
  expect(itemResultado.records[0].cgcloud__Base_Price__c).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Submeter Pedido", exact: true }).click();
  await page.waitForTimeout(4000);
});
