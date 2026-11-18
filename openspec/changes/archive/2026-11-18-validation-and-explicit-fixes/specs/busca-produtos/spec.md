# Spec Delta

## Purpose

Define a semântica da busca de produtos por nome em `GET /produtos?busca=`: como o texto é casado
com o nome, quais caracteres têm significado especial e o que acontece com a busca vazia.

## ADDED Requirements

### Requirement: Busca por trecho do nome
`GET /produtos?busca=<texto>` SHALL devolver 200 com os produtos cujo nome contém o texto, sem
diferenciar maiúsculas de minúsculas em letras ASCII. Sem `busca`, ou com `busca` vazia, SHALL
devolver todos os produtos. Sem resultados, SHALL devolver lista vazia.

#### Scenario: Busca sem diferenciar caixa
- **WHEN** o cliente chama `GET /produtos?busca=CABO`
- **THEN** a API responde 200 com os produtos cujo nome contém "Cabo"

#### Scenario: Busca vazia
- **WHEN** o cliente chama `GET /produtos?busca=`
- **THEN** a API responde 200 com todos os produtos

### Requirement: Caracteres especiais na busca
O texto da busca SHALL ser tratado como dado, e nunca como parte da consulta. A aspa simples e os
demais caracteres SHALL casar literalmente, exceto `%` (qualquer sequência) e `_` (um caractere), que
SHALL continuar funcionando como curingas.

#### Scenario: Aspa simples
- **WHEN** o cliente chama `GET /produtos?busca='`
- **THEN** a API responde 200 com `[]` (nenhum produto do cadastro inicial tem aspa no nome)

#### Scenario: Curinga de um caractere
- **WHEN** o cliente chama `GET /produtos?busca=Cabo_HDMI`
- **THEN** a API responde 200 com o produto "Cabo HDMI 2m"
