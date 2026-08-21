// Dispara o reset de senha padrão do Salesforce (mesmo botão "Reset
// Password" em Setup > Usuários) — o próprio Salesforce envia o e-mail com
// o link pro usuário definir a senha, direto pro endereço cadastrado no
// campo Email dele.
//
// Uso:
//   node scripts/resetar-senha-usuario.js <Username ou Email>
const { soapLogin } = require("../support/soapLogin");
const { soqlQuery } = require("../support/soqlQuery");
const { resetPassword } = require("../support/resetPassword");
const env = require("../env.json");

async function main() {
  const identificador = process.argv[2];
  if (!identificador) {
    console.error("Uso: node scripts/resetar-senha-usuario.js <Username ou Email>");
    process.exit(1);
  }

  const sfSession = await soapLogin({
    username: env.sfUsername,
    password: env.sfPassword,
    securityToken: env.sfSecurityToken || "",
  });

  const valorEscapado = identificador.replace(/'/g, "\\'");
  const resultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Id, Name, Username, Email FROM User WHERE Username = '${valorEscapado}' OR Email = '${valorEscapado}' LIMIT 1`,
  });
  if (resultado.totalSize === 0) {
    throw new Error(`Usuário "${identificador}" não encontrado.`);
  }
  const usuario = resultado.records[0];

  await resetPassword({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    userId: usuario.Id,
  });

  console.log(`✅ Reset de senha disparado para ${usuario.Name} (${usuario.Username}).`);
  console.log(`   E-mail com o link de redefinição enviado para: ${usuario.Email}`);
}

main().catch((erro) => {
  console.error("❌", erro.message);
  process.exit(1);
});
