// Prepara, uma única vez antes de toda a suíte, a massa de Lead que os specs
// de aprovação (CT 9/10/11 — Cimed Tech/Milimetric/CG Cloud) precisam pra
// rodar. Sem isso, cada spec verifica e gera sua própria massa por conta
// própria via `garantirMassaEmAnaliseFiscal` (mantido nos specs — cobre o
// caso de rodar um spec isolado, ver CLAUDE.md item 18), o que no pior caso
// (nenhuma massa pronta) soma até 3 gerações sequenciais escondidas dentro
// dos testes, cada uma coberta por um timeout individual inflado (180s-480s).
//
// Só roda em CI (execução da suíte inteira) — rodar isso também localmente
// atrasaria o caso comum de "rodar só o spec alterado" (ver feedback salva),
// já que geraria massa dos 3 tipos mesmo quando só um spec específico foi
// pedido. Localmente, cada spec continua garantindo sua própria massa sob
// demanda, como já fazia.
async function globalSetup() {
  if (!process.env.CI) return;

  const { soapLogin } = require("./soapLogin");
  const { garantirMassaEmAnaliseFiscal } = require("./massaHelpers");
  const env = require("../env.json");

  const sfSession = await soapLogin({
    username: env.sfUsername,
    password: env.sfPassword,
    securityToken: env.sfSecurityToken || "",
  });

  for (const tipoRegistro of ["Cimed Tech", "Milimetric", "CG Cloud"]) {
    await garantirMassaEmAnaliseFiscal(sfSession, tipoRegistro);
  }
}

module.exports = globalSetup;
