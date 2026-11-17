/**
 * @file Descontos por tipo de cliente (`clientes.tipo`).
 *
 * Contrato do despacho dinamico: para um cliente do tipo `<tipo>`, o codigo
 * procura a funcao `desconto_<tipo>` neste modulo e a chama como
 * `desconto_<tipo>(subtotal, itens)`. Ela deve retornar o valor do desconto em
 * reais (numero com 2 casas). Se a funcao nao existir, o desconto e 0.
 *
 * Quem despacha: `POST /pedidos` (routes/pedidos.js) e
 * `GET /pedidos/:id/resumo` (app.js). O tipo `comum` nao passa por aqui:
 * a regra dele esta inline nesses dois pontos.
 * `GET /relatorios/vendas` NAO usa este modulo; ele tem uma copia propria das
 * regras. Uma nova funcao `desconto_<tipo>` passa a valer na criacao e no
 * resumo, mas nao no relatorio.
 */

/**
 * Desconto do cliente `vip`: 10% sobre o subtotal, para qualquer valor.
 *
 * @todo Diverge de comentario antigo abaixo: o comentario fala em "so acima de
 *   200 reais", mas o codigo aplica 10% sobre qualquer subtotal (a confirmar).
 * @param {number} subtotal Soma de `preco_unitario * quantidade` dos itens, em reais.
 * @returns {number} Valor do desconto em reais, arredondado para 2 casas.
 */
// vip ganha 10% so acima de 200 reais
function desconto_vip(subtotal) {
	return Number((subtotal * 0.1).toFixed(2))
}

/**
 * Desconto do cliente `atacado`: 15% sobre o subtotal quando a soma das
 * quantidades dos itens for >= 10; caso contrario, 0.
 *
 * @param {number} subtotal Soma de `preco_unitario * quantidade` dos itens, em reais.
 * @param {Array<{quantidade: (number|string)}>} itens Itens do pedido; so
 *   `quantidade` e lida (convertida com `Number`).
 * @returns {number} Valor do desconto em reais, arredondado para 2 casas.
 */
function desconto_atacado(subtotal, itens) {
	var qtd = 0
	for (var i = 0; i < itens.length; i++) {
		qtd = qtd + Number(itens[i].quantidade)
	}
	if (qtd >= 10) {
		return Number((subtotal * 0.15).toFixed(2))
	}
	return 0
}

module.exports = {
	desconto_vip: desconto_vip,
	desconto_atacado: desconto_atacado
}
