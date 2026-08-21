// Helper genérico de "Login As" (logar como outro usuário sem senha,
// recurso nativo do Salesforce disponível pra administradores em orgs
// sandbox). Extraído de `aprovarComoMayssara` em leadHelpers.js pra
// reaproveitar em qualquer fluxo que precise agir como outro usuário real
// (não só aprovação de Lead) — uso autorizado explicitamente pelo usuário.
async function loginComoUsuario(page, sfSession, emailOuNome) {
  const { soqlQuery } = require("./soqlQuery");
  // Username costuma ter formato de e-mail mas NÃO é o mesmo campo que
  // Email nesta org (ex.: Username "salesrep@grupocimed.com.br.uat" com
  // Email "admincrm@wingsit.com.br") — tenta Username antes de Email.
  const valorEscapado = emailOuNome.replace(/'/g, "\\'");
  const campos = emailOuNome.includes("@") ? ["Username", "Email"] : ["Name"];
  let resultado = { totalSize: 0, records: [] };
  for (const campo of campos) {
    resultado = await soqlQuery({
      instanceHost: sfSession.instanceHost,
      sessionId: sfSession.sessionId,
      query: `SELECT Id, Name FROM User WHERE ${campo} = '${valorEscapado}' LIMIT 1`,
    });
    if (resultado.totalSize > 0) break;
  }
  if (resultado.totalSize === 0) {
    throw new Error(`Usuário "${emailOuNome}" não encontrado (tentei ${campos.join(" e ")}).`);
  }
  const usuario = resultado.records[0];

  // Abre a página de detalhes dele (classic, dentro de um iframe) e clica
  // no botão "Login".
  await page.goto(`https://${sfSession.instanceHost}/${usuario.Id}`);
  await page.waitForTimeout(4000);
  await page.getByRole("button", { name: "Detalhes do usuário" }).click();
  await page.waitForTimeout(4000);

  // O botão "Login" fica num iframe classic que demora a renderizar — tenta
  // por até ~20s em vez de uma espera fixa curta.
  let botaoLogin = null;
  for (let tentativa = 0; tentativa < 10 && !botaoLogin; tentativa++) {
    for (const f of page.frames()) {
      try {
        const candidato = f.locator('input[name="login"]');
        if ((await candidato.count()) > 0) {
          botaoLogin = candidato.first();
          break;
        }
      } catch {
        // Frame foi desanexado (página ainda carregando o iframe) — ignora e
        // tenta de novo na próxima iteração.
      }
    }
    if (!botaoLogin) await page.waitForTimeout(2000);
  }
  if (!botaoLogin) {
    throw new Error(`Botão "Login" (efetuar login como outro usuário) não encontrado na página de ${usuario.Name}.`);
  }
  // O "Login" navega na MESMA aba (não abre uma aba nova) — a partir daqui
  // `page` já está autenticado como esse usuário.
  await botaoLogin.click();
  await page.waitForTimeout(4000);

  return usuario;
}

// Extrai o session Id (cookie "sid") do usuário atualmente impersonado na
// `page` (via "Login As"), escopado pro domínio de `instanceHost` — cada
// domínio (my.salesforce.com, lightning.force.com, salesforce-setup.com...)
// tem seu PRÓPRIO cookie "sid" com valor diferente; usar o cookie errado (ex.
// o do domínio lightning.force.com) autentica na API REST como o usuário
// ERRADO. Serve pra fazer chamadas de API (ex.: PATCH em campos sem campo de
// UI) que precisam ficar atribuídas a esse usuário (`LastModifiedById`), não
// ao usuário de automação — confirmado testando contra
// /services/data/v60.0/chatter/users/me.
async function obterSessionIdDoUsuarioImpersonado(page, instanceHost) {
  const cookies = await page.context().cookies();
  const cookieSid = cookies.find((c) => c.name === "sid" && c.domain === instanceHost);
  if (!cookieSid) {
    throw new Error(`Cookie "sid" pro domínio "${instanceHost}" não encontrado — a página está mesmo impersonando alguém via Login As?`);
  }
  return cookieSid.value;
}

module.exports = { loginComoUsuario, obterSessionIdDoUsuarioImpersonado };
