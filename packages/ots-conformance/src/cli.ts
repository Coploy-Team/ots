#!/usr/bin/env tsx
/**
 * Suíte de conformidade OTS 0.1 (ADR-006, decisão 4).
 *
 * Três modos:
 *   validate            — o artefato prova a si mesmo: todo example valida
 *                         contra seu schema E os payloads proibidos FALHAM
 *                         (nota em ProcessEntry, CPF em Profile). Roda no CI
 *                         via `npm test` deste pacote.
 *   webhook <arquivo>   — valida um payload capturado de interview.finished
 *                         (a SAÍDA de um motor candidato a plugin).
 *   provider <url>      — bate num provedor MCP vivo (initialize → tools/list
 *                         → search_jobs) e valida cada vaga devolvida contra
 *                         o schema de Job.
 *   rest <base-url>     — bate no binding REST (/ots/v0.1/*) de um provedor
 *                         vivo e valida as respostas contra os schemas.
 *                         `--token <bearer>` inclui as superfícies do talento
 *                         (profile, process-entries).
 *
 * "OTS 0.1 conforme" é fato verificável, não afirmação: quem passa aqui,
 * passa; quem não roda, não afirma.
 */
import { createPublicKey, verify as cryptoVerify } from 'node:crypto'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

// __dirname funciona nos dois módulos-alvo do tsx (CJS/ESM interop)
const contractRoot = join(__dirname, '..', '..', 'ots-contract', '0.1')
const v02Root = join(__dirname, '..', '..', 'ots-contract', '0.2')

type Json = Record<string, unknown>

function loadJson(path: string): Json {
	return JSON.parse(readFileSync(path, 'utf8')) as Json
}

function buildValidator() {
	const ajv = new Ajv2020({ allErrors: true, strict: false })
	addFormats(ajv)
	for (const dir of ['schemas', 'plugin']) {
		for (const file of readdirSync(join(contractRoot, dir))) {
			if (!file.endsWith('.schema.json')) continue
			ajv.addSchema(loadJson(join(contractRoot, dir, file)))
		}
	}
	if (existsSync(join(v02Root, 'schemas'))) {
		for (const file of readdirSync(join(v02Root, 'schemas'))) {
			if (!file.endsWith('.schema.json')) continue
			ajv.addSchema(loadJson(join(v02Root, 'schemas', file)))
		}
	}
	return ajv
}

const SCHEMA_IDS = {
	job: 'https://ots.coploy.io/0.1/schemas/job.schema.json',
	jobDetails: 'https://ots.coploy.io/0.1/schemas/job-details.schema.json',
	processEntry: 'https://ots.coploy.io/0.1/schemas/process-entry.schema.json',
	profile: 'https://ots.coploy.io/0.1/schemas/profile.schema.json',
	interviewSession: 'https://ots.coploy.io/0.1/plugin/interview-session.schema.json',
	interviewFinished: 'https://ots.coploy.io/0.1/plugin/interview-finished.schema.json',
	attestation: 'https://ots.coploy.io/0.2/schemas/attestation.schema.json',
	attestationStatus: 'https://ots.coploy.io/0.2/schemas/attestation-status.schema.json',
} as const

/** JWS compact decodificado, sem verificar — a verificação vem depois, com JWKS. */
function decodeJws(jws: string): {
	header: { alg?: string; typ?: string; kid?: string }
	payload: Json
	signingInput: string
	signature: Buffer
} {
	const parts = jws.trim().split('.')
	if (parts.length !== 3) throw new Error('JWS compact precisa de 3 partes (header.payload.signature)')
	return {
		header: JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as {
			alg?: string
			typ?: string
			kid?: string
		},
		payload: JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as Json,
		signingInput: `${parts[0]}.${parts[1]}`,
		signature: Buffer.from(parts[2], 'base64url'),
	}
}

