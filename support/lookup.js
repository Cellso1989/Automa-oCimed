// Busca e seleciona uma opção num campo de lookup do Lightning (ex.: "Nome
// da conta"). A lista de resultados às vezes fecha/renderiza como "hidden"
// antes do clique (flakiness observada nesta org) — tenta de novo do zero
// (retypa a busca) em vez de falhar na primeira instabilidade.
async function selectLookupOption(page, comboboxName, searchText, { tentativas = 3 } = {}) {
  const combobox = page.getByRole("combobox", { name: comboboxName });
  const opcao = page.getByText(searchText, { exact: true });

  for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
    await combobox.click();
    await combobox.fill("");
    await combobox.pressSequentially(searchText, { delay: 100 });
    try {
      await opcao.waitFor({ state: "visible", timeout: 8000 });
      await opcao.click();
      return;
    } catch (erro) {
      if (tentativa === tentativas) throw erro;
    }
  }
}

module.exports = { selectLookupOption };
