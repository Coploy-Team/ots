---
title: OTS — Open Talent Standard
---

<p class="tag">Padrão aberto · Apache-2.0</p>

# Open Talent Standard

<p class="lead">O histórico de uma pessoa em processos seletivos fica preso em cada ATS por onde ela passou. O OTS é um formato para esse histórico atravessar a fronteira, sem exigir que todo mundo adote o mesmo produto.</p>

Os artefatos normativos são JSON Schema. A conformidade é executável: roda no CI e em qualquer provedor vivo. A prosa das especificações está em português do Brasil; schemas, exemplos e a suíte são neutros de idioma.

## O que o padrão define

<div class="cards">
  <div class="card"><b>Descoberta de vaga</b><span><code>Job</code> e <code>JobDetails</code>. Pública, sem cadastro.</span></div>
  <div class="card"><b>Participação em processo</b><span><code>ProcessEntry</code>, do talento, via OAuth 2.1. Nota e aprovação são proibidas pelo schema.</span></div>
  <div class="card"><b>Perfil portátil</b><span><code>Profile</code>, com a origem de cada campo. Atributos protegidos são proibidos.</span></div>
  <div class="card"><b>Prova de entrevista</b><span><code>ots.attestation</code>: um JWS Ed25519 verificável offline, com consentimento por nível.</span></div>
  <div class="card"><b>Agendamento <span class="tag draft">0.3 draft</span></b><span>A empresa propõe horários; o talento, ou o agente dele, escolhe um.</span></div>
  <div class="card"><b>Retorno ao talento <span class="tag draft">0.3 draft</span></b><span>Toda mudança com texto humano obrigatório. Sem nota, sem ranking.</span></div>
</div>

## Versões

| Versão | Status | O que trouxe |
|---|---|---|
| [0.3](specs/spec-0.3-draft.html) | draft | `schedule_interview` e `submit_feedback`: agendamento e retorno ao talento, no vocabulário do anti-ghosting |
| [0.2](specs/spec-0.2.html) | spec | Prova de entrevista assinada, verificação offline, consentimento por nível, revogação pelo talento |
| [0.1](specs/spec-0.1.html) | spec | Descoberta de vaga, participação em processo, perfil portátil, binding REST, contrato do plugin de motor |

Uma versão só deixa de ser draft quando existe implementação de referência funcionando contra ela.

## Conformidade é fato verificável

```bash
git clone https://github.com/Coploy-Team/ots && cd ots && npm install

# o artefato prova a si mesmo: exemplos validam, proibições falham
npm test

# valida um provedor vivo pelo binding REST
npx tsx packages/ots-conformance/src/cli.ts rest https://api.coploy.io/mcp-server

# verifica uma prova de entrevista sem perguntar ao emissor
npx tsx packages/ots-conformance/src/cli.ts attestation prova.jws --jwks jwks.json

# 0.3: confere se a resposta do talento vale para a proposta de horário
npx tsx packages/ots-conformance/src/cli.ts schedule proposta.json resposta.json
```

Quem passa na suíte, passa. Quem não roda, não afirma.

## Implementações conhecidas

- **Coploy** (referência): binding REST em `https://api.coploy.io/mcp-server/ots/v0.1/` e emissão de prova com JWKS em `https://api.coploy.io/core/.well-known/ots/jwks.json`. O ATS open da Coploy também verifica prova de qualquer emissor: [Coploy-Team/ATS-AI](https://github.com/Coploy-Team/ATS-AI).

Implementou? Abra um PR no [repositório](https://github.com/Coploy-Team/ots) adicionando a sua, com a saída da suíte.