/**
 * Verificação INDEPENDENTE (ADR-006, decisão 6): assinatura Ed25519 contra a
 * chave pública do emissor — sem perguntar nada a ninguém. Revogação é a
 * única consulta online (statusUrl), fora do escopo desta função.
 */
function verifyAttestationSignature(
	jws: ReturnType<typeof decodeJws>,
	jwks: { keys: Array<Record<string, unknown>> },
): boolean {
	const key = jwks.keys.find((candidate) => candidate.kid === jws.header.kid) ?? jwks.keys[0]
	if (!key) return false
	const publicKey = createPublicKey({ key: key as never, format: 'jwk' })
	return cryptoVerify(null, Buffer.from(jws.signingInput), publicKey, jws.signature)
}

/** example → schema, por prefixo do nome do arquivo. */
const EXAMPLE_SCHEMA: Array<[prefix: string, schemaId: string]> = [
	['job-with-interview', SCHEMA_IDS.job],
	['job', SCHEMA_IDS.job],
	['process-entry', SCHEMA_IDS.processEntry],
	['profile', SCHEMA_IDS.profile],
	['interview-session', SCHEMA_IDS.interviewSession],
	['interview-finished', SCHEMA_IDS.interviewFinished],
]

function check(ajv: Ajv2020, schemaId: string, data: unknown, label: string): boolean {
	const validate = ajv.getSchema(schemaId)
	if (!validate) {
		console.error(`✗ schema não registrado: ${schemaId}`)
		return false
	}
	if (validate(data)) {
		console.log(`✓ ${label}`)
		return true
	}
	console.error(`✗ ${label}`)
	for (const error of validate.errors ?? []) {
		console.error(`    ${error.instancePath || '/'} ${error.message}`)
	}
	return false
}

/** O contrário também prova: o que o protocolo PROÍBE precisa falhar. */
function negativeChecks(ajv: Ajv2020): boolean {
	const cases: Array<[string, string, Json]> = [
		[
			'ProcessEntry com score DEVE ser rejeitado (veredito é do recrutador)',
			SCHEMA_IDS.processEntry,
			{ id: 'x', status: 'completed', score: 8.4 },
		],
		[
			'ProcessEntry com approved DEVE ser rejeitado',
			SCHEMA_IDS.processEntry,
			{ id: 'x', status: 'completed', approved: true },
		],
		[
			'Profile com cpf DEVE ser rejeitado (atributo protegido)',
			SCHEMA_IDS.profile,
			{ id: 'x', cpf: '00000000000' },
		],
		[
			'Profile com gender DEVE ser rejeitado (atributo protegido)',
			SCHEMA_IDS.profile,
			{ id: 'x', gender: 'x' },
		],
		[
			'interview.finished sem score DEVE ser rejeitado (evento é da superfície da empresa)',
			SCHEMA_IDS.interviewFinished,
			{ event: 'interview.finished', interviewId: 'x' },
		],
	]
	let ok = true
	for (const [label, schemaId, payload] of cases) {
		const validate = ajv.getSchema(schemaId)!
		if (validate(payload)) {
			console.error(`✗ ${label} — mas PASSOU`)
			ok = false
		} else {
			console.log(`✓ ${label}`)
		}
	}
	return ok
}

/**
 * O binding REST é GERADO do artefato (ADR-006, decisão 7): o openapi.json
 * commitado tem que ser byte-a-byte o que o gerador produz dos schemas
 * normativos. Editar o binding à mão quebra aqui; o caminho é mudar o schema
 * e regenerar (`npm run generate:binding` no ots-contract).
 */
async function checkBindingGenerated(): Promise<boolean> {
	const bindingPath = join(contractRoot, 'binding', 'openapi.json')
	if (!existsSync(bindingPath)) {
		console.error('✗ binding/openapi.json ausente — rodar generate:binding no ots-contract')
		return false
	}
	const generatorPath = join(contractRoot, '..', 'scripts', 'binding-openapi.mjs')
	const { buildBindingOpenapi } = (await import(`file://${generatorPath}`)) as {
		buildBindingOpenapi: () => Json
	}
	const expected = JSON.stringify(buildBindingOpenapi(), null, '\t')
	const committed = readFileSync(bindingPath, 'utf8').trimEnd()
	if (expected === committed) {
		console.log('✓ binding/openapi.json é o gerado do artefato (não editado à mão)')
		return true
	}
	console.error('✗ binding/openapi.json DIVERGE do gerado — regenerar, nunca editar à mão')
	return false
}

