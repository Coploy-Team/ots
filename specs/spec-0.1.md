# OTS 0.1 — Open Talent Standard

**Status:** working draft consolidado (pt-BR) — a publicação open source será em **inglês**, em repositório próprio; este arquivo é a fonte de trabalho até lá
**Data:** 2026-08-15 · **Editores:** Coploy (Henrique Cabral, Diego, V.P., Pilot)
**Origem:** ADR-002 (`docs/talent-os/adr-002-ats-v2-ots.md`) — abre-se o protocolo, não o produto
**Implementação de referência:** `apps/mcp-server` + `CandidateProfile` no core (`/dream-jobs/profile`) + whitelist `PublicJobSummary`
**Nota de consolidação:** este documento funde as duas versões de 2026-08-15 (`spec-0.1.md` e `ots-0.1-spec.md`); a segunda foi removida.

Este documento **explica** o protocolo OTS 0.1. Quem **define** é o artefato
(ADR-006, decisão 3): os JSON Schemas em [`packages/ots-contract/0.1/`](../../../packages/ots-contract/)
— divergência entre esta prosa e o schema é bug da prosa. A conformidade é
executável: [`packages/ots-conformance`](../../../packages/ots-conformance/)
valida artefato, payloads e provedores vivos, e roda no CI contra a
implementação de referência.

Correções do ADR-006 (decisão 5) já aplicadas no artefato e refletidas abaixo:
`Job.interviewUrl` é **opcional**; `ProcessEntry` tem núcleo mínimo com o
progresso de entrevista em **extensão** `interview`; `salary` tem forma
**tipada** com texto livre como fallback.

---

## 1. Escopo, não-escopo e convenções

### 1.1 Escopo (OTS 0.1)

Três capacidades:

| Capacidade | O que o protocolo padroniza |
|---|---|
| **Descoberta de vaga** | Listar e obter detalhes de oportunidades **públicas e abertas**, com superfície de dados deliberadamente restrita |
| **Entrada em processo** | Autenticar o talento, preparar a sessão que o coloca no processo seletivo da vaga, e listar as entradas já iniciadas |
| **Perfil portátil** | Currículo estruturado do talento, com merge parcial, completude e **proveniência por campo** |

**Princípio central:** o dado é do talento. O perfil viaja com a pessoa, não fica preso no sistema que o coletou — é isso que diferencia um *standard* com efeito de rede de uma API de integração com nome bonito.

### 1.2 Não-escopo (explícito)

| Item | Motivo |
|---|---|
| **Motor de avaliação por IA** (notas, aprovação, aderência à vaga, conteúdo de perguntas) | Produto closed; nunca entra na superfície pública (whitelist de vaga e contrato de insights do candidato) |
| **Registro de entrevista verificada** (assinatura, consentimento, revogação, verificação) | Próxima versão do OTS — ver §8; não prometido no 0.1 |
| Persistência, multi-tenant interno, billing, créditos, kanban do recrutador | Fora do protocolo |
| Widgets de UI, prompts de assistente, copy de condução de conversa | Específicos do host MCP/Apps SDK; não são contrato OTS |
| CPF / documento fiscal do talento | Dado sensível; a implementação de referência **não** devolve em respostas de API |
| Descoberta de perfil / sourcing sem consentimento | O compartilhamento do perfil é sempre ato do talento (ou do agente autorizado via OAuth); diretório é problema explicitamente fora do 0.1 |

### 1.3 Vocabulário

O recurso de protocolo é `ProcessEntry` — a participação do talento num
processo, qualquer que seja a mecânica do provedor. **Na implementação de
referência (Coploy)** a entrada acontece abrindo uma entrevista (URL) e
gravando respostas; para outro ATS, uma candidatura tradicional também é uma
`ProcessEntry` válida. O progresso de entrevista é extensão, não núcleo
(ADR-006, decisão 5 — esta seção descrevia o vocabulário do produto como se
fosse regra do protocolo).

### 1.4 Convenções

Palavras-chave **DEVE** (MUST), **NÃO DEVE** (MUST NOT), **DEVERIA** (SHOULD), **PODE** (MAY) seguem a RFC 2119. Datas são ISO 8601; datas de currículo usam granularidade de mês (`YYYY-MM`). Idiomas usam BCP 47 (`pt-BR`, `en`); países preferem ISO-3166-1 alpha-2. Payloads são JSON UTF-8 sobre HTTPS. Clientes **DEVEM** ignorar campos desconhecidos (forward compatibility, §6.3).

