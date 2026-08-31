# @coploy/ots-contract — o padrão como artefato

Este pacote é a **fonte normativa** do OTS 0.1 (ADR-006, decisão 3): a prosa
([`docs/talent-os/ots/spec-0.1.md`](../../docs/talent-os/ots/spec-0.1.md))
**explica**; os schemas daqui **definem**. Divergência entre os dois é bug da
prosa.

A Coploy é **uma implementação validada contra este artefato**, não a
definição dele. Nenhuma mudança de produto altera o protocolo sem passar por
aqui — a suíte [`@coploy/ots-conformance`](../ots-conformance) roda no CI e
falha o build de quem quebrar o contrato em silêncio.

## Layout

```
0.1/
  schemas/     recursos do protocolo (Job, JobDetails, ProcessEntry, Profile, Salary)
  plugin/      o contrato do plugin de motor de entrevista (ADR-007, decisão 2)
  examples/    payloads válidos — a suíte valida cada um contra seu schema
```

## O que o 0.1 corrige em relação ao draft da prosa (ADR-006, decisão 5)

1. **`Job.interviewUrl` é opcional.** Um provedor sem entrevista por IA é
   conforme; o link de entrevista pertence à *entrada em processo* de quem o
   tem (extensão `interview` do `ProcessEntry`).
2. **`ProcessEntry` tem núcleo mínimo.** Progresso de entrevista
   (`questionsAnswered`/`questionsTotal`/`interviewUrl`) mora na extensão
   opcional `interview` — para outro ATS, candidatura existe e não é
   entrevista.
3. **`salary` ganha forma tipada** (`{min,max,currency,period}`), com texto
   livre aceito como fallback de compatibilidade.

## Proibições executáveis

Os schemas usam `"campo": false` para o que **NÃO DEVE** existir — nota,
aprovação e "fit" em `ProcessEntry`; CPF/documento, nascimento, gênero e raça
em `Profile`. Validador que passa nesses schemas prova a ausência, não só a
presença.

## Contrato do plugin (`0.1/plugin/`)

O limite entre um ATS aberto e um motor de entrevista fechado (ADR-007):

- **Entrada** — `interview-session.schema.json`: operação idempotente de
  criar/retomar sessão para um candidato autenticado numa vaga; o motor
  devolve no mínimo `interviewUrl`.
- **Saída** — `interview-finished.schema.json`: o evento que o motor entrega
  ao terminar, no shape versionado que os Result Webhooks já usam em
  produção.

Qualquer motor que fale este par pluga em qualquer instância do ATS open. O
Motor Coploy é o primeiro certificado contra ele.

## Versionamento e governança

- Semver do protocolo, independente do produto. Aditivo = minor; remoção ou
  mudança de tipo = major. Consumers ignoram campos desconhecidos.
- O padrão é governado pela Coploy (ADR-006, decisão 2). Propostas de mudança:
  issue no repositório do padrão; resposta do editor em até 10 dias úteis;
  decisão registrada no CHANGELOG do artefato com o racional.
