---
name: aprovar-lead-mayssara
description: Aprova a etapa "Análise Cadastral" de um Lead específico no Salesforce (Cimed UAT), fazendo login como a Mayssara Aparecida de Sousa via "Login As" nativo (sem senha dela). Uso local, sob demanda — para quando um Lead já foi criado/enviado para aprovação (manualmente ou por um spec) e só falta a aprovação real dela, sem precisar rodar o CT 9 inteiro. Invocar com "/aprovar-lead-mayssara <LeadId ou Empresa>".
---

# Aprovar Lead como Mayssara (Análise Cadastral)

No fluxo real do Salesforce da Cimed, a etapa "Análise Cadastral" de um Lead
só pode ser aprovada pela usuária **Mayssara Aparecida de Sousa** — o usuário
de automação (Celso Sabino) não pode se autoaprovar. Esse skill isola essa
aprovação num script standalone, sem precisar rodar o `CT 9` inteiro (que
também cria e preenche um Lead do zero).

**Uso autorizado explicitamente pelo usuário** — impersonação via recurso
nativo "Login As" do Salesforce (efetuar login como outro usuário sem senha,
disponível para administradores em orgs sandbox).

## Como invocar

O usuário passa um Lead Id ou o nome da Empresa. Rode:

```
node scripts/aprovar-como-mayssara.js "<LeadId ou Empresa>"
```

Exemplos:
```
node scripts/aprovar-como-mayssara.js 00QHa00000PVDCaMAP
node scripts/aprovar-como-mayssara.js "Empresa Teste Conv 1785804174520"
```

- Se passar um Id (prefixo `00Q`), usa direto.
- Se passar um nome de Empresa, o script busca via SOQL — precisa casar
  exatamente 1 Lead (se achar 0 ou mais de 1, o script erra e pede pra
  esclarecer/passar o Id).

## O que o script faz

1. Login via SOAP como o usuário de automação (`env.json`).
2. Resolve o Lead Id (direto ou por busca de Empresa).
3. Abre um navegador Chromium visível (`headless: false`) — a aprovação
   real de outra pessoa merece ficar visível, não rodar escondido.
4. Usa `aprovarComoMayssara` (`support/leadHelpers.js`): abre a página de
   detalhes da Mayssara, clica no botão "Login" nativo (login como ela sem
   senha — navega na MESMA aba, não abre uma nova), acessa o Lead, abre
   "Histórico de aprovação" e clica em "Aprovar".
5. Deixa o navegador aberto no final para o analista conferir o resultado
   antes de fechar manualmente.

## Pré-condição

O Lead precisa já ter sido enviado para aprovação (tem que existir uma etapa
pendente no "Histórico de aprovação"). Se não houver nada pendente, o clique
em "Aprovar" trava esperando o elemento aparecer — nesse caso, avise o
usuário que o Lead provavelmente ainda não foi enviado para aprovação.

## O que NÃO fazer

- Não usar esse script pra aprovar Leads em lote/sem confirmação explícita do
  usuário sobre qual Lead — sempre confirmar o Id/Empresa antes de rodar.
- Não remover o `headless: false` — a ação de logar como outra pessoa real
  deve ser visível, não silenciosa.
- Não commitar credenciais nem alterar `env.json` a partir daqui.
