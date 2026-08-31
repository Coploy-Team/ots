/**
 * Binding REST do OTS 0.1 (ADR-006, decisão 7) — GERADO do artefato.
 *
 * A regra do ADR é literal: o OpenAPI não é escrito à mão e descrito depois —
 * os schemas dos recursos entram AQUI direto dos arquivos normativos, e a
 * suíte de conformidade compara o `binding/openapi.json` commitado com o que
 * esta função produz. Editar o binding na mão quebra o CI; o caminho certo é
 * mudar o schema normativo (com processo de mudança) e regenerar.
 *
 * Regenerar: node scripts/generate-binding-openapi.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '0.1')

function loadSchema(file) {
	return JSON.parse(readFileSync(join(root, 'schemas', file), 'utf8'))
}

/**
 * JSON Schema normativo → componente OpenAPI: remove os campos de registro
 * ($schema/$id) e reescreve $refs entre arquivos para refs de componente.
 */
function toComponent(schema, refMap) {
	const clone = JSON.parse(JSON.stringify(schema))
	delete clone.$schema
	delete clone.$id
	const rewrite = (node) => {
		if (Array.isArray(node)) return node.forEach(rewrite)
		if (node === null || typeof node !== 'object') return
		if (typeof node.$ref === 'string' && refMap[node.$ref]) {
			node.$ref = refMap[node.$ref]
		}
		Object.values(node).forEach(rewrite)
	}
	rewrite(clone)
	return clone
}

export function buildBindingOpenapi() {
	const refMap = {
		'job.schema.json': '#/components/schemas/Job',
		'salary.schema.json': '#/components/schemas/Salary',
	}

	const components = {
		schemas: {
			Job: toComponent(loadSchema('job.schema.json'), refMap),
			JobDetails: toComponent(loadSchema('job-details.schema.json'), refMap),
			ProcessEntry: toComponent(loadSchema('process-entry.schema.json'), refMap),
			Profile: toComponent(loadSchema('profile.schema.json'), refMap),
			Salary: toComponent(loadSchema('salary.schema.json'), refMap),
		},
		securitySchemes: {
			oauth: {
				type: 'http',
				scheme: 'bearer',
				description:
					'Access token do OAuth 2.1 do provedor (descoberta via RFC 9728: ' +
					'/.well-known/oauth-protected-resource). O talento autoriza; o token é dele.',
			},
		},
	}

	return {
		openapi: '3.1.0',
		info: {
			title: 'OTS 0.1 — REST binding',
			version: '0.1.0',
			description:
				'Binding REST do Open Talent Standard. Gerado do artefato normativo ' +
				'(packages/ots-contract/0.1/schemas) — nunca editado à mão. ' +
				'Descoberta de vaga é pública; perfil e participações são do talento (OAuth).',
			license: { name: 'Apache-2.0', identifier: 'Apache-2.0' },
		},
		paths: {
			'/ots/v0.1/jobs': {
				get: {
					operationId: 'searchJobs',
					summary: 'Public job discovery',
					parameters: [
						{ name: 'query', in: 'query', schema: { type: 'string' } },
						{ name: 'language', in: 'query', schema: { type: 'string', enum: ['pt-BR', 'en'] } },
						{
							name: 'limit',
							in: 'query',
							schema: { type: 'integer', minimum: 1, maximum: 25, default: 10 },
						},
					],
					responses: {
						200: {
							description: 'Jobs matching the filter',
							content: {
								'application/json': {
									schema: {
										type: 'object',
										required: ['jobs', 'totalAvailable'],
										properties: {
											jobs: { type: 'array', items: { $ref: '#/components/schemas/Job' } },
											totalAvailable: { type: 'integer', minimum: 0 },
										},
									},
								},
							},
						},
					},
				},
			},
			'/ots/v0.1/jobs/{companyId}/{jobId}': {
				get: {
					operationId: 'getJobDetails',
					summary: 'Job details (public jobs only — private/closed jobs are 404)',
					parameters: [
						{ name: 'companyId', in: 'path', required: true, schema: { type: 'string' } },
						{ name: 'jobId', in: 'path', required: true, schema: { type: 'string' } },
					],
					responses: {
						200: {
							description: 'Job with long-form fields',
							content: {
								'application/json': { schema: { $ref: '#/components/schemas/JobDetails' } },
							},
						},
						404: { description: 'Not public, closed or unknown — indistinguishable on purpose' },
					},
				},
			},
			'/ots/v0.1/profile': {
				get: {
					operationId: 'getProfile',
					summary: "The authenticated talent's portable profile",
					security: [{ oauth: [] }],
					responses: {
						200: {
							description: 'Profile',
							content: {
								'application/json': { schema: { $ref: '#/components/schemas/Profile' } },
							},
						},
						401: { description: 'Missing or invalid token' },
					},
				},
			},
			'/ots/v0.1/process-entries': {
				get: {
					operationId: 'listProcessEntries',
					summary: "The authenticated talent's process participations",
					security: [{ oauth: [] }],
					responses: {
						200: {
							description: 'Entries, most recent first',
							content: {
								'application/json': {
									schema: {
										type: 'object',
										required: ['entries'],
										properties: {
											entries: {
												type: 'array',
												items: { $ref: '#/components/schemas/ProcessEntry' },
											},
										},
									},
								},
							},
						},
						401: { description: 'Missing or invalid token' },
					},
				},
				post: {
					operationId: 'createProcessEntry',
					summary: 'Enter a process (prepares or resumes the interview session)',
					security: [{ oauth: [] }],
					requestBody: {
						required: true,
						content: {
							'application/json': {
								schema: {
									type: 'object',
									required: ['companyId', 'jobId'],
									properties: {
										companyId: { type: 'string' },
										jobId: { type: 'string' },
									},
								},
							},
						},
					},
					responses: {
						201: {
							description: 'The entry, with the interview extension when the provider has one',
							content: {
								'application/json': {
									schema: {
										type: 'object',
										required: ['entry'],
										properties: { entry: { $ref: '#/components/schemas/ProcessEntry' } },
									},
								},
							},
						},
						401: { description: 'Missing or invalid token' },
						404: { description: 'Job not public, closed or unknown' },
					},
				},
			},
		},
		components,
	}
}