async function commandValidate(): Promise<number> {
	const ajv = buildValidator()
	let ok = true

	const examplesDir = join(contractRoot, 'examples')
	for (const file of readdirSync(examplesDir).sort()) {
		if (!file.endsWith('.example.json')) continue
		const mapping = EXAMPLE_SCHEMA.find(([prefix]) => file.startsWith(prefix))
		if (!mapping) {
			console.error(`✗ example sem schema mapeado: ${file}`)
			ok = false
			continue
		}
		ok = check(ajv, mapping[1], loadJson(join(examplesDir, file)), `examples/${file}`) && ok
	}

	ok = negativeChecks(ajv) && ok

	// ── 0.2: attestation com criptografia REAL no CI ─────────────────
	const v02Examples = join(v02Root, 'examples')
	if (existsSync(v02Examples)) {
		ok =
			check(
				ajv,
				SCHEMA_IDS.attestation,
				loadJson(join(v02Examples, 'attestation-payload.example.json')),
				'0.2/attestation-payload.example.json',
			) && ok
		ok =
			check(
				ajv,
				SCHEMA_IDS.attestationStatus,
				loadJson(join(v02Examples, 'attestation-status.example.json')),
				'0.2/attestation-status.example.json',
			) && ok

		const jws = decodeJws(readFileSync(join(v02Examples, 'attestation.example.jws'), 'utf8'))
		const jwks = loadJson(join(v02Examples, 'jwks.example.json')) as {
			keys: Array<Record<string, unknown>>
		}
		ok = check(ajv, SCHEMA_IDS.attestation, jws.payload, '0.2/attestation.example.jws (payload)') && ok
		if (jws.header.alg === 'EdDSA' && jws.header.typ === 'ots-attestation+jws') {
			console.log('✓ 0.2/attestation.example.jws header (EdDSA, ots-attestation+jws)')
		} else {
			console.error('✗ 0.2/attestation.example.jws header inválido')
			ok = false
		}
		if (verifyAttestationSignature(jws, jwks)) {
			console.log('✓ 0.2/attestation.example.jws assinatura Ed25519 VERIFICADA')
		} else {
			console.error('✗ 0.2/attestation.example.jws assinatura NÃO confere')
			ok = false
		}
		// negativo criptográfico: um byte adulterado DEVE derrubar a assinatura
		const tampered = { ...jws, signingInput: jws.signingInput.slice(0, -2) + 'xx' }
		if (verifyAttestationSignature(tampered, jwks)) {
			console.error('✗ payload adulterado passou na verificação — inaceitável')
			ok = false
		} else {
			console.log('✓ payload adulterado é rejeitado pela assinatura')
		}
		// negativo de tier: summary com score DEVE falhar no schema
		const summaryComScore = {
			...(jws.payload as Json),
			outcome: { score: 9.1, strengths: [], developmentAreas: [] },
		}
		const validateAttestation = ajv.getSchema(SCHEMA_IDS.attestation)!
		if (validateAttestation(summaryComScore)) {
			console.error('✗ tier summary com score passou — proibição não executável')
			ok = false
		} else {
			console.log('✓ tier summary com score é rejeitado')
		}
	}

	ok = (await checkBindingGenerated()) && ok

	console.log(ok ? '\nArtefato OTS: OK' : '\nArtefato OTS: FALHOU')
	return ok ? 0 : 1
}

