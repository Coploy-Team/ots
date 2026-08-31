<div align="center">

# OTS — Open Talent Standard

**Um padrão aberto para dados portáteis de talento.**

Descoberta de vaga, participação em processo, perfil portátil e — o que não
existia em lugar nenhum — **prova verificável de que uma entrevista
aconteceu**.

[![Licença: Apache 2.0](https://img.shields.io/badge/licen%C3%A7a-Apache--2.0-4a6fa5.svg)](LICENSE)
[![Versão](https://img.shields.io/github/v/release/Coploy-Team/ots?label=vers%C3%A3o&color=4a6fa5)](https://github.com/Coploy-Team/ots/releases)
[![Conformidade](https://img.shields.io/badge/conformidade-execut%C3%A1vel-2f6f6f)](#conformidade-é-fato-verificável-não-afirmação)

[O que define](#o-que-o-padrão-define) · [Conformidade](#conformidade-é-fato-verificável-não-afirmação) ·
[Implementações](#implementações-conhecidas) · [Contribuir](CONTRIBUTING.md)

</div>

> **In English:** OTS is an open standard for portable talent data — job
> discovery, process participation, portable profiles and **verifiable
> interview records**. Normative artifacts are JSON Schema; conformance is
> executable and runs in CI. The prose specs are currently in Brazilian
> Portuguese; the schemas, examples and CLI are language-neutral.

## O problema

O histórico de uma pessoa em processos seletivos fica preso em cada ATS por
onde ela passou. Quem entrevistou bem em três empresas começa do zero na
quarta, e cada empresa refaz a mesma triagem — sem saber que ela já foi feita.

Não é falta de dado. É falta de um formato que atravesse a fronteira **sem
exigir que todo mundo adote o mesmo produto**.

## O que o padrão define

Quatro coisas, em schemas executáveis:

**1. Descoberta de vaga** (`Job` / `JobDetails`) — pública, sem cadastro.
Qualquer um pode listar e ler vagas de um provedor conforme.

**2. Participação em processo** (`ProcessEntry`) — do talento, via OAuth 2.1.
O veredito do recrutador **nunca** viaja aqui: `score` e `approved` são
proibidos pelo schema, não desencorajados na prosa.

**3. Perfil portátil** (`Profile`) — do talento, com proveniência de cada
campo. Atributos protegidos (documento, nascimento, gênero) são **proibidos**
pelo schema.

**4. Prova de entrevista** (`ots.attestation`, OTS 0.2) — um JWS Ed25519 que
prova que uma entrevista aconteceu, assinado por quem a conduziu.

## A parte mais interessante: a prova

Um attestation é verificável **offline**, contra a chave pública de quem
emitiu. Não há autoridade central, não há serviço que precise estar no ar para
alguém conferir. A confiança é federada por domínio — o modelo do DKIM: cada
emissor publica o próprio JWKS, e quem verifica busca lá.

O consentimento é **executável, não política**. Quem escolhe o quanto sai é o
talento, entre três níveis:

| tier | o que sai |
|---|---|
| `existence` | que a entrevista aconteceu, quando, para qual cargo |
| `summary` | o acima, mais um resumo qualitativo |
| `full` | o acima, mais o detalhe por competência |

E o schema **recusa** o que extrapola: um attestation de tier `summary`
carregando nota é rejeitado pela suíte, não aceito com um aviso. A revogação é
do talento, pelo `statusUrl` — a única consulta online do fluxo.

## Conformidade é fato verificável, não afirmação

```bash
npm install

# o artefato prova a si mesmo (roda no CI): exemplos validam, proibições
# falham, a assinatura Ed25519 do exemplo verifica, binding == gerado
npm test

# valida um provedor VIVO (binding REST)
npx tsx packages/ots-conformance/src/cli.ts rest https://api.coploy.io/mcp-server

# verifica um attestation de forma INDEPENDENTE (offline, sem perguntar ao emissor)
npx tsx packages/ots-conformance/src/cli.ts attestation prova.jws --jwks jwks.json

# certifica a saída de um motor de entrevista candidato a plugin
npx tsx packages/ots-conformance/src/cli.ts webhook payload.json
```

Quem passa na suíte, passa; quem não roda, não afirma.

## Estrutura

```
specs/                      as especificações (prosa que EXPLICA)
packages/ots-contract/      os schemas normativos (o que DEFINE)
  0.1/schemas/              Job, JobDetails, ProcessEntry, Profile, Salary
  0.1/plugin/               contrato do plugin de motor de entrevista
  0.1/binding/openapi.json  binding REST — GERADO dos schemas, nunca à mão
  0.2/schemas/              attestation + attestation-status
packages/ots-conformance/   a suíte que PROVA conformidade
```

Duas regras da casa:

**A prosa explica, o schema define.** Onde divergirem, vale o schema.

**O binding é gerado, nunca escrito.** A suíte compara o `openapi.json`
commitado com o que ela gera dos schemas e falha se divergirem — editar o
binding à mão quebra o CI de propósito.

## Versões

| versão | o que trouxe |
|---|---|
| **0.2** | `ots.attestation` — prova de entrevista assinada, verificação offline, consentimento por tier, revogação pelo talento |
| **0.1** | descoberta de vaga, participação em processo, perfil portátil, binding REST, contrato do plugin de motor |

Uma versão só vira spec (sai de `-draft`) quando existe implementação de
referência funcionando contra ela.

## Implementações conhecidas

- **Coploy** (referência) — binding REST em
  `https://api.coploy.io/mcp-server/ots/v0.1/`, emissão de attestation com
  JWKS em `https://api.coploy.io/core/.well-known/ots/jwks.json`. O ATS open
  da Coploy também **verifica** prova de qualquer emissor federado:
  [Coploy-Team/ATS-AI](https://github.com/Coploy-Team/ATS-AI).

Implementou? Abra um PR adicionando a sua aqui — com a saída da suíte.

## Contribuir

Proposta de mudança no padrão começa como issue, não como PR: o custo de
mudar um schema depois que existem implementações é alto, e a discussão vale
mais que o diff. Correções de prosa, exemplos e testes de conformidade são
bem-vindos direto em PR. Veja o [CONTRIBUTING](CONTRIBUTING.md).

## Licença

[Apache-2.0](LICENSE). Padrão aberto de verdade: use, implemente, redistribua
— inclusive competindo com quem escreveu.