---

## 2. Modelo de recursos

Nomes abaixo são do **protocolo**. O de-para com tipos internos Coploy está no Anexo B.

### 2.1 `Job` (resumo público)

Projeção pública de uma vaga. Derivada da whitelist `PublicJobSummary` — o que **não** está aqui não pode ser exposto por um provedor conforme.

| Campo | Tipo | Obrig. | Semântica |
|---|---|---|---|
| `jobId` | string | sim | Identificador da vaga no provedor |
| `companyId` | string | sim | Identificador da empresa anunciante |
| `title` | string | sim | Título da vaga (`jobName` na ref.) |
| `companyName` | string \| null | não | Nome público da empresa |
| `companyLogo` | string (URL) \| null | não | Logo |
| `location` | string \| null | não | Localização já normalizada para exibição |
| `workModality` | string \| null | não | Presencial / remoto / híbrido etc. |
| `employmentType` | string \| null | não | Tipo de vínculo |
| `careerLevel` | string \| null | não | Senioridade anunciada |
| `language` | string \| null | não | Idioma da vaga/entrevista (BCP 47); ausente = legado pt-BR na ref. |
| `salary` | string \| Salary \| null | não | Texto livre (fallback) OU forma tipada `{min,max,currency,period}` — ver `salary.schema.json` |
| `mainSkills` | string \| null | não | Skills em texto livre |
| `postedAt` | string (ISO-8601) \| null | não | Publicação |
| `interviewUrl` | string (URL) \| null | **não** | OPCIONAL (ADR-006): provedor sem entrevista por IA é conforme; o link vive na extensão `interview` do `ProcessEntry` |

**Regras de elegibilidade (provedor):** só vagas `public`, não paradas, não arquivadas, com `closingDate` futura (se houver), e que **não** sejam artefatos internos de "entrevista de perfil". Lookup por id de vaga privada/encerrada **DEVE** retornar **não encontrado** (sem vazar existência além disso).

**Proibido na superfície pública:** perguntas da entrevista, competências/avaliação internas, dados de criador, lista de candidatos.

### 2.2 `JobDetails` (extends `Job`)

| Campo | Tipo | Obrig. | Semântica |
|---|---|---|---|
| *(todos de `Job`)* | | | |
| `description` | string \| null | não | Descrição pública |
| `requirements` | string \| null | não | Requisitos |
| `responsibilities` | string \| null | não | Responsabilidades |
| `benefits` | string \| null | não | Benefícios |
| `companyDescription` | string \| null | não | Sobre a empresa |
| `contractType` | string \| null | não | Tipo de contrato |
| `jobHours` | string \| null | não | Jornada |
| `educationalRequirements` | string[] \| null | não | Escolaridade |
| `requiresPreviousExperience` | boolean \| null | não | Exige experiência prévia |
| `closingDate` | string (ISO-8601) \| null | não | Encerramento |
| `interviewMode` | string \| null | não | Modalidade da entrevista |
| `questionCount` | number \| null | não | Quantidade de perguntas quando o provedor tem entrevista — **nunca** o conteúdo |

### 2.3 `ProcessEntry` (entrada em processo)

Representa a participação do talento autenticado em uma vaga real. Na implementação de referência é criada/retomada ao chamar a máquina de sessão de entrevista (idempotente).

| Campo | Tipo | Obrig. | Semântica |
|---|---|---|---|
| `id` | string | sim | Id da entrada no provedor |
| `jobId` | string \| null | não | Vaga associada |
| `companyId` | string \| null | não | Empresa |
| `jobName` | string \| null | não | Título no momento |
| `companyName` | string \| null | não | |
| `companyLogo` | string \| null | não | |
| `status` | `pending` \| `in_progress` \| `completed` | sim | Progresso da PARTICIPAÇÃO (não etapa interna do pipeline) |
| `startedAt` | string (ISO-8601) \| null | não | |
| `completedAt` | string (ISO-8601) \| null | não | |
| `feedback` | objeto \| null | não | Observações **não-avaliativas** (ver abaixo) |
| `interview` | objeto \| null | não | **Extensão** (ADR-006, decisão 5): progresso de entrevista para provedores que a têm — `{questionsAnswered, questionsTotal, interviewUrl?}` |

