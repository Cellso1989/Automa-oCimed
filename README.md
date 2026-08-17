# Automação CIMED — Testes Playwright (Salesforce)

Testes automatizados com Playwright para o Salesforce (Lightning) da Cimed,
ambiente UAT (`https://cimed--uat.sandbox.my.salesforce.com`).

## Rodando os testes

```
npx playwright test              # suíte inteira
npx playwright test "CT 5"       # um spec específico (recomendado no dia a dia)
```

Evidências (screenshots de cada execução) ficam dentro da própria pasta do
tema, em `tests/<Tema>/screenshots/` — não numa pasta solta na raiz (ver
`playwright.config.js`, que define um "project" por tema com seu próprio
`testDir`/`outputDir`).

## Estrutura

Specs organizados por tema em `tests/`, cada um com seus próprios screenshots:

```
tests/
├── Login/        CT 1   (+ tests/Login/screenshots/)
├── Conta/        CT 2   (+ tests/Conta/screenshots/)
├── Contato/      CT 3   (+ tests/Contato/screenshots/)
├── Pedido/       CT 4–5 (+ tests/Pedido/screenshots/)
├── Lead/         CT 5–9 aprovam Lead existente; CT 10–13 só criam o Lead (+ tests/Lead/screenshots/)
└── Oportunidade/ CT 1–2 (+ tests/Oportunidade/screenshots/)
```

## Scripts auxiliares (`scripts/`)

- `aprovar-como-mayssara.js <LeadId ou Empresa>` — aprova a Análise Cadastral
  de um Lead específico como a Mayssara (via "Login As" nativo). Também
  disponível como skill: `/aprovar-lead-mayssara`.
- `converter-lead.js <LeadId ou Empresa>` — completa Fiscal/Financeira/
  Logística e aprova a etapa Fiscal de um Lead específico. Detecta o Tipo de
  Registro automaticamente e usa o mecanismo certo (ver seção de conversão
  abaixo).
- `criar-massa-cg-cloud.js` — cria um Lead CG Cloud completo (todos os campos
  válidos) e já aprova a Análise Cadastral como Mayssara, deixando pronto em
  "Análise Fiscal". Útil pra gerar massa rapidamente pro CT 8.
- `criar-massa-lead.js "<Cimed Tech|Hospitalar|Milimetric>"` — mesma ideia,
  genérico pros outros tipos (Hospitalar ainda não consegue avançar — ver
  limitação estrutural abaixo).
- `criar-massa-hospitalar.js` — cria um Lead Hospitalar (fluxo CNPJ-primeiro,
  igual CG Cloud) até o ponto em que fica bloqueado (ver limitação abaixo).
- `criar-e-converter-lead.js "<Cimed Tech|Milimetric|CG Cloud>"` — fluxo
  ponta a ponta: cria o Lead, aprova Cadastral (Mayssara), completa Fiscal e
  aprova via "Editar Lead Aprovação", confirmando no final `IsConverted` e o
  `Status_Integracao__c` da Conta. Empacota tudo que os outros scripts fazem
  em separado. Também disponível como skill: `/criar-e-converter-lead`.
- `diagnosticar-integracao-sap.js <AccountId|LeadId|Empresa>` — lê o
  `Log_Integracao__c` mais recente de uma Conta e aponta os campos que
  provavelmente causaram uma falha de integração com o SAP, comparando com
  um envio de sucesso recente. Também disponível como skill:
  `/diagnosticar-integracao-sap`.

## Fluxo de aprovação de Lead

1. Analista cria o Lead e completa a **Análise Cadastral** (CT 9) → envia
   para aprovação.
2. Só a **Mayssara Aparecida de Sousa** pode aprovar essa etapa (não o
   usuário de automação) — feito via "Login As" nativo do Salesforce
   (`aprovarComoMayssara` em `support/leadHelpers.js`, autorizado
   explicitamente pelo usuário).
3. Lead chega em **Análise Fiscal** → CT 5/6/7/8 completam os campos
   restantes e aprovam essa etapa, por tipo de registro (Cimed Tech,
   Hospitalar, Milimetric, CG Cloud).

