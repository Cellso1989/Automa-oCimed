// Cria um usuário novo no Salesforce (UAT) clonando Profile, Role e
// Permission Sets do usuário de automação (env.sfUsername) — usado quando
// os testes precisam de um usuário "limpo" (sem histórico de registros),
// com as mesmas permissões, em vez de reaproveitar o mesmo login sempre.
//
// Não define senha nem dispara e-mail de boas-vindas — o uso previsto é via
// "Login As" (ver support/userHelpers.js), que não exige senha em sandbox.
// Se a pessoa precisar logar de verdade com credenciais próprias, isso tem
// que ser feito à parte (reset de senha manual em Setup), pra não disparar
// e-mail pra caixa de outra pessoa sem confirmação explícita.
//
// Uso:
//   node scripts/criar-usuario-clonado.js <Email> <FirstName> <LastName>
//   node scripts/criar-usuario-clonado.js bruno.galatti@valtech.com Bruno Galatti
const { soapLogin } = require("../support/soapLogin");
const { soqlQuery } = require("../support/soqlQuery");
const { sfInsert } = require("../support/sfInsert");
const env = require("../env.json");

function gerarAlias(firstName, lastName) {
  // Alias no Salesforce tem limite de 8 caracteres.
  const alias = (firstName.slice(0, 1) + lastName).toLowerCase().replace(/[^a-z0-9]/g, "");
  return alias.slice(0, 8);
}

async function main() {
  const [email, firstName, lastName] = process.argv.slice(2);
  if (!email || !firstName || !lastName) {
    console.error("Uso: node scripts/criar-usuario-clonado.js <Email> <FirstName> <LastName>");
    process.exit(1);
  }

  const sfSession = await soapLogin({
    username: env.sfUsername,
    password: env.sfPassword,
    securityToken: env.sfSecurityToken || "",
  });

  // Busca o usuário de automação (dono da sessão) pra clonar Profile/Role/etc.
  const usuarioBase = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id, ProfileId, UserRoleId, TimeZoneSidKey, LocaleSidKey, EmailEncodingKey, LanguageLocaleKey ` +
      `FROM User WHERE Username = '${env.sfUsername.replace(/'/g, "\\'")}' LIMIT 1`,
  });
  if (usuarioBase.totalSize === 0) {
    throw new Error(`Usuário de automação "${env.sfUsername}" não encontrado.`);
  }
  const base = usuarioBase.records[0];
  console.log(`Clonando configuração de "${env.sfUsername}" (ProfileId=${base.ProfileId}, UserRoleId=${base.UserRoleId || "(nenhuma)"})`);

  // Sandboxes normalmente exigem Username único no formato de e-mail com
  // sufixo (ex.: ".uat") — extrai o domínio da instância pra montar um
  // sufixo previsível.
  const sufixo = sfSession.instanceHost.includes("uat") ? ".uat" : `.${sfSession.instanceHost.split(".")[0]}`;
  const username = `${email}${sufixo}`;
  const alias = gerarAlias(firstName, lastName);

  const novoUsuario = await sfInsert({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    sobject: "User",
    fields: {
      Username: username,
      Email: email,
      FirstName: firstName,
      LastName: lastName,
      Alias: alias,
      ProfileId: base.ProfileId,
      UserRoleId: base.UserRoleId || null,
      TimeZoneSidKey: base.TimeZoneSidKey,
      LocaleSidKey: base.LocaleSidKey,
      EmailEncodingKey: base.EmailEncodingKey,
      LanguageLocaleKey: base.LanguageLocaleKey,
      IsActive: true,
    },
  });
  console.log(`✅ Usuário criado: Id=${novoUsuario.id}, Username=${username}`);

  // Clona também os Permission Sets atribuídos diretamente (não os herdados
  // do Profile, que já vêm de ProfileId).
  const permissionSets = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT PermissionSetId FROM PermissionSetAssignment WHERE AssigneeId = '${base.Id}' AND PermissionSet.IsOwnedByProfile = false`,
  });
  for (const registro of permissionSets.records) {
    await sfInsert({
      instanceHost: sfSession.instanceHost,
      sessionId: sfSession.sessionId,
      sobject: "PermissionSetAssignment",
      fields: { AssigneeId: novoUsuario.id, PermissionSetId: registro.PermissionSetId },
    });
  }
  console.log(`✅ ${permissionSets.records.length} Permission Set(s) atribuído(s).`);

  console.log(`\nPra usar nos testes, logue como esse usuário via "Login As":`);
  console.log(`  loginComoUsuario(page, sfSession, "${username}")`);
}

main().catch((erro) => {
  console.error("❌", erro.message);
  process.exit(1);
});
