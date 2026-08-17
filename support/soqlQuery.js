// Consulta SOQL via API REST do Salesforce — usado quando não dá pra filtrar
// algo direto na lista da UI (ex.: "Tipo de registro" não é uma coluna
// visível na lista de Leads nem aparece no layout de detalhes).
const https = require("https");

function soqlQuery({ instanceHost, sessionId, query }) {
  return new Promise((resolve, reject) => {
    const path = `/services/data/v60.0/query?q=${encodeURIComponent(query)}`;
    https
      .get(
        {
          hostname: instanceHost,
          path,
          headers: { Authorization: `Bearer ${sessionId}` },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const json = JSON.parse(data);
              if (json.error || (Array.isArray(json) && json[0]?.errorCode)) {
                reject(new Error(JSON.stringify(json)));
                return;
              }
              resolve(json);
            } catch (e) {
              reject(new Error(`Resposta inválida da API: ${data}`));
            }
          });
        }
      )
      .on("error", reject);
  });
}

module.exports = { soqlQuery };
