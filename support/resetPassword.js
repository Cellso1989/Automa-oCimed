// Reset de senha via API SOAP Partner (mesmo mecanismo do botão "Reset
// Password" em Setup > Usuários) — dispara automaticamente o e-mail padrão
// do Salesforce pro usuário, com link pra ele definir a própria senha.
const https = require("https");

function resetPassword({ instanceHost, sessionId, userId }) {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:urn="urn:partner.soap.sforce.com">
  <soapenv:Header>
    <urn:SessionHeader><urn:sessionId>${sessionId}</urn:sessionId></urn:SessionHeader>
  </soapenv:Header>
  <soapenv:Body>
    <urn:resetPassword><urn:userId>${userId}</urn:userId></urn:resetPassword>
  </soapenv:Body>
</soapenv:Envelope>`;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: instanceHost,
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
          resolve({ ok: true });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("Timeout ao chamar resetPassword")));
    req.write(body);
    req.end();
  });
}

module.exports = { resetPassword };
