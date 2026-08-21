// POST genérico via API REST do Salesforce — usado quando precisamos criar
// um registro (ex.: User) e não só consultar (ver soqlQuery.js pra leitura).
const https = require("https");

function sfInsert({ instanceHost, sessionId, sobject, fields }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(fields);
    const req = https.request(
      {
        hostname: instanceHost,
        path: `/services/data/v60.0/sobjects/${sobject}/`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionId}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let json;
          try {
            json = data ? JSON.parse(data) : {};
          } catch {
            reject(new Error(`Resposta inválida da API: ${data}`));
            return;
          }
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            reject(new Error(JSON.stringify(json)));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

module.exports = { sfInsert };
