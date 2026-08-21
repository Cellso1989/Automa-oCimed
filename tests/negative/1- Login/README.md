# Login — testes negativos

Nenhum teste negativo foi criado para esta pasta.

**Motivo:** o `tests/1- Login/CT 1 - login.spec.js` (e todos os demais specs
do projeto, via `support/fixtures.js`) não passa pela tela de login do
Salesforce. A autenticação é feita via API SOAP (`support/soapLogin.js`) e a
sessão é injetada direto na página com `frontdoor.jsp?sid=...`. Não existe,
em nenhum lugar da suíte, um fluxo de UI de "usuário/senha inválidos" pra
reaproveitar.

Criar um teste de "credenciais inválidas" exigiria automatizar a tela de
login padrão do Salesforce por um caminho que o resto do projeto não usa —
isso violaria a regra de não inventar comportamento/fluxo (ver CLAUDE.md,
item 13). Decisão confirmada com o usuário em 2026-08-21.

Se este projeto um dia passar a ter uma tela de login de UI de verdade
(ex.: um portal customizado, ou remover o bypass via `frontdoor.jsp`), esta
pasta é o lugar certo para os cenários negativos de usuário/senha
inválidos, vazios, etc.