A referência preenche a extensão `interview` em toda entrada (o processo dela
É a entrevista); um ATS de candidatura tradicional simplesmente a omite.

**`feedback` (visão do talento):**

| Campo | Tipo | Semântica |
|---|---|---|
| `strengths` | string[] | Pontos observados nas respostas |
| `development` | string[] | Onde desenvolver |
| `suggestions` | string[] | Sugestões práticas |

**Contrato normativo:** um provedor OTS 0.1 **NÃO DEVE** incluir em `ProcessEntry` (nem em operação correlata) nota numérica, aprovação/reprovação ou "fit" com a vaga. Isso é veredito do recrutador / Motor — fora do protocolo.

**Lacuna:** não há recurso `Application` separado (status de "currículo enviado", etapas de pipeline do recrutador, motivos tipados de reprovação na superfície do talento além do que `rejectionExplanation` / `failedRequirementLabel` já devolvem na listagem). A entrada no processo **é** a sessão de entrevista.

Campos opcionais já presentes na listagem de referência (informativos, não modelo completo de ATS):

| Campo | Tipo | Semântica |
|---|---|---|
| `rejectionExplanation` | string \| null | Explicação humana se houve knockout/reprovação visível ao candidato |
| `failedRequirementLabel` | string \| null | Requisito que falhou, quando aplicável |

### 2.4 `Profile` (perfil portátil)

Currículo estruturado do talento. Fonte de verdade na ref.: perfil do candidato (não o documento de identidade mínimo).

#### 2.4.1 Campos escalares

| Campo | Tipo | Obrig. | Semântica |
|---|---|---|---|
| `id` | string | sim | Id do talento (= sujeito autenticado) |
| `name` | string \| null | não | Nome de exibição |
| `email` | string \| null | não | Ver regra de contato em §2.4.4 |
| `phone` | string \| null | não | Ver regra de contato em §2.4.4 |
| `photoUrl` | string \| null | não | Ver regra de exposição em §2.4.4 |
| `headline` | string \| null | não | Uma linha, estilo LinkedIn |
| `summary` | string \| null | não | Resumo profissional |
| `occupation` | string \| null | não | Cargo/profissão atual ou alvo |
| `level` | string \| null | não | Senioridade (texto livre na ref.) |
| `yearsOfExperience` | number \| null | não | Anos |
| `professionalObjectives` | string \| null | não | Objetivos |
| `company` | string \| null | não | Empresa atual (atalho; série completa em `experiences`) |
| `location` | string \| null | não | Cidade/região ou remoto |
| `countryOfResidence` | string \| null | não | Preferência: ISO-3166-1 alpha-2 |
| `countriesOfInterest` | string[] \| null | não | Países de interesse (ISO-2) |
| `skills` | string[] \| null | não | |
| `resumeUrl` | string (URL) \| null | não | Arquivo de currículo, se houver |
| `linkedinUrl` | string (URL) \| null | não | URL do perfil LinkedIn (sem scraping) |
| `completeness` | number (0–100) \| null | não | Calculado pelo provedor |
| `fieldSources` | map string → `FieldSource` \| null | não | Proveniência (§3) |
| `missingFields` | string[] | não* | Nomes de campos ainda vazios, priorizados por impacto |

\* Sempre presente nas respostas de leitura da ref. (pode ser `[]`).

#### 2.4.2 Listas

**`experiences[]`**

| Campo | Tipo | Semântica |
|---|---|---|
| `id` | string \| null | |
| `title` | string \| null | Cargo |
| `company` | string \| null | |
| `location` | string \| null | |
| `startDate` | string \| null | `YYYY-MM` |
| `endDate` | string \| null | `YYYY-MM`; omitir/null se atual |
| `current` | boolean \| null | |
| `description` | string \| null | |
| `skills` | string[] \| null | |

**`education[]`:** `id`, `institution`, `degree`, `fieldOfStudy`, `startDate`, `endDate`, `current`, `description`.

**`languages[]`:** `language`, `proficiency` ∈ `basic` \| `intermediate` \| `advanced` \| `fluent` \| `native`.

**`certifications[]`:** `id`, `name`, `issuer`, `issueDate`, `expirationDate`, `credentialUrl`.

#### 2.4.3 Semântica de escrita