## Conversão real do Lead (Lead → Conta)

**Descoberta importante:** o campo customizado "Status do lead" =
"Convertido" **não é, por si só, a conversão nativa do Salesforce**
(`Lead.IsConverted`) — e o mecanismo real pra disparar a conversão de
verdade **muda por Tipo de Registro**:

### Cimed Tech, Milimetric e CG Cloud — conversão real confirmada nos 3

Pra esses três tipos, aprovar a etapa "Análise Fiscal" através do botão
**"Editar Lead Aprovação"** (não o "Aprovar" simples do "Histórico de
aprovação") seguido de **"Salvar e Aprovar"** dispara sozinho a conversão
nativa do Salesforce — `IsConverted = true`, Account e Contact criados de
verdade. Confirmado com Leads recém-criados (não reaproveitados) nos três
tipos, de ponta a ponta (criação → aprovação da Análise Cadastral como
Mayssara → Análise Fiscal → conversão), via automação
(`aprovarAnaliseFiscalComEdicao` em `support/leadHelpers.js`, usado pelos
**CT 5, CT 7 e CT 8**, que validam `IsConverted`/`ConvertedAccountId` via
SOQL no final).

Esse mecanismo exige alguns campos que não são obrigatórios na edição normal
do Lead — descobertos um de cada vez pelas mensagens de erro reais do
Salesforce ao clicar "Salvar e Aprovar":
- **"Grupo de substituição fiscal"** — obrigatório no modal "Editar Lead
  Aprovação" (Cimed Tech, CG Cloud, Milimetric).
- **"Bairro"**, **"Grupo do Cliente"** e **"Warehouse"** — exigidos pela
  validação de conversão em si (`Database.convertLead`), mesmo não sendo
  obrigatórios na edição normal do Lead nem, no caso do Warehouse, presentes
  em Leads reais de Milimetric já convertidos historicamente.

`completarFiscalLogisticaEConverter(page, tipoRegistro)` já preenche tudo
isso com valores reais por Tipo de Registro (`VALORES_FISCAL_POR_TIPO` e
`CAMPOS_CONVERSAO_POR_TIPO` em `support/leadHelpers.js`).

**Cuidado com falso negativo:** testar esse mecanismo num Lead que já foi
processado antes (sem nada pendente de verdade pra aprovar) parece "funcionar"
sem erro, mas não converte nada — foi o que aconteceu na primeira tentativa
com Cimed Tech e também com Milimetric, corrigido depois testando com um
Lead genuinamente fresco e olhando a mensagem de erro real na tela (não só o
resultado). **Sempre teste com massa nova e preste atenção em qualquer toast
de erro antes de concluir que um tipo "não funciona".**

### Hospitalar — bloqueio real é de LAYOUT, não de processo de aprovação (corrigido em 2026-08-16)

**Conclusão anterior estava errada.** Hospitalar TEM processo de aprovação
ativo — é o mesmo processo "Lead CGCloud" usado por CG Cloud (não é
exclusivo desse tipo apesar do nome). Confirmado via SOQL: existem **82
Leads Hospitalar convertidos de verdade** (`IsConverted = true`) em
produção, todos aprovados automaticamente ("Aprovado Automaticamente",
~1 minuto entre as duas etapas) via esse processo.

O bloqueio real, achado testando manualmente com um Lead Hospitalar
preenchido com o MESMO conjunto de campos que funciona pra CG Cloud (Fiscal/
Logística/contato/checkboxes de documento): a validação de "Marcar Status"
retorna o erro explícito **"Preencha os campos obrigatórios: ... Forma de
Contato Padrão ... e anexos"** — e o campo **"Forma de Contato Padrão" não
existe no layout de página do Hospitalar** (só no de CG Cloud). Não tem como
preencher esse campo pela UI pra esse Tipo de Registro, então a validação
nunca passa. "Anexos" provavelmente exige arquivo real anexado, não só os
checkboxes booleanos (`AFE_anexado__c` etc.) que preenchemos via API.

Os 82 Leads convertidos reais claramente chegam por uma **integração
externa** que nunca passa pelo botão "Enviar para aprovação"/"Marcar Status"
da UI — provavelmente inserida via API já num estágio mais avançado, ou
usando dados que a integração preenche mas o formulário de criação manual
não expõe.

**Correção real necessária:** ajuste de Setup do Salesforce (adicionar
"Forma de Contato Padrão" ao layout do Hospitalar, ou remover essa exigência
da validação pra esse tipo) — fora do alcance da automação. `CT 6`/`CT 12`
continuam sem massa própria de propósito (ver `scripts/gerar-massa-para-suite.js`,
que gera massa só pra Milimetric).

Um detalhe interessante: o Lead Hospitalar tem um botão nativo **"Converter"**
na barra de ações (ausente em Cimed Tech/Milimetric) — ainda não testado.

## Integração com o SAP: "Status de Integração" da Conta

Depois que o Lead converte de verdade (`IsConverted = true`), a Conta criada
tem um campo `Status_Integracao__c` que mostra se o SAP aceitou ou rejeitou
o cadastro do cliente (registro em `Log_Integracao__c`, relacionado via
`Conta__c`, com o payload completo em `JSON_Enviado__c`/`JSON_Recebido__c`).

**Achado real analisando esses logs:** massa gerada por `criar-massa-lead.js`
(Cimed Tech/Milimetric) ficava com `Status_Integracao__c = "Falha na
Integração"` — não por causa do mecanismo de conversão (que funcionou
perfeitamente), mas porque **o script nunca preenchia "E-MAIL Cobrança" nem
"E-mail envio NF-e"**. O SAP rejeita a criação do cliente sem esses dois
campos:

```json
"MESSAGES": [
  {"MESSAGE": "Erro - E-mail COB Incorreto"},
  {"MESSAGE": "Erro - E-mail Incorreto"}
],
"SUCCESS": false
```

`criar-massa-cg-cloud.js` já preenchia esses campos (por outro motivo — eram
exigidos pelos critérios de entrada do processo de aprovação do CG Cloud),
por isso só as Contas de CG Cloud tinham `Status_Integracao__c = "Integrado
com Sucesso"` e um `Codigo_SAP__c` real preenchido.

**Segunda causa encontrada (mesma investigação):** mesmo depois de corrigir
o e-mail, uma massa de Cimed Tech ainda falhava — dessa vez porque o **CNPJ
(`STCD1`)** nunca era preenchido. Cimed Tech/Milimetric são criados pelo
fluxo simples (Sobrenome+Empresa, sem pedir CNPJ de cara como CG
Cloud/Hospitalar), então o campo fica vazio, e o SAP responde:

```
"Nº ID fiscal 1 (KNA1-STCD1) é um campo de entrada obrigatório"
```

**Corrigido:** `criar-massa-lead.js` agora preenche e-mail (Cobrança e NF-e)
e CNPJ, então massa nova desses tipos integra com sucesso — confirmado com
`Codigo_SAP__c` real gerado. Nota: o campo `Status_Integracao__c` demora
alguns segundos pra assumir o valor final (passa por um estado intermediário
"Enviado SAP" antes) — a skill `diagnosticar-integracao-sap` já lida com
isso, mas ao checar manualmente logo depois de converter, dê uma esperada
antes de concluir sucesso/falha.

## Skills

- **`/criar-e-converter-lead <Tipo>`** — roda `criar-e-converter-lead.js`.
- **`/diagnosticar-integracao-sap <AccountId|LeadId|Empresa>`** — roda
  `diagnosticar-integracao-sap.js`.
- **`/aprovar-lead-mayssara <LeadId ou Empresa>`** — roda
  `aprovar-como-mayssara.js`.

## Ambiente de execução

O Playwright roda bem neste projeto (diferente de uma tentativa anterior com
Cypress, que travava por limitação de memória do Electron neste ambiente).
Login é feito via API SOAP (`support/soapLogin.js`) + `frontdoor.jsp`, o que
evita o reCAPTCHA da tela de login normal.
