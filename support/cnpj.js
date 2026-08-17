// Gera um CNPJ válido (dígitos verificadores corretos) e aleatório — usado
// pra evitar colisão com Leads já existentes na base a cada execução de
// teste (CNPJ fixo trava com "Lead já existe em nossa base de dados").
function calcularDigito(base) {
  const pesos = base.length === 12
    ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = base.split("").reduce((acc, digito, i) => acc + Number(digito) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function gerarCnpj() {
  const aleatorio = () => Math.floor(Math.random() * 10);
  const base = Array.from({ length: 12 }, aleatorio).join("");
  const d1 = calcularDigito(base);
  const d2 = calcularDigito(base + d1);
  return `${base}${d1}${d2}`;
}

module.exports = { gerarCnpj };
