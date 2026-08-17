---
name: diagnosticar-integracao-sap
description: Investiga por que a integração de uma Conta com o SAP falhou (ou confirma sucesso) — lê o Log_Integracao__c mais recente, mostra as mensagens de erro reais do SAP e aponta quais campos do envio provavelmente causaram o erro, comparando com um envio de sucesso recente. Aceita Account Id, Lead Id ou nome da Empresa/Conta. Uso local, sob demanda, só leitura (não altera nada). Invocar com "/diagnosticar-integracao-sap <AccountId|LeadId|Empresa>" sempre que uma Conta aparecer com Status_Integracao__c = "Falha na Integração".
---

# Diagnosticar falha de integração com o SAP

Depois que um Lead converte de verdade (`IsConverted = true`, ver skill
`criar-e-converter-lead`), existe uma etapa separada e assíncrona: uma
integração que tenta cadastrar o cliente no SAP. O resultado fica no campo
`Status_Integracao__c` da Account ("Integrado com Sucesso" ou "Falha na
Integração"), com o payload completo (enviado e recebido) registrado no
objeto `Log_Integracao__c`.

## Como invocar

```
node scripts/diagnosticar-integracao-sap.js <AccountId|LeadId|Empresa>
```

Aceita:
- Id de Account (`001...`)
- Id de Lead (`00Q...`) — resolve automaticamente pro `ConvertedAccountId`
- Nome exato da Empresa/Conta (precisa casar exatamente 1 registro)

## O que o script faz

1. Mostra o `Status_Integracao__c` atual da Conta.
2. Busca o `Log_Integracao__c` mais recente relacionado a ela.
3. Se deu sucesso: mostra o `Codigo_SAP__c` gerado e para por aí.
4. Se falhou: lista as mensagens de erro reais devolvidas pelo SAP (ex.:
   `"Erro - E-mail COB Incorreto"`) — geralmente literais, o nome do campo
   problemático costuma estar na própria mensagem.
5. Compara o JSON enviado dessa tentativa com o de um envio de sucesso
   recente do mesmo tipo de operação, listando os campos que estavam vazios
   na tentativa que falhou mas preenchidos na de sucesso — geralmente aponta
   direto a causa raiz.

## Referência: achado real (2026-08-05)

Toda a massa de teste Cimed Tech/Milimetric gerada antes de uma certa data
falhava a integração porque os campos "E-MAIL Cobrança" e "E-mail envio
NF-e" nunca eram preenchidos na criação do Lead — o SAP rejeita o cadastro
sem eles. Corrigido em `scripts/criar-massa-lead.js`. Ver
[[project_lead_integracao_sap]] na memória do projeto e a seção "Integração
com o SAP" no `README.md` pra mais detalhes.

## O que NÃO fazer

- Essa skill só lê dados — não tenta corrigir nem reenviar a integração
  sozinha. Se identificar a causa, ajuste o Lead/massa de teste e rode a
  skill `criar-e-converter-lead` de novo (ou o fluxo manual), não tente
  "forçar" a integração via API a partir daqui.
