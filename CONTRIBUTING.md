# Processo de mudança do OTS

Este repositório é a fonte da verdade do padrão. Mudança aqui é mudança de
PROTOCOLO — o processo existe para que quem implementou ontem não acorde
quebrado amanhã.

## As regras que não se negociam

1. **O schema define; a prosa explica.** Toda proposta de mudança precisa
   chegar como diff de schema (+ example + caso na suíte). Proposta só em
   prosa não entra em discussão de merge.
2. **Proibição é executável.** Se o padrão diz que um campo não pode viajar
   (ex.: `score` em ProcessEntry, `cpf` em Profile), isso vira `"campo":
   false` no schema E um caso negativo na suíte — nunca só uma frase.
3. **Aditivo dentro da versão; quebra vira versão nova.** Campo opcional
   novo entra na versão vigente. Remover, renomear ou mudar tipo cria
   `0.x+1/` ao lado — as versões antigas ficam publicadas enquanto houver
   implementação viva.
4. **O binding é gerado.** `0.1/binding/openapi.json` sai de
   `scripts/binding-openapi.mjs`; a suíte falha se o commitado divergir do
   gerado. PR que edita o binding à mão será fechado com este parágrafo.
5. **Consentimento e revogação são do talento.** Qualquer proposta que mova
   essas decisões para o provedor ou para o verificador contraria o desenho
   do padrão e não será aceita.

## Como propor

1. Abra uma issue descrevendo o problema REAL (implementação travada, campo
   ambíguo, caso que o schema aceita e não devia).
2. PR com: diff do schema, example atualizado, caso na suíte (positivo e,
   se for proibição, negativo) e o parágrafo de prosa na spec.
3. `npm test` verde é pré-condição de review.

## Governança

O padrão é mantido pela Coploy (governança: Henrique Cabral). Decisões de
desenho ficam registradas nas specs; o histórico de cada versão vive no
Anexo D da spec correspondente.
