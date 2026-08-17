// Gera massa fresca em "Análise Fiscal" pra Milimetric e CG Cloud antes de
// rodar a suíte — evita que CT 10/CT 11 falhem por falta de Lead disponível
// (cada rodada da suíte consome/converte a massa existente, sem repor).
// Reaproveita scripts/criar-massa-lead.js e scripts/criar-massa-cg-cloud.js
// (já testados, ambos param de propósito em "Análise Fiscal").
//
// Cimed Tech (CT 9) não precisa de geração aqui: o próprio CT 8 (Lead:
// aprovar-lead-analise-cadastral-como-mayssara), que roda ANTES do CT 9 na
// ordem numérica da suíte, já cria e aprova um Lead Cimed Tech fresco toda
// vez — sempre há massa disponível pro CT 9 dentro da mesma execução.
//
// Hospitalar (CT 12) FICOU DE FORA DE PROPÓSITO: não é só falta de massa.
// Investigação de 2026-08-16 confirmou que Hospitalar tem processo de
// aprovação ativo ("Lead CGCloud", 82 Leads convertidos em produção), mas a
// validação de "Marcar Status" exige o campo "Forma de Contato Padrão", que
// NÃO EXISTE no layout de página do Hospitalar — trava mesmo com todos os
// campos preenchidos manualmente (testado). `criar-massa-lead.js` também
// usa o fluxo simples de criação (Sobrenome+Empresa), que nem se aplica a
// Hospitalar (precisa do fluxo CNPJ-primeiro, como CT 6/CT 7). Gerar massa
// aqui só reproduziria o mesmo bloqueio de configuração — não algo que um
// script resolve. Correção real: ajuste de layout/validação no Setup do
// Salesforce (ver [[project_lead_conversao_real]]).
//
// Uso: node scripts/gerar-massa-para-suite.js
const { criarEAprovarCadastral: criarMilimetricOuOutro } = require("./criar-massa-lead");
const { criarEAprovarCadastral: criarCgCloud } = require("./criar-massa-cg-cloud");
const { soqlQuery } = require("../support/soqlQuery");

async function gerarUm(tipoRegistro, criarFn) {
  console.log(`\n=== Gerando massa: ${tipoRegistro} ===`);
  const { sfSession, browser, leadId } = await criarFn({ headless: false });
  await new Promise((r) => setTimeout(r, 2000));

  const resultado = await soqlQuery({
    instanceHost: sfSession.instanceHost,
    sessionId: sfSession.sessionId,
    query: `SELECT Status FROM Lead WHERE Id = '${leadId}'`,
  });
  const status = resultado.records[0].Status;
  console.log(`Lead ${leadId} (${tipoRegistro}) — Status final: ${status}`);

  await browser.close();
  return { tipoRegistro, leadId, status };
}

const TIPOS = [
  { nome: "Milimetric", criarFn: (opts) => criarMilimetricOuOutro("Milimetric", opts) },
  { nome: "CG Cloud", criarFn: (opts) => criarCgCloud(opts) },
];

async function main() {
  const resultados = [];
  for (const { nome, criarFn } of TIPOS) {
    try {
      resultados.push(await gerarUm(nome, criarFn));
    } catch (e) {
      console.error(`FALHOU gerando massa ${nome}: ${e.message}`);
      resultados.push({ tipoRegistro: nome, status: "ERRO: " + e.message });
    }
  }

  console.log("\n=== Resumo ===");
  for (const r of resultados) {
    const ok = r.status === "Análise Fiscal";
    console.log(`${ok ? "✅" : "❌"} ${r.tipoRegistro}: ${r.status}`);
  }
}

main();