function commandAttestation(file: string, jwksPath?: string): number {
	const ajv = buildValidator()
	const jws = decodeJws(readFileSync(file, 'utf8'))
	let ok = check(ajv, SCHEMA_IDS.attestation, jws.payload, `attestation ${file} (payload)`)
	if (jws.header.alg !== 'EdDSA' || jws.header.typ !== 'ots-attestation+jws') {
		console.error(`✗ header: esperado alg=EdDSA typ=ots-attestation+jws, veio ${jws.header.alg}/${jws.header.typ}`)
		ok = false
	}
	if (jwksPath) {
		const jwks = loadJson(jwksPath) as { keys: Array<Record<string, unknown>> }
		if (verifyAttestationSignature(jws, jwks)) {
			console.log('✓ assinatura verificada')
		} else {
			console.error('✗ assinatura não confere com o JWKS fornecido')
			ok = false
		}
	} else {
		console.log(`ℹ sem --jwks: assinatura NÃO verificada (emissor declarado: ${String(jws.payload.iss)})`)
	}
	console.log(ok ? '\nAttestation: conforme' : '\nAttestation: NÃO conforme')
	return ok ? 0 : 1
}

function commandWebhook(file: string): number {
	const ajv = buildValidator()
	const ok = check(ajv, SCHEMA_IDS.interviewFinished, loadJson(file), `webhook ${file}`)
	console.log(ok ? '\nSaída do motor: conforme' : '\nSaída do motor: NÃO conforme')
	return ok ? 0 : 1
}

async function rpc(url: string, method: string, params: Json, id: number): Promise<Json> {
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream',
		},
		body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
	})
	const text = await response.text()
	// streamable http pode responder SSE mesmo com enableJsonResponse em proxies
	const jsonLine = text.startsWith('event:')
		? (text.split('\n').find((line) => line.startsWith('data:'))?.slice(5) ?? '{}')
		: text
	const parsed = JSON.parse(jsonLine) as { result?: Json; error?: { message?: string } }
	if (parsed.error) throw new Error(`${method}: ${parsed.error.message}`)
	return parsed.result ?? {}
}

async function commandProvider(url: string): Promise<number> {
	const ajv = buildValidator()
	let ok = true

	const init = await rpc(
		url,
		'initialize',
		{
			protocolVersion: '2025-03-26',
			capabilities: {},
			clientInfo: { name: 'ots-conformance', version: '0.1.0' },
		},
		1,
	)
	const serverInfo = init.serverInfo as { name?: string; version?: string } | undefined
	console.log(`provider: ${serverInfo?.name ?? '?'} ${serverInfo?.version ?? ''}`)

	const tools = (await rpc(url, 'tools/list', {}, 2)) as { tools?: Array<{ name: string }> }
	const names = (tools.tools ?? []).map((tool) => tool.name)
	for (const required of ['search_jobs', 'get_job_details']) {
		if (names.includes(required)) {
			console.log(`✓ tool ${required} presente`)
		} else {
			console.error(`✗ tool ${required} ausente`)
			ok = false
		}
	}

	const search = (await rpc(
		url,
		'tools/call',
		{ name: 'search_jobs', arguments: { limit: 5 } },
		3,
	)) as { structuredContent?: { jobs?: unknown[] } }
	const jobs = search.structuredContent?.jobs ?? []
	console.log(`search_jobs devolveu ${jobs.length} vaga(s)`)
	jobs.forEach((job, index) => {
		ok = check(ajv, SCHEMA_IDS.job, job, `search_jobs[${index}]`) && ok
	})

	console.log(ok ? '\nProvedor: conforme (descoberta)' : '\nProvedor: NÃO conforme')
	return ok ? 0 : 1
}

/**
 * Conformidade do binding REST (ADR-006, decisão 7) contra um provedor VIVO.
 * Descoberta é pública; com `--token`, valida também as superfícies do
 * talento — inclusive que process-entries NUNCA carrega score/approved (o
 * schema os proíbe, então a validação positiva já é o teste).
 */
