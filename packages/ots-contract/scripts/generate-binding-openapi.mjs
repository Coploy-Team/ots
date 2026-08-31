// Regenera 0.1/binding/openapi.json a partir dos schemas normativos.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildBindingOpenapi } from './binding-openapi.mjs'

const out = join(dirname(fileURLToPath(import.meta.url)), '..', '0.1', 'binding', 'openapi.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, `${JSON.stringify(buildBindingOpenapi(), null, '\t')}\n`)
console.log(`binding gerado: ${out}`)
