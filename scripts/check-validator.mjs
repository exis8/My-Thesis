// Self-check: the validator keeps a real fit and drops a tag that only
// shares a word with the title. Calls the live Gemini API.
// Usage: node --env-file=.env scripts/check-validator.mjs
import assert from 'node:assert/strict'

globalThis.useRuntimeConfig = () => ({ geminiApiKey: process.env.NUXT_GEMINI_API_KEY })
const { validateExpertise } = await import('../server/utils/validateExpertise.ts')

const approved = await validateExpertise(
  'Convolutional neural networks for detecting rice leaf disease',
  ['Deep Learning', 'Computer Networking', 'Financial Accounting'],
)
assert.deepEqual(approved, ['Deep Learning'])
console.log('validator ok')