async function commandRest(baseUrl: string, token?: string): Promise<number> {
	const ajv = buildValidator()
	const base = baseUrl.replace(/\/$/, '')
	let ok = true

	const getJson = async (path: string, withAuth = false): Promise<{ status: number; body: Json }> => {
		const response = await fetch(`${base}${path}`, {
			headers: withAuth && token ? { authorization: `Bearer ${token}` } : {},
		})
		const body = (await response.json().catch(() => ({}))) as Json
		return { status: response.status, body }
	}

	const search = await getJson('/ots/v0.1/jobs?limit=5')
	if (search.status !== 200) {
		console.error(`✗ GET /ots/v0.1/jobs → ${search.status}`)
		return 1
	}
	const jobs = (search.body.jobs ?? []) as Json[]
	console.log(`GET /ots/v0.1/jobs devolveu ${jobs.length} vaga(s)`)
	jobs.forEach((job, index) => {
		ok = check(ajv, SCHEMA_IDS.job, job, `jobs[${index}]`) && ok
	})

	const first = jobs[0]
	if (first) {
		const details = await getJson(`/ots/v0.1/jobs/${String(first.companyId)}/${String(first.jobId)}`)
		if (details.status === 200) {
			ok = check(ajv, SCHEMA_IDS.jobDetails, details.body, 'job details') && ok
		} else {
			console.error(`✗ GET job details → ${details.status}`)
			ok = false
		}
	}

	if (token) {
		const profile = await getJson('/ots/v0.1/profile', true)
		if (profile.status === 200) {
			ok = check(ajv, SCHEMA_IDS.profile, profile.body, 'profile') && ok
		} else {
			console.error(`✗ GET /ots/v0.1/profile → ${profile.status}`)
			ok = false
		}

		const entries = await getJson('/ots/v0.1/process-entries', true)
		if (entries.status === 200) {
			const list = (entries.body.entries ?? []) as Json[]
			console.log(`GET /ots/v0.1/process-entries devolveu ${list.length} participação(ões)`)
			list.forEach((entry, index) => {
				ok = check(ajv, SCHEMA_IDS.processEntry, entry, `process-entries[${index}]`) && ok
			})
		} else {
			console.error(`✗ GET /ots/v0.1/process-entries → ${entries.status}`)
			ok = false
		}
	} else {
		console.log('ℹ sem --token: superfícies do talento não verificadas')
	}

	console.log(ok ? '\nBinding REST: conforme' : '\nBinding REST: NÃO conforme')
	return ok ? 0 : 1
}

const [, , command, argument] = process.argv
const exitWith = (code: number) => process.exit(code)

if (command === 'validate') {
	commandValidate()
		.then(exitWith)
		.catch((error) => {
			console.error(`validate: ${error instanceof Error ? error.message : error}`)
			exitWith(1)
		})
} else if (command === 'webhook' && argument) exitWith(commandWebhook(argument))
else if (command === 'attestation' && argument) {
	const jwksFlag = process.argv.indexOf('--jwks')
	exitWith(commandAttestation(argument, jwksFlag > -1 ? process.argv[jwksFlag + 1] : undefined))
} else if (command === 'provider' && argument) {
	commandProvider(argument)
		.then(exitWith)
		.catch((error) => {
			console.error(`provider: ${error instanceof Error ? error.message : error}`)
			exitWith(1)
		})
} else if (command === 'rest' && argument) {
	const tokenFlag = process.argv.indexOf('--token')
	commandRest(argument, tokenFlag > -1 ? process.argv[tokenFlag + 1] : undefined)
		.then(exitWith)
		.catch((error) => {
			console.error(`rest: ${error instanceof Error ? error.message : error}`)
			exitWith(1)
		})
} else {
	console.log(
		'uso: ots-conformance validate | webhook <arquivo.json> | attestation <arquivo.jws> [--jwks <jwks.json>] | provider <url-mcp> | rest <base-url> [--token <bearer>]',
	)
	exitWith(2)
}
