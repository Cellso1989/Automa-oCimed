const { test, expect } = require("../../support/fixtures");
const { selectLookupOption } = require("../../support/lookup");

test("cria um novo Pedido do tipo Hospitalar", async ({ page }) => {
  const nomeConta = `Conta Teste Pedido ${Date.now()}`;

  // Cria a conta que o pedido vai referenciar, pra este teste não depender
  // de nenhum dado criado por outro spec.
  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Account/new"));
  await page.getByText("Customer", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();
  await page.getByLabel("Nome da conta").fill(nomeConta);
  // Código SAP e Tipo de documento de venda são exigidos por uma regra de
  // validação do Pedido (a conta relacionada precisa ter os dois
  // preenchidos), mesmo não sendo obrigatórios no formulário da própria
  // Conta.
  // Campo curto (parece truncar em ~10 caracteres) — usar os últimos dígitos
  // do timestamp em vez dos primeiros evita colisão entre execuções (os
  // primeiros dígitos de Date.now() mudam muito devagar).
  await page.getByLabel("Código SAP").fill(`S${Date.now().toString().slice(-8)}`);
  await page.getByRole("combobox", { name: "Tipo de documento de venda" }).click();
  await page.getByRole("option", { name: "ZNOR" }).click();
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  // Prefixo "001" identifica registros de Conta — a URL do Lightning às
  // vezes inclui o nome do objeto ("Account") no caminho, às vezes só o ID
  // (varia conforme o contexto de navegação da SPA).
  await expect(page).toHaveURL(/\/lightning\/r\/(Account\/)?001\w+\/view/, { timeout: 30000 });

  // Novo Pedido, tipo de registro Hospitalar — o seletor de tipo só aparece
  // ao clicar em "Novo" a partir da lista de Pedidos (indo direto pela URL
  // /lightning/o/Order/new o Salesforce pula o seletor e usa o tipo padrão
  // do perfil, "FILAPROC").
  await page.goto(page.url().replace(/\/lightning\/.*/, "/lightning/o/Order/list?filterName=__Recent"));
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Novo" }).click();
  // A lista de Record Types carrega de forma assíncrona — só "FILAPROC"
  // aparece de imediato, o resto (incluindo "Hospitalar") surge alguns
  // segundos depois.
  await page.getByText("Hospitalar", { exact: true }).waitFor({ timeout: 15000 });
  await page.getByText("Hospitalar", { exact: true }).click({ force: true });
  await page.getByRole("button", { name: "Avançar" }).click();

  await selectLookupOption(page, "Nome da conta", nomeConta);

  await page.getByRole("combobox", { name: "Status", exact: true }).click();
  await page.getByRole("option", { name: "Aberto" }).click();

  const hoje = new Date();
  const dataFormatada = `${String(hoje.getDate()).padStart(2, "0")}/${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;
  await page.getByRole("textbox", { name: "Data de início do pedido" }).fill(dataFormatada);
  // Clica no título do modal (área neutra) pra fechar o calendário do date
  // picker sem arriscar cancelar o modal inteiro (Escape faz isso).
  await page.getByRole("heading", { name: "Novo Pedido: Hospitalar" }).click();
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Salvar", exact: true }).click();

  // Prefixo "801" identifica registros de Pedido (Order).
  await expect(page).toHaveURL(/\/lightning\/r\/(Order\/)?801\w+\/view/, { timeout: 30000 });
});
