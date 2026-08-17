---
name: criar-e-converter-lead
description: Cria um Lead do zero (Cimed Tech, Milimetric ou CG Cloud), preenche a Análise Cadastral, aprova como Mayssara, completa Fiscal/Financeira/Logística e aprova via "Editar Lead Aprovação" + "Salvar e Aprovar" — o mecanismo real de conversão nativa do Salesforce. Confirma no final se IsConverted=true, se a Account foi criada, e se a integração com o SAP funcionou. Uso local, sob demanda — nunca commita nem dá push. Invocar com "/criar-e-converter-lead <Tipo>" quando quiser gerar um Lead convertido de ponta a ponta pra testar/validar algo manualmente, sem repetir os ~10 passos manuais.
---

# Criar e converter Lead (ponta a ponta)

Empacota o fluxo completo que normalmente exige vários passos manuais:
criar Lead → preencher Análise Cadastral → aprovar como Mayssara (Login As)
→ preencher Fiscal/Financeira/Logística → aprovar via "Editar Lead
Aprovação" + "Salvar e Aprovar" (o mecanismo que de fato dispara a
conversão nativa do Salesforce) → confirmar `IsConverted`/`ConvertedAccountId`
e o status da integração com o SAP.

## Como invocar

```
node scripts/criar-e-converter-lead.js "<Cimed Tech|Milimetric|CG Cloud>"
```

Tipos suportados: **Cimed Tech**, **Milimetric**, **CG Cloud** — os três
confirmados de ponta a ponta (ver `README.md`, seção "Conversão real do
Lead"). **Hospitalar não é suportado** — não existe processo de aprovação
ativo pra esse tipo no Setup, então nem o "Enviar para aprovação" funciona;
o script já recusa de cara com uma mensagem clara em vez de travar no meio.

## O que o script faz

1. Cria o Lead (`scripts/criar-massa-cg-cloud.js` ou `scripts/criar-massa-lead.js`,
   dependendo do tipo) com todos os campos reais da Análise Cadastral.
2. Aprova a Análise Cadastral como a Mayssara Aparecida de Sousa via "Login
   As" nativo (uso autorizado explicitamente pelo usuário).
3. Preenche Fiscal/Financeira/Logística com valores reais por tipo
   (`completarFiscalLogisticaEConverter` em `support/leadHelpers.js`).
4. Aprova via "Editar Lead Aprovação" + "Salvar e Aprovar"
   (`aprovarAnaliseFiscalComEdicao`) — o botão simples "Aprovar" do
   Histórico de aprovação NÃO converte de verdade, só esse mecanismo.
5. Confirma via SOQL: `IsConverted`, `ConvertedAccountId`,
   `ConvertedContactId` e o `Status_Integracao__c`/`Codigo_SAP__c` da Conta
   criada. Se a integração falhou, sugere rodar a skill
   `diagnosticar-integracao-sap` pra ver o motivo exato.
6. Deixa o navegador aberto no final (não fecha sozinho em caso de sucesso
   silencioso) pra o analista poder conferir visualmente.

## Se o Lead não converter

O script já para com uma mensagem clara ("FALHOU: o Lead não converteu")
sem fechar o navegador, pra dar pra ver o erro na tela (geralmente um toast
vermelho tipo "Campo obrigatório exigido" ou um erro de validação de
conversão). Reporte esse texto ao usuário — cada campo faltando aparece um
de cada vez, não todos juntos.

## O que NÃO fazer

- Não rodar em loop/lote sem confirmação do usuário sobre quantos Leads
  criar — cada execução cria dado real na org (mesmo sendo sandbox UAT).
- Não usar pra Hospitalar mesmo que pareça "quase funcionar" — é um
  bloqueio de configuração do Setup, não vai resolver rodando de novo.
- Não commitar nada gerado por essa skill.
