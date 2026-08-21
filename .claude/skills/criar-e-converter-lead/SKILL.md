---
name: criar-e-converter-lead
description: Cria um Lead do zero (Cimed Tech, Milimetric, CG Cloud ou Hospitalar), preenche a Análise Cadastral, aprova como Mayssara, completa Fiscal/Financeira/Logística e aprova via "Editar Lead Aprovação" + "Salvar e Aprovar" — o mecanismo real de conversão nativa do Salesforce. Confirma no final se IsConverted=true, se a Account foi criada, e se a integração com o SAP funcionou. Uso local, sob demanda — nunca commita nem dá push. Invocar com "/criar-e-converter-lead <Tipo>" quando quiser gerar um Lead convertido de ponta a ponta pra testar/validar algo manualmente, sem repetir os ~10 passos manuais.
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
node scripts/criar-e-converter-lead.js "<Cimed Tech|Milimetric|CG Cloud|Hospitalar>"
```

Tipos suportados: **Cimed Tech**, **Milimetric**, **CG Cloud** e
**Hospitalar** — os quatro confirmados de ponta a ponta (ver `README.md`,
seções "Conversão real do Lead" e "Hospitalar"). Hospitalar precisa ser
criado como Nicole Gomes Amaral (Login As) com "Segmento" = "Distribuidor
Hospitalar" pra aprovação real disparar — o script já cuida disso sozinho
(`scripts/criar-massa-hospitalar-nicole.js`), sem precisar de nada especial
na invocação.

## O que o script faz

1. Cria o Lead com todos os campos reais da Análise Cadastral — via
   `scripts/criar-massa-cg-cloud.js`, `scripts/criar-massa-hospitalar-nicole.js`
   ou `scripts/criar-massa-lead.js`, dependendo do tipo (Hospitalar usa um
   fluxo próprio: Nicole cria via "Login As", Mayssara avança a Cadastral).
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

## Notas específicas do Hospitalar

- O fluxo de criação pode falhar por flakiness na troca de sessão (Login As
  Nicole → Mayssara) — a org é lenta nesse ponto específico; um retry
  automático já existe em `avancarAnaliseFiscalHospitalarComoMayssara`, mas
  se falhar mesmo assim, rode de novo.
- Se o Lead não avançar de "Rascunho" (Status continua o mesmo depois de
  "Marcar como Status atual"), confira se o "Segmento" está mesmo
  "Distribuidor Hospitalar" — esse é o campo-chave que destrava a aprovação
  real pra esse tipo (ver [[project_lead_hospitalar_nicole]] na memória do
  projeto).

## O que NÃO fazer

- Não rodar em loop/lote sem confirmação do usuário sobre quantos Leads
  criar — cada execução cria dado real na org (mesmo sendo sandbox UAT).
- Não commitar nada gerado por essa skill.
