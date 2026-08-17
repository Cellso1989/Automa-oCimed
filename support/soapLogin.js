// Login via API SOAP do Salesforce — evita o formulário de login da UI (e o
// reCAPTCHA invisível nele, que costuma marcar navegadores automatizados
// como suspeitos e rejeitar o login mesmo com credenciais corretas). Login
// via API não passa por isso nem pela verificação de identidade da UI.
// Sandboxes sempre autenticam contra "test.salesforce.com", não contra o
// domínio customizado (my domain) — a resposta traz o host real da instância.
const https = require("https");

function soapLogin({ username, password, securityToken = "" }) {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:partner.soap.sforce.com">
  <soapenv:Body>
    <urn:login>
      <urn:username>${username}</urn:username>
      <urn:password>${password}${securityToken}</urn:password>
    </urn:login>
  </soapenv:Body>
</soapenv:Envelope>`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "test.salesforce.com",
        path: "/services/Soap/u/60.0",
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=UTF-8",
          SOAPAction: '""',
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const faultMatch = data.match(/<faultstring>([\s\S]*?)<\/faultstring>/);
          if (faultMatch) {
            reject(new Error(faultMatch[1]));
            return;
          }
          const sessionId = data.match(/<sessionId>([\s\S]*?)<\/sessionId>/);
          const serverUrl = data.match(/<serverUrl>([\s\S]*?)<\/serverUrl>/);
          if (!sessionId || !serverUrl) {
            reject(new Error("Resposta do login SOAP sem sessionId/serverUrl: " + data));
            return;
          }
          const instanceHost = new URL(serverUrl[1]).hostname;
          resolve({ sessionId: sessionId[1], instanceHost });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("Timeout ao chamar o login SOAP do Salesforce")));
    req.write(body);
    req.end();
  });
}

module.exports = { soapLogin };
