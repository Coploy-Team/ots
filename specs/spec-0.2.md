# OTS 0.2 — Registro de entrevista verificada

**Status:** **SPEC** — promovida de draft em 2026-08-21, com o critério
cumprido no mesmo dia: ciclo validado de ponta a ponta em homolog (emissão
pela tela de consentimento, tier respeitado pelo schema, assinatura Ed25519
verificada offline pela suíte contra o JWKS público, revogação do talento
refletida no statusUrl). Referência: core assina em `POST /ots/attestations`,
JWKS em `/.well-known/ots/jwks.json` (contrato 0.59).
**Data:** 2026-08-21 · **Editores:** Coploy
**Artefato normativo:** [`packages/ots-contract/0.2/`](../../../packages/ots-contract/)
**Conformidade:** `ots-conformance attestation <arquivo.jws> [--jwks …]` — já
executável contra o exemplo assinado do artefato (Ed25519 real, verificada no CI)

Currículo é afirmação. **Registro de entrevista verificada é prova**: a pessoa
respondeu aquilo, naquele momento, naquele processo — e qualquer um checa
**sem perguntar a quem guardou**. É a manchete do 0.2 (ADR-006, decisão 1) e o
que dá a alguém razão de implementar o padrão.

---

## 1. O documento: `ots.attestation`

Um **JWS compact** (`header.payload.signature`):

- `alg: EdDSA` (Ed25519) — obrigatório no 0.2; `typ: ots-attestation+jws`;
  `kid` aponta a chave no JWKS do emissor.
- Payload = claims validáveis por
  [`attestation.schema.json`](../../../packages/ots-contract/0.2/schemas/attestation.schema.json).
- O que NUNCA entra (proibições executáveis no schema): respostas,
  transcrição, áudio/vídeo, `approved`, e os atributos protegidos de sempre
  (CPF/documento, nascimento, gênero).

### Claims, em uma linha cada

| Claim | O quê |
|---|---|
| `iss` | URL base do provedor que CONDUZIU a entrevista — a âncora de confiança |
| `sub` | Id opaco do talento no emissor (nunca PII em claro) |
| `jti` | Id único — chave de revogação |
| `iat` / `exp` | Emissão / expiração escolhida pelo talento (ref.: default 2 anos) |
| `tier` | `existence` \| `summary` \| `full` — o quanto a pessoa escolheu divulgar |
| `subject` | `displayName` + `emailHash` (sha256) — liga a prova à pessoa sem vazar o e-mail |
| `process` | Empresa/vaga — a prova sem contexto não significa nada |
| `interview` | O fato: `completedAt`, modo, idioma, nº de perguntas, duração |
| `outcome` | Resultado AGREGADO conforme o tier (`summary` = qualitativo; `full` = + score 0–10) |
| `statusUrl` | Onde consultar revogação |

### Os três tiers (consentimento como estrutura, não como checkbox)

A emissão é ato explícito do talento, e o **tier é decidido por ele no ato**:

- **`existence`** — só que a entrevista aconteceu. `outcome` é `null` (o
  schema rejeita qualquer coisa além).
- **`summary`** — + leitura qualitativa (pontos fortes, áreas de
  desenvolvimento). `score` é PROIBIDO no schema.
- **`full`** — + o score agregado. Nunca as respostas.

Quem recebe um attestation sabe pelo próprio documento o quanto foi
consentido — não há como o verificador "pedir mais" ao emissor.

## 2. Verificação (independente) e revogação (do talento)

1. **Assinatura — offline.** O verificador resolve
   `{iss}/.well-known/ots/jwks.json`, acha a chave pelo `kid` e verifica o
   Ed25519. Nenhuma chamada ao emissor além do JWKS (cacheável); nenhuma à
   Coploy.
2. **Revogação — uma consulta.** `GET statusUrl` →
   [`attestation-status.schema.json`](../../../packages/ots-contract/0.2/schemas/attestation-status.schema.json):
   `valid` | `revoked` | `unknown`. Público, sem auth. `unknown` não revela se
   o jti algum dia existiu. Modelo mental: certificado × CRL.
3. **Revogar é do talento** (ADR-006, decisão 6, corolário): o provedor
   executa a revogação a pedido da pessoa, não decide por ela. Revogado é
   permanente.

## 3. Respostas às perguntas em aberto do §8 (0.1)

> **DECIDIDAS pela governança (Henrique Cabral, 2026-08-21)** — as quatro
> conforme registradas abaixo. A emissão na referência e a promoção a spec
> aconteceram no mesmo dia, após validação de ponta a ponta.

**1. Quem atesta? A Coploy vira autoridade certificadora?**
Não. Assina **o provedor que conduziu a entrevista** — modelo federado por
domínio, como DKIM no e-mail: a confiança vem do `iss` + JWKS publicado, e
cada verificador decide em quais emissores confia. A Coploy não é CA de
ninguém; é o emissor que a reputação do Motor tornar confiável. Isso elimina
o teto de "selo de fornecedor" e é o que permite um segundo provedor existir
de verdade.

**2. ATS concorrente lendo entrevista emitida pela Coploy — canibaliza ou distribui?**
Distribui. Ler é grátis e todo attestation carrega `iss` — cada verificação é
a marca do Motor circulando embutida numa prova. **Produzir** attestation
exige conduzir entrevista, que é exatamente o que o Motor vende. O incentivo
fica certo: quanto mais gente lê, mais vale produzir.

**3. Consentimento / revogação / expiração de dado sensível de avaliação.**
Consentimento é ESTRUTURA do documento (os tiers), não configuração; emissão
só por ato explícito do talento; `exp` escolhido por ele (default 2 anos);
revogação self-service e consultável; dado de avaliação só existe no tier que
a pessoa escolheu, e o schema torna isso verificável.

**4. Infra de chaves.**
JWKS por provedor em `/.well-known/ots/jwks.json`; rotação por `kid` (chaves
antigas permanecem publicadas enquanto houver attestation vivo assinado por
elas); revogação por jti no `statusUrl`. Para a referência: chave Ed25519 em
secret manager, assinatura no core no ato de emissão — desenho de
implementação fica FORA desta spec (a spec define o documento e o protocolo
de verificação; como cada provedor guarda a chave é problema dele).

## 4. Ameaças consideradas

| Ameaça | Resposta do desenho |
|---|---|
| Adulteração do payload | Assinatura cobre header+payload; a suíte prova que 1 byte derruba |
| Replay em outra pessoa | `subject.emailHash` — o verificador confere o e-mail apresentado pela própria pessoa |
| Correlação/vazamento de PII | `sub` opaco, e-mail só como hash, atributos protegidos proibidos por schema |
| Emissor fantasma | Confiança ancorada no domínio do `iss` (HTTPS + JWKS no host dele) |
| "Confie, nós geramos" | Verificação offline + revogação pública — a Coploy não é consultada |

## 5. Fora desta spec

- Attestation de coisas que não são entrevista (curso, teste técnico) — o
  formato comporta, o 0.2 não promete.
- Descoberta/diretório de attestations — compartilhar é sempre ato do
  talento, nunca busca de terceiros.
