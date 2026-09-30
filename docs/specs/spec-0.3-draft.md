---
title: "OTS 0.3 — Agendamento e retorno ao talento"
---

# OTS 0.3 — Agendamento e retorno ao talento

**Status:** **DRAFT** — escrito em 2026-09-30 a partir do Plano F (F7) e do
keynote ("search_jobs() · apply() · schedule_interview() · submit_feedback()").
**Data:** 2026-09-30 · **Editores:** Coploy
**Artefato normativo:** [`packages/ots-contract/0.3-draft/`](https://github.com/Coploy-Team/ots/blob/main/packages/ots-contract/0.3-draft/)
**Conformidade:** `ots-conformance validate` (exemplos, proibições e a regra da
janela, no CI) e `ots-conformance schedule <proposta.json> <resposta.json>`.

O 0.1 deu descoberta, perfil portátil e entrada em processo. O 0.2 deu a
prova. Faltam as duas coisas que acontecem **depois** de a pessoa entrar num
processo e que hoje vivem fora de qualquer padrão: **marcar a conversa** e
**dar retorno**. O 0.3 põe as duas no protocolo, para que o agente do talento
(ChatGPT, Claude, Gemini, qualquer um) aceite um horário e receba o retorno sem
que a pessoa precise abrir o portal de cada empresa.

---

## 1. `schedule_interview` — a empresa propõe, o talento escolhe

Recurso: [`InterviewSchedule`](https://github.com/Coploy-Team/ots/blob/main/packages/ots-contract/0.3-draft/schemas/interview-schedule.schema.json).

- A empresa **propõe** de 1 a 20 janelas (`slots`), com duração, formato
  (`video_call` | `phone` | `onsite`) e fuso IANA de referência. Instantes são
  sempre ISO 8601 com offset.
- O talento **responde** com
  [`ScheduleResponse`](https://github.com/Coploy-Team/ots/blob/main/packages/ots-contract/0.3-draft/schemas/schedule-response.schema.json):
  confirmar UMA janela (pelo `start` exato) ou recusar com um motivo do
  vocabulário (`no_slot_fits`, `not_interested`, `accepted_other_offer`,
  `other`).
- Estados: `proposed` → `confirmed` | `declined` | `expired` | `cancelled`.
  Só `proposed` aceita resposta. Confirmar é idempotente.
- **O link ou endereço só existe depois da confirmação** (`joinDetails` é
  `null` em qualquer outro estado — proibição executável no schema).
- Entrevista gravada por IA **não se agenda**: ela é o `interviewUrl` da
  extensão `interview` do `ProcessEntry` (0.1).

Regra que o schema sozinho não expressa, e que a suíte checa: a resposta só
confirma uma janela que a empresa propôs, e só enquanto a proposta está aberta
(`scheduleResponseProblem`).

**Proibido na proposta:** outros candidatos, anotações do entrevistador, nota,
aprovação.

## 2. `submit_feedback` — retorno com texto humano, sem nota

Recurso: [`ProcessFeedback`](https://github.com/Coploy-Team/ots/blob/main/packages/ots-contract/0.3-draft/schemas/process-feedback.schema.json).

É o vocabulário do anti-ghosting virando protocolo: toda mudança que importa
para a pessoa chega com **texto humano obrigatório** (`message`). Status sem
explicação é exatamente o ghosting que o padrão existe para acabar.

- `stage` diz em que pé o processo está **para a pessoa** (não a coluna do
  quadro do recrutador): `received`, `in_review`, `interview_scheduled`,
  `advanced`, `not_selected`, `hired`, `position_closed`, `withdrawn`.
- `reasonCode` só existe quando o processo termina para a pessoa
  (`not_selected`, `position_closed`) e **só entre os motivos que um candidato
  pode ver**: `requirements_not_met`, `insufficient_experience`,
  `salary_mismatch`, `position_cancelled`, `other_candidate_hired`. Motivo
  interno não viaja: vai `null`, e o `message` explica.
- `nextStep` diz o que acontece a seguir, quando há.

**Proibido no retorno:** nota, aprovação, fit, posição no ranking, anotações
internas. Retorno não é veredito numérico — a mesma régua do `ProcessEntry`.

## 3. Transporte

### 3.1 Para o agente do talento (Bearer do talento)

| Operação | MCP (tool) | REST |
|---|---|---|
| Ver propostas de horário | `get_my_schedules` | `GET /ots/v0.3/schedules` |
| Responder a uma proposta | `schedule_interview` | `POST /ots/v0.3/schedules/{id}/respond` |
| Ver retornos dos processos | `get_my_process_feedback` | `GET /ots/v0.3/process-entries/{id}/feedback` |

`schedule_interview` recebe o `ScheduleResponse`. O agente **nunca** confirma
sem o sim explícito da pessoa para aquela janela (a mesma régua de consentimento
do perfil aberto na referência).

### 3.2 Entre provedores

Quando o ATS da empresa não é o provedor do talento, a entrega é um webhook
assinado com o envelope
[`ProcessEvent`](https://github.com/Coploy-Team/ots/blob/main/packages/ots-contract/0.3-draft/schemas/process-event.schema.json)
(`interview.schedule_proposed`, `interview.schedule_updated`,
`process.feedback`), carregando o mesmo recurso. Assinatura e registro do
endpoint ficam fora desta spec (a 0.2 já resolve identidade do emissor por
domínio + JWKS; o candidato natural é reusar esse modelo).

## 4. Ameaças consideradas

| Ameaça | Resposta do desenho |
|---|---|
| Link de reunião vazando antes da confirmação | `joinDetails` proibido fora de `confirmed` |
| Agente marcando horário que a empresa não ofereceu | Confirmação só pelo `start` de uma janela proposta, checada pela suíte |
| Retorno virando nota disfarçada | `score`, `approved`, `fit`, `rankingPosition` proibidos por schema |
| Motivo interno exposto ao candidato | Vocabulário fechado só com motivos visíveis; o resto vai `null` |
| Ghosting com "status atualizado" | `message` obrigatório e não vazio |

## 5. Fora desta spec

- Calendário do talento (disponibilidade, integração com agenda). A 0.3 é a
  empresa propondo e a pessoa escolhendo.
- Reagendamento negociado em várias rodadas: uma proposta nova substitui a
  anterior (`interview.schedule_updated`).
- Entrega assinada entre provedores (registro de webhook, chaves).

## 6. Critério para virar spec

Como na 0.2: implementação de referência (core + MCP da Coploy) e um ciclo
validado de ponta a ponta em homolog — empresa propõe pelo ATS, o agente do
talento confirma, a empresa vê a confirmação; e um retorno `not_selected` com
motivo visível chegando ao agente.

## Anexo A — De-para dos motivos (protocolo ↔ Coploy)

| Protocolo | Coploy (`REJECTION_REASONS`) | Visível ao candidato |
|---|---|---|
| `requirements_not_met` | `nao_atende_requisitos` | sim |
| `insufficient_experience` | `experiencia_insuficiente` | sim |
| `salary_mismatch` | `pretensao_salarial` | sim |
| `position_cancelled` | `posicao_cancelada` | sim |
| `other_candidate_hired` | `contratado_outro` | genérico |
| — (`null`) | `perfil_nao_aderente`, `candidato_desistiu`, `outro` | não |
