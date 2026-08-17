#!/usr/bin/env node
// Busca chamados do Jira e imprime em JSON (stdout) apenas os que ainda não
// foram processados nesta pasta, marcando-os como processados em seguida.
// Não filtra por responsável (assignee) — pega qualquer chamado que bata no
// filtro, independente de quem está atribuído. Não commita nem dá push em
// nada — só lê o Jira e atualiza o arquivo local de controle.
//
// Busca só pela label "Automação" (campo exibido como "Categorias" na
// UI em pt-BR — é o campo padrão "labels" do Jira). Critério único, por
// pedido explícito do Celso (voltar atrás de JIRA_FOLDER_ID/JIRA_JQL).
//
// Config esperada em env.json: JIRA_SITE, JIRA_PROJECT_KEY,
// JIRA_EMAIL, JIRA_API_TOKEN (token de API do Jira, nunca comitado — o
// arquivo env.json já está no .gitignore).

const fs = require("fs");
const path = require("path");

const ENV_PATH = path.join(__dirname, "..", "env.json");
const PROCESSED_PATH = path.join(__dirname, "..", "tests", ".jira-processed.json");

function loadEnv() {
  const raw = JSON.parse(fs.readFileSync(ENV_PATH, "utf8"));
  const missing = ["JIRA_SITE", "JIRA_PROJECT_KEY", "JIRA_EMAIL", "JIRA_API_TOKEN"].filter(
    (key) => !raw[key]
  );
  if (missing.length > 0) {
    console.error(
      `Faltando configuração em env.json: ${missing.join(", ")}.\n` +
        "Preencha JIRA_EMAIL (seu e-mail Jira) e JIRA_API_TOKEN (gerado em " +
        "id.atlassian.com/manage-profile/security/api-tokens) antes de rodar este script."
    );
    process.exit(1);
  }
  return raw;
}

function loadProcessed() {
  if (!fs.existsSync(PROCESSED_PATH)) return [];
  return JSON.parse(fs.readFileSync(PROCESSED_PATH, "utf8"));
}

function saveProcessed(keys) {
  fs.mkdirSync(path.dirname(PROCESSED_PATH), { recursive: true });
  fs.writeFileSync(PROCESSED_PATH, JSON.stringify(keys, null, 2));
}

// Converte a descrição em Atlassian Document Format (ADF) para texto simples.
function adfToText(node) {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.type === "text") return node.text || "";

  const childText = (node.content || []).map(adfToText).join("");

  if (node.type === "paragraph" || node.type === "heading") return childText + "\n";
  if (node.type === "listItem") return `- ${childText}\n`;
  return childText;
}

function montarJql(env) {
  return `project = ${env.JIRA_PROJECT_KEY} AND labels = "Automação" ORDER BY created DESC`;
}

async function main() {
  const env = loadEnv();
  const processed = new Set(loadProcessed());

  const jql = montarJql(env);
  // /rest/api/3/search foi descontinuada pela Atlassian (HTTP 410) em favor de
  // /rest/api/3/search/jql (ver https://developer.atlassian.com/changelog/#CHANGE-2046).
  const url = `${env.JIRA_SITE}/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&fields=summary,description,status&maxResults=50`;

  const auth = Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString("base64");
  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    console.error(`Jira retornou ${response.status}: ${await response.text()}`);
    process.exit(1);
  }

  const data = await response.json();
  const newIssues = (data.issues || [])
    .filter((issue) => !processed.has(issue.key))
    .map((issue) => ({
      key: issue.key,
      url: `${env.JIRA_SITE}/browse/${issue.key}`,
      status: issue.fields.status?.name,
      summary: issue.fields.summary,
      description: adfToText(issue.fields.description).trim(),
    }));

  console.log(JSON.stringify(newIssues, null, 2));

  saveProcessed([...processed, ...newIssues.map((issue) => issue.key)]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
