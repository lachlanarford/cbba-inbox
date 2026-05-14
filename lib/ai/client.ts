import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export default client

export const AI_MODEL = 'claude-sonnet-4-20250514'
export const AI_MAX_TOKENS = 1024
