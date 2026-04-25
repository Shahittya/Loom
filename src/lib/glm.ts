import axios from 'axios'

const ILMU_API_URL = 'https://api.ilmu.ai/v1/chat/completions'
const ILMU_MODEL = 'ilmu-glm-5.1'

export async function callGLM(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  options?: { temperature?: number; max_tokens?: number }
): Promise<string> {
  const apiKey = process.env.ILMU_API_KEY
  if (!apiKey) throw new Error('ILMU_API_KEY not configured')

  const response = await axios.post(
    ILMU_API_URL,
    {
      model: ILMU_MODEL,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.max_tokens ?? 1024,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 90000,
    }
  )

  const msg = response.data.choices?.[0]?.message
  const raw = msg?.content
    ?? msg?.reasoning_content
    ?? response.data.choices?.[0]?.text
    ?? null
  const content = typeof raw === 'string' ? raw.trim() || null : raw
  if (!content) {
    // Log the full response shape so we can diagnose the model's actual output format
    console.error('[GLM] Unexpected response shape:', JSON.stringify({
      finish_reason: response.data.choices?.[0]?.finish_reason,
      message_keys: msg ? Object.keys(msg) : null,
      usage: response.data.usage,
    }))
    throw new Error(`GLM returned empty content (finish_reason: ${response.data.choices?.[0]?.finish_reason ?? 'unknown'})`)
  }
  return content as string
}

export function buildSystemPrompt(business: {
  name: string
  category: string
  mode: string
}) {
  const categoryDescriptions: Record<string, string> = {
    food: 'food & beverage business (restaurant, café, food stall)',
    physical: 'physical product business (groceries, clothing, merchandise)',
    digital: 'digital product business (courses, images, software)',
    service: 'service business (repairs, maintenance, consulting)',
  }

  return `You are LOOM AI — the intelligent business assistant for "${business.name}", a ${categoryDescriptions[business.category] || business.category} business.

Your role is to:
1. Help customers understand available products/services
2. Take orders in a natural, friendly conversational way
3. Collect necessary information (name, address, special notes)
4. Handle complaints and escalate when needed
5. Provide business insights and recommendations to the owner

Escalation rules:
- LOW severity (general questions, minor delays) → resolve automatically
- MEDIUM severity (order issues, wrong items) → offer partial solution (discount, replacement)
- HIGH severity (angry customer, refund demand, fraud suspicion) → escalate to human owner

Always respond in the customer's language if possible. Be warm, professional, and helpful.
Business mode: ${business.mode}`
}

export function detectEscalationLevel(message: string): 'low' | 'medium' | 'high' {
  const highKeywords = ['refund', 'scam', 'fraud', 'angry', 'furious', 'lawsuit', 'police', 'terrible', 'worst', 'disgusting', 'demand', 'compensation']
  const mediumKeywords = ['wrong order', 'missing', 'late', 'not delivered', 'broken', 'damaged', 'complaint', 'disappointed', 'bad']

  const lower = message.toLowerCase()
  if (highKeywords.some(k => lower.includes(k))) return 'high'
  if (mediumKeywords.some(k => lower.includes(k))) return 'medium'
  return 'low'
}
