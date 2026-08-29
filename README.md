# OTS — Open Talent Standard

*(English: OTS is an open standard for portable talent data — job discovery,
process participation, portable profiles and **verifiable interview
records**. The normative artifacts are JSON Schema; conformance is
executable. Specs are currently in Brazilian Portuguese.)*

O OTS é um padrão aberto para dados portáteis de talento. Ele define, em
schemas executáveis, quatro coisas:

1. **Descoberta de vaga** (`Job`/`JobDetails`) — pública, sem cadastro.
2. **Participação em processo** (`ProcessEntry`) — do talento, via OAuth 2.1.
   O veredito do recrutador NUNCA viaja aqui: `score` e `approved` são
   proibidos pelo schema.
3. **Perfil portátil** (`Profile`) — do talento. Atributos protegidos
   (CPF/documento, nascimento, gênero) são proibidos pelo schema.
4. **Registro de entrevista verificada** (`ots.attestation`, OTS 0.2) — um
   JWS Ed25519 que prova que uma entrevista aconteceu, assinado pelo
   provedor que a conduziu e verificável **offline** por qualquer um, com
   revogação self-service do talento. Sem autoridade central: confiança
   federada por domínio, como DKIM.

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

A regra da casa: **a prosa explica, o schema define**. Onde divergirem, vale
o schema.

## Conformidade é fato verificável, não afirmação

```bash
npm install

# o artefato prova a si mesmo (roda no CI): examples validam, proibições
# falham, assinatura Ed25519 do exemplo verifica, binding == gerado
npm test

# valida um provedor VIVO (binding REST)
npx tsx packages/ots-conformance/src/cli.ts rest https://api.coploy.io/mcp-server

# verifica um attestation de forma INDEPENDENTE (offline, sem perguntar ao emissor)
npx tsx packages/ots-conformance/src/cli.ts attestation prova.jws --jwks jwks.json

# certifica a saída de um motor de entrevista candidato a plugin
npx tsx packages/ots-conformance/src/cli.ts webhook payload.json
```

Quem passa na suíte, passa; quem não roda, não afirma.

## Implementações conhecidas

- **Coploy** (referência): binding REST em
  `https://api.coploy.io/mcp-server/ots/v0.1/`, emissão de attestation
  com JWKS em `https://api.coploy.io/core/.well-known/ots/jwks.json`.

Implementou? Abra um PR adicionando a sua aqui — com a saída da suíte.

## Licença

Apache-2.0. Padrão aberto de verdade: use, implemente, redistribua.
