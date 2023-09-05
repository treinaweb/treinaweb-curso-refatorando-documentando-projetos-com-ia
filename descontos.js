// vip ganha 10% so acima de 200 reais
function desconto_vip(subtotal) {
	return Number((subtotal * 0.1).toFixed(2))
}

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