- **Merge parcial:** campos omitidos preservam o valor atual.
- **Importação em lote:** escalares só preenchem lacunas; skills fazem união case-insensitive; listas deduplicam por identidade (`title+company`, `institution+degree`, `language`, `name+issuer`).
- **Append de item:** acrescenta um elemento a uma lista sem substituir a lista inteira.
- Consumers **NÃO DEVEM** sobrescrever silenciosamente campo com origem manual (a pessoa digitou) usando fonte automática — a proveniência (§3) é o que torna essa regra verificável.

#### 2.4.4 Privacidade do perfil (normativo)

O 0.1 só define operações **self-scoped** (o talento lendo/escrevendo o próprio perfil via Bearer), então `email`/`phone`/`photoUrl` podem circular nessas operações. Fora desse escopo, valem as regras:

1. **Atributos protegidos NUNCA entram no perfil portátil:** documento de identidade/CPF ou equivalente nacional, data de nascimento, gênero, raça e qualquer atributo protegido de discriminação **NÃO DEVEM** aparecer em nenhum campo (nem em extensão `x-`). O que não está no documento não vaza — e blinda consumers de usar esses atributos em ranking (alinhado à regra "features protegidas nunca entram no modelo").
2. **Contato é opt-in no compartilhamento:** se uma versão futura definir troca de perfil com terceiros (empresa, outro ATS), `email`/`phone`/`photoUrl` **NÃO DEVEM** ser incluídos sem ação explícita do talento no ato do compartilhamento.
3. **Export é obrigação do provedor:** um Profile Producer **DEVE** oferecer ao talento o export completo do próprio perfil (portabilidade é o produto — e também LGPD Art. 18 / GDPR Art. 20).

---

## 3. Proveniência (`fieldSources`)

Diferencial do perfil portátil: cada campo sabe **de onde veio**, para uma fonte automática não sobrescrever em silêncio o que a pessoa escreveu.

### 3.1 Formato

```text
fieldSources: {
  "<nomeDoCampo>": <FieldSource>,
  ...
}
```

`FieldSource` (enum fechado na ref.):

| Valor | Significado |
|---|---|
| `chat` | Preenchido via conversa / assistente |
| `dashboard` | Área do candidato (formulário) |
| `resume` | Importação a partir de currículo |
| `linkedin` | Material LinkedIn colado/estruturado (não crawler) |
| `interview` | Derivado de fluxo de entrevista |

Regras observadas na implementação:

- Ao atualizar um conjunto de campos, o provedor grava `fieldSources[campo] = source` daquela escrita.
- CPF (quando existir internamente) **não** entra em `fieldSources` exposto.
- A chave do mapa é o nome do campo do `Profile` (ex.: `summary`, `skills`).

Valores novos de `FieldSource` seguem a regra de enum de §6.3 (versão nova ou extensão vendor-prefixed).

### 3.2 Lacuna de interoperabilidade

O OTS 0.1 **especifica** o mapa e o enum porque existem no domínio e na API do core. A tipagem do cliente MCP de referência **não lista** `fieldSources` explicitamente no DTO local — o valor viaja dentro do objeto de perfil quando o core o devolve. Um implementador conforme deve:

1. Persistir e devolver `fieldSources` em leituras de `Profile`.
2. Aceitar (ou derivar) a fonte em escritas.

Não há ainda um documento de troca (`Profile` serializado standalone, assinatura, ou export cross-vendor) além das operações de API — ver §6.

---

## 4. Autenticação

### 4.1 Modelo

OAuth **2.1**, cliente público, fluxo **authorization code + PKCE S256**, com **Dynamic Client Registration**.

RFCs cobertas pela implementação de referência:

| RFC | Uso |
|---|---|
| [RFC 7591](https://www.rfc-editor.org/rfc/rfc7591) | Dynamic Client Registration (`POST .../oauth/register`) |
| [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636) | PKCE; método suportado: `S256` apenas |
| [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414) | Metadata do Authorization Server (`/.well-known/oauth-authorization-server`) |
| [RFC 9728](https://www.rfc-editor.org/rfc/rfc9728) | Protected Resource Metadata (`/.well-known/oauth-protected-resource`) |
| [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252) | Redirect `http://localhost` / `127.0.0.1` permitido em desenvolvimento; produção exige `https` |

Request não autenticado a recurso protegido **DEVE** responder 401 com `WWW-Authenticate` apontando a descoberta — é o que permite a um agente iniciar o fluxo OAuth sozinho.

### 4.2 Endpoints (forma lógica)

| Endpoint | Função |
|---|---|
| Registration | Emite `client_id`; `token_endpoint_auth_method=none`; grants `authorization_code` + `refresh_token` |
| Authorize | `response_type=code`; login/signup do talento; exige `code_challenge` |
| Token | Troca `code` + `code_verifier` → access + refresh; ou refresh grant |
| Resource | Bearer no header; scope de referência: `candidate` |

### 4.3 TTLs da referência (informativos, não normativa rígida)

| Artefato | TTL (ref.) |
|---|---|
| Authorization code | 120 s |
| Access token | 1 h |
| Refresh token | 30 d |
| Client id (JWT DCR) | 365 d |

### 4.4 Trade-offs documentados da referência

- Tokens são JWT HS256 **stateless** (claims no próprio token: redirect URIs do client, challenge PKCE, uid).
- **Sem revogação server-side** até existir store — um implementador pode escolher store + revogação sem sair do OTS 0.1, desde que o wire OAuth 2.1 + PKCE + DCR se mantenha.
- Descoberta de vaga pode ser oferecida **sem** Bearer (ref. com flag de ambiente); operações de conta **exigem** Bearer.

---

## 5. Transporte e operações

### 5.1 Transporte

- **Implementação de referência:** MCP over Streamable HTTP (`POST` no resource MCP), tools nomeadas.
- **Norma OTS:** as operações abaixo são **independentes de transporte**. Um binding REST, GraphQL ou outro MCP host deve expor a mesma semântica (nomes de operação abaixo são canônicos do protocolo; o binding MCP da Coploy usa snake_case nas tools — Anexo B).
- **Binding REST (não-normativo, reservado):** quando materializado, o binding REST usa o prefixo versionado `/ots/v0.1/` (ex.: `GET /ots/v0.1/jobs`, `GET /ots/v0.1/jobs/{jobId}`, `POST /ots/v0.1/entries`, `GET/PATCH /ots/v0.1/profile`). Os endpoints ainda não existem na implementação de referência — **lacuna**; o caminho fica reservado para a spec não nascer colada nos paths internos de nenhum vendor.

### 5.2 Operações — descoberta (auth opcional)

#### `discoverJobs`

**Entrada**

| Campo | Tipo | Obrig. | Semântica |
|---|---|---|---|
| `query` | string | não | Texto livre; tokens AND sobre título, empresa, skills, local etc. |
| `language` | `pt-BR` \| `en` | não | Filtro de idioma; se omitido e autenticado, a ref. usa idioma do perfil |
| `limit` | int 1–25 | não | Default 10 |

**Saída**

| Campo | Tipo | Semântica |
|---|---|---|
| `jobs` | `Job[]` | Página |
| `totalAvailable` | number | Total que casa com o filtro (antes do limit) — paginação = nova chamada com `limit` maior |
| `language` | string | Idioma efetivo usado |

#### `getJob`

**Entrada:** `companyId`, `jobId`
**Saída:** `JobDetails` ou erro `job_not_found` (privada/encerrada/inexistente).

### 5.3 Operações — entrada em processo (Bearer obrigatório)

#### `startProcessEntry`

Prepara ou retoma a sessão do talento na vaga. **Idempotente** para o mesmo par (talento, vaga).

**Entrada:** `companyId`, `jobId`
**Saída (mínima observada):**

| Campo | Tipo | Semântica |
|---|---|---|
| `jobName` | string \| null | |
| `companyName` | string \| null | |
| `interviewUrl` | string | Abrir no navegador — a entrevista **não** ocorre no canal da tool |
| `questionsAnswered` | number | |
| `questionsTotal` | number | |
| `status` | `not_started` \| `in_progress` \| `finished` | |
| `interviewFinished` | boolean | |

Guards: vaga deve passar nas regras de `Job` público/aberto; senão `job_not_found`.

#### `listMyProcessEntries`

**Saída:**

| Campo | Tipo | Semântica |
|---|---|---|
| `companyEntries` | `ProcessEntry[]` | Entradas em vagas reais |
| `total` | number | |

**Lacuna / extensão Coploy (não normativa OTS 0.1):** a ref. também devolve `profileInterview` (entrevista sobre a própria carreira, sem empresa contratante). Isso é produto Coploy (hunting / Dream Jobs), **não** faz parte do contrato mínimo de entrada em processo do OTS 0.1. Um provedor conforme pode omitir.

### 5.4 Handoff de sessão (opcional; normativo quando usado)

Quando o `interviewUrl` de `startProcessEntry` cruza de um sistema autenticado (o agente) para outro (o web app onde a entrevista acontece), o link fica escrito numa conversa que pode ser compartilhada ou persistir no histórico. Por isso, o link **NÃO DEVE** carregar credencial de longa duração. Um provedor que queira poupar o re-login **DEVE** usar o padrão do **ticket one-shot**:

1. Ticket opaco com ≥ 32 bytes de entropia e **TTL ≤ 5 minutos**, atrelado ao talento, emitido junto com a operação de ação.
2. O ticket viaja como query param do `interviewUrl`; o destino o troca por sessão no boot e limpa a URL do histórico.
3. O resgate é **atômico e de uso único** — replay e corrida não passam.
4. A mensagem de erro de resgate é **única** (não distingue expirado / inexistente / já usado).
5. Falha na emissão degrada para `interviewUrl` sem ticket (o destino pede login) — nunca bloqueia o fluxo.
6. Tickets **DEVEM** ser emitidos apenas em operações de **ação** (entrar num processo), nunca em listagens.

O handoff é opcional (um provedor conforme pode simplesmente exigir login no destino), mas quem transportar sessão por URL **DEVE** seguir as regras acima. (Padrão em produção na referência desde 2026-08-10 — `interviewHandoffs`.)

### 5.5 Operações — perfil portátil (Bearer obrigatório)

#### `getProfile`

**Saída:** `Profile` (+ `missingFields`, `completeness`).
Na ref. MCP, a tool ainda acrescenta orientação de conversa (`nextStep`, `askAbout`) — isso é **DX de assistente**, não campo do recurso `Profile`. Binding não-MCP pode omitir.

#### `updateProfile`

Merge parcial dos escalares/listas simples listados na tool de ref. (`occupation`, `level`, `headline`, `summary`, `yearsOfExperience`, `skills`, `location`, `countryOfResidence`, `countriesOfInterest`, `professionalObjectives`, `company`, `linkedinUrl`, `phone`).
**Saída:** confirmação + `completeness` / `missingFields` atualizados.

#### `importProfile`

Importação em lote (escalares + `experiences` / `education` / `languages` / `certifications` / `skills`) com as regras de §2.4.3.

#### `addProfileEntry`

Acrescenta **um** item em `experiences` \| `education` \| `languages` \| `certifications`.

### 5.6 Extensões presentes no código e **fora** do OTS 0.1 normativo

Documentadas para não serem confundidas com o protocolo:

| Capacidade no mcp-server | Por que não é OTS 0.1 |
|---|---|
| `start_profile_interview` / status de entrevista de perfil | Fluxo proprietário de hunting; depende do Motor e de vaga-espelho interna |
| `get_my_insights` | Coaching a partir de entrevistas; útil, mas acoplado ao Motor e deliberadamente sem veredito |
| `complete_my_profile` (widget) | UX de formulário no host ChatGPT |
| Widgets `text/html+skybridge` | Binding Apps SDK, não protocolo |

*(O handoff, antes listado aqui, foi promovido a padrão opcional-normativo — §5.4.)*

---

## 6. Versionamento e extensão

### 6.1 O que o 0.1 promete

- Superfície pública de `Job` / `JobDetails` sem vazamento de avaliação/perguntas.
- Entrada em processo via sessão de entrevista idempotente + listagem sem nota/aprovação.
- `Profile` com merge, importação defensiva, `fieldSources` e as regras de privacidade de §2.4.4.
- OAuth 2.1 + DCR + PKCE S256 como caminho de autenticação do talento.

### 6.2 O que o 0.1 **não** promete (candidatos naturais à 0.2)

- Formato de arquivo assinado / portabilidade offline do perfil.
- Compartilhamento de perfil com terceiros (empresa, outro ATS) — inclui as regras de contato opt-in de §2.4.4.
- Faixa salarial tipada em `Job` (`min`/`max`/`currency`/`period`) — hoje texto livre, realidade dos dados.
- Interoperabilidade de **resultados** de entrevista entre ATS.
- Paridade com o catálogo completo de eventos/módulos do blueprint Talent OS.
- Revogação OAuth server-side (apenas na ref. atual).

### 6.3 Extensão sem quebra

1. Campos **novos opcionais** em recursos existentes são permitidos; clientes devem ignorar desconhecidos.
2. Campos **obrigatórios novos** ou mudança de semântica de campo existente exigem **minor/major** (`OTS 0.2` / `1.0`) — não redefinir 0.1 em silêncio.
3. Operações novas = extensão; um provedor "OTS 0.1 conforme" (§7) não é obrigado a implementá-las.
4. Enums (`FieldSource`, `language`, `proficiency`): valores novos só em versão nova, ou documentados como extensão vendor-prefixed se inevitáveis antes disso.
5. Extensões proprietárias usam prefixo `x-`.

### 6.4 Identificação

Provedores e clientes DEVEM declarar suporte a `OTS/0.1` (header, metadata OAuth, ou campo de descoberta do binding). A ref. MCP ainda **não** emite esse identificador de protocolo — **lacuna** (hoje o server MCP se anuncia como `coploy` `1.0.0`).

---

## 7. Anexo A — Conformidade OTS 0.1

Um sistema pode afirmar **"fala OTS 0.1"** se implementar **tudo** abaixo.

### Provedor (server)

- [ ] `discoverJobs` e `getJob` com whitelist equivalente a §2.1–2.2 (sem perguntas/avaliação).
- [ ] Guards de vaga pública/aberta; id privado → not found.
- [ ] `startProcessEntry` autenticado, idempotente, devolvendo `interviewUrl`.
- [ ] `listMyProcessEntries` sem nota/aprovação/fit.
- [ ] `getProfile` / `updateProfile` / `importProfile` / `addProfileEntry` com merge e regras de importação §2.4.3.
- [ ] Regras de privacidade do perfil (§2.4.4): sem atributos protegidos; export completo disponível ao talento.
- [ ] Persistência e exposição de `fieldSources` (§3).
- [ ] OAuth 2.1 authorization code + PKCE S256 + DCR (RFC 7591) + metadata 8414/9728 (ou discovery equivalente no binding).
- [ ] Escopo de talento separado de sessão de empresa/recrutador.
- [ ] Se transportar sessão por URL: padrão de handoff one-shot (§5.4).

### Cliente

- [ ] Descobre AS/resource e registra-se (ou usa client pré-registrado compatível).
- [ ] Completa PKCE S256.
- [ ] Usa Bearer nas operações de conta.
- [ ] Trata `interviewUrl` como ação no **navegador** (não simula entrevista no próprio cliente obrigatoriamente).
- [ ] Não assume campos de veredito (score/approved) na listagem.
- [ ] Ignora campos desconhecidos (§6.3).

### Não é requisito de conformidade 0.1

- Widgets, prompts MCP, handoff (opcional — mas normativo quando usado), entrevista de perfil, insights.
- Publicar código do Motor ou do ATS.

---

## 8. Rascunho — versão futura (registro de entrevista verificada)

**Não faz parte do OTS 0.1.** Visão: uma entrevista realizada num sistema vira um registro portátil e verificável — o talento leva a prova, não só o texto. Esboço de forma (sujeito a tudo abaixo): documento `ots.attestation` com claims mínimos (quem, quando, em que processo, resultado agregado — nunca o conteúdo bruto), assinado (JWS), com endpoint de verificação e status de revogação.

Perguntas em aberto (ADR-002), sem resolução aqui:

1. Quem atesta o registro — se a Coploy assina, ela vira autoridade certificadora?
2. ATS concorrente lendo entrevista emitida pela Coploy — canibaliza ou distribui o Motor?
3. Consentimento / revogação / expiração de dado sensível de avaliação.
4. Infraestrutura de chaves de assinatura + endpoint de verificação.

---

## Anexo B — De-para (protocolo ↔ Coploy)

| OTS 0.1 | Coploy (interno / ref.) |
|---|---|
| `Job` | `PublicJobSummary` ← projeção de `PostJob` (+ logo de `Company`) |
| `Job.title` | `jobName` |
| `Job.careerLevel` | `carrerLevel` (typo legado no domínio) |
| `JobDetails` | `PublicJobDetails` |
| `JobDetails.questionCount` | `job.jobQuestions.length` (conteúdo nunca exposto) |
| `ProcessEntry` | Resumo em `CandidateInterviewSummary` / sessão via `GET /interview/session` (orchestrator); persistência interna `JobApplied` |
| `ProcessEntry` (criar/retomar) | Tool MCP `start_interview` → `CandidateInterviewsService.startInterview` |
| `listMyProcessEntries` | Tool `get_my_interviews` → `GET /interviews/mine` (`companyInterviews`) |
| Handoff (§5.4) | `interviewHandoffs` (`POST /dream-jobs/interview/handoff[/exchange]`) |
| `Profile` | `CandidateProfile` (`@coploy/domain` + `/dream-jobs/profile`) |
| `FieldSource` | `CandidateProfileSource` |
| `discoverJobs` | Tool `search_jobs` |
| `getJob` | Tool `get_job_details` |
| `getProfile` | Tool `get_my_profile` (payload enriquecido com DX de assistente) |
| `updateProfile` | Tool `update_my_profile` |
| `importProfile` | Tool `import_profile` |
| `addProfileEntry` | Tool `add_profile_entry` |
| OAuth AS/resource | `apps/mcp-server` rotas `/oauth/*` + well-knowns |
| Binding de referência | MCP Streamable HTTP em `POST .../mcp` |

---

## Anexo C — Fontes no repositório (evidência)

| Tópico | Arquivo |
|---|---|
| Decisão open core / escopo OTS | `docs/talent-os/adr-002-ats-v2-ots.md` |
| Whitelist de vaga | `apps/mcp-server/src/lib/services/public-jobs-service.ts` |
| Tools / schemas | `apps/mcp-server/src/mcp/create-mcp-server.ts` |
| Entrada em processo | `apps/mcp-server/src/lib/services/candidate-interviews-service.ts` |
| Perfil no canal | `apps/mcp-server/src/lib/services/candidate-profile-service.ts` |
| Modelo + `fieldSources` | `packages/domain/src/candidate-profile.ts`, `apps/core/src/lib/services/candidate-profile-service.ts` |
| Handoff | `apps/core/src/http/routes/dreamJobs/interview-handoff.ts` + `interview_handoffs` (migration 0012) |
| OAuth metadata / DCR / token | `apps/mcp-server/src/http/routes/oauth/{metadata,register,token}.ts`, `lib/oauth/jwt.ts` |

## Anexo D — Registro de mudanças

| Versão | Data | Mudança |
|---|---|---|
| 0.1-draft | 2026-08-15 | Documento inicial consolidado (fusão das duas versões de trabalho): recursos Job/ProcessEntry/Profile, proveniência, OAuth 2.1, operações canônicas, handoff opcional-normativo, privacidade do perfil, conformidade |
| 0.1-draft2 | 2026-08-21 | ADR-006 executado: o contrato vira ARTEFATO (`packages/ots-contract`, JSON Schema 2020-12) com conformidade executável (`packages/ots-conformance`, roda no CI). Vazamentos corrigidos: `interviewUrl` opcional em Job; `ProcessEntry` com núcleo mínimo + extensão `interview`; `salary` tipado com fallback; §1.3 descreve a referência, não o protocolo; §6.4 declarado (`serverInfo.title: Coploy (OTS/0.1)`). Contrato do plugin de motor (ADR-007): `plugin/interview-session` + `plugin/interview-finished`. Suíte pegou a 1ª não-conformidade real da referência (`jobName` no wire onde o protocolo pede `title`) — corrigida de forma aditiva |
| 0.1-draft3 | 2026-08-21 | **Binding REST** (ADR-006, decisão 7): `0.1/binding/openapi.json` GERADO dos schemas normativos (`scripts/generate-binding-openapi.mjs`; a suíte falha se o commitado divergir do gerado — editar à mão não é caminho). Caminhos: `GET /ots/v0.1/jobs`, `GET /ots/v0.1/jobs/{companyId}/{jobId}` (públicos), `GET /ots/v0.1/profile`, `GET/POST /ots/v0.1/process-entries` (OAuth 2.1 do talento, descoberta RFC 9728). Conformidade de provedor vivo: `ots-conformance rest <base-url> [--token]`. Referência implementada no mcp-server |
