const { defineConfig } = require("@playwright/test");

// Um "project" por tema — cada um aponta pro seu próprio testDir e salva os
// screenshots/artefatos dentro da própria pasta em tests/<Tema>/screenshots
// (em vez de tudo junto numa pasta screenshots/ solta na raiz). Os nomes
// abaixo têm que bater com as pastas reais em tests/ (prefixo numérico
// N- adicionado nas pastas pra fixar a ordem de execução no Runner) — sem
// o prefixo aqui, testDir aponta pra uma pasta que não existe e o
// Playwright não encontra nenhum spec ("No tests found").
const TEMAS = [
  "1- Login",
  "5- Conta",
  "6- Contato",
  "4- Pedido",
  "2- Lead",
  "3- Oportunidade",
];

module.exports = defineConfig({
  timeout: 60000,
  reporter: "list",
  // Só age em CI (ver support/globalSetup.js) — prepara de uma vez a massa
  // de Lead que CT 9/10/11 precisam, em vez de cada spec gerar a sua sob
  // demanda no meio da suíte inteira.
  globalSetup: require.resolve("./support/globalSetup.js"),
  // Sequencial — rodar em paralelo sobrecarrega a org (que já é lenta) e
  // deixa a UI instável o suficiente pra derrubar seletores por timing.
  workers: 1,
  use: {
    viewport: { width: 1280, height: 800 },
    screenshot: "on",
  },
  projects: TEMAS.map((tema) => ({
    name: tema,
    testDir: `./tests/${tema}`,
    outputDir: `./tests/${tema}/screenshots`,
  })),
});
