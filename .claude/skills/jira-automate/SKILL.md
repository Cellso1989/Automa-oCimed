---
name: jira-automate
description: Busca chamados do Jira atribuídos ao usuário (projeto SFQA) ainda não processados e gera rascunhos de specs Playwright a partir da descrição/critérios de aceite de cada um. Uso local, sob demanda — nunca commita nem dá push. Invocar com "/jira-automate" quando o analista quiser transformar tarefas do Jira em testes automaticamente, sem precisar descrever o cenário manualmente.
---

# Jira → Automação Playwright (rascunho local)

Este projeto automatiza o Salesforce (Lightning) da Cimed, ambiente UAT, com
Playwright. Este skill fecha o loop "tarefa no Jira → rascunho de teste
Playwright" sem exigir que o analista descreva o cenário manualmente a cada
vez.

## Passo 1 — Buscar chamados novos

Rode:

```
node scripts/jira-fetch-tasks.js
```

Esse script já resolve autenticação (via `env.json`, nunca no chat) e
controle de duplicidade (`tests/.jira-processed.json`) — chamados já
processados em execuções anteriores não voltam a aparecer. A saída é um JSON
no stdout: uma lista de `{ key, url, status, summary, description }`.

- Se o script falhar por falta de `JIRA_EMAIL`/`JIRA_API_TOKEN`, avise o
  usuário exatamente com a mensagem de erro (ele sabe gerar o token em
  id.atlassian.com/manage-profile/security/api-tokens) e pare por aqui.
- Se a lista vier vazia, informe que não há chamados novos atribuídos a ele e
  pare — não é erro.

## Passo 2 — Para cada chamado novo, gerar um rascunho de spec

Para cada item da lista:

1. Leia `summary` e `description` para entender o cenário esperado (fluxo de
   Lead, Conta, Oportunidade, aprovação, etc.).
2. Releia `support/fixtures.js` para reaproveitar o fixture de login já
   existente (`test`/`page` já autenticados via `soapLogin` + `frontdoor.jsp`,
   equivalente ao antigo `cy.login()`) em vez de duplicar lógica de
   autenticação. Releia também `tests/Login/CT 1 - login.spec.js` pra seguir
   o mesmo estilo (`const { test, expect } = require("../../support/fixtures")`
   — repare no `../../`, pois os specs ficam uma pasta mais fundo, dentro de
   uma subpasta temática).
3. Os specs ficam organizados por tema em subpastas de `tests/` (`Login/`,
   `Conta/`, `Contato/`, `Pedido/`, `Lead/`, etc.) — identifique o tema do
   chamado e escreva o rascunho em `tests/_drafts/CT <próximo número> - <slug-do-titulo>.spec.js`
   (crie a pasta `_drafts` se não existir — ela já está no `.gitignore`, então
   nada aqui vaza pro controle de versão sem revisão; os rascunhos ficam
   soltos ali, sem subpasta temática — quem organiza na pasta certa ao final
   é o analista, ao mover pra fora de `_drafts/`). Pra saber o próximo
   número, olhe o maior `CT N` já usado em qualquer subpasta de `tests/`
   (specs definitivos) e continue a partir dele, não reinicie a numeração a
   partir dos rascunhos.
4. Se a descrição do chamado não for clara o suficiente para escrever um
   teste específico (ex: só um título vago, sem critérios de aceite), escreva
   o rascunho mesmo assim com o melhor esforço, mas deixe um comentário no
   topo do arquivo listando as suposições feitas e o que precisa ser
   confirmado com o analista.

## Passo 3 — Resumir para o usuário

Ao final, liste para o usuário, por chamado processado: chave, título, link
do Jira, e o caminho do arquivo de rascunho gerado. Deixe claro que nada foi
commitado — os arquivos ficam em `tests/_drafts/` esperando revisão manual
antes de irem para `tests/` com nome definitivo.

## O que NÃO fazer

- Não commitar, não dar `git add`/`git push` em nada gerado aqui.
- Não mover o rascunho para `tests/` automaticamente — isso é decisão do
  analista (inclusive a numeração `CT N` definitiva, que ele confirma ao
  mover pra fora de `_drafts/`).
- Rodar os rascunhos de `_drafts/` com `npx playwright test` é permitido
  neste projeto (diferente do antigo setup em Cypress, que travava neste
  ambiente) — pode validar antes de entregar, mas só quando pedido
  explicitamente ou para conferir um rascunho recém-gerado.
