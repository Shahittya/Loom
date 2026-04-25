import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callGLM } from '@/lib/glm'

const ONBOARDING_SYSTEM = `You are LOOM Setup Assistant — a friendly AI that helps business owners set up their automated AI business system.

Your job is to guide the user through these steps IN ORDER:
1. Ask for their business name
2. Ask what type of business: food, physical (products), digital, or service
3. Ask what channels they want: telegram, landing page, or both
4. Ask for a short description of their business (for the landing page)

Rules:
- Ask ONE question at a time
- Be warm, concise, and encouraging
- When you have collected ALL 4 pieces of info, respond with a JSON block wrapped in <SETUP_COMPLETE> tags like this:
<SETUP_COMPLETE>
{"name":"Business Name","category":"food|physical|digital|service","mode":"telegram|landing|both","description":"..."}
</SETUP_COMPLETE>
- Categories MUST be exactly: food, physical, digital, or service
- Mode MUST be exactly: telegram, landing, or both

Start by greeting the user and asking for their business name.`

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages } = await req.json()

  let reply: string
  try {
    reply = await callGLM([
      { role: 'system', content: ONBOARDING_SYSTEM },
      ...messages,
    ])
  } catch {
    return NextResponse.json({ reply: 'Sorry, AI is unavailable right now. Please check your ILMU_API_KEY and try again.', setupComplete: false })
  }

  // Check if setup is complete
  const match = reply.match(/<SETUP_COMPLETE>([\s\S]*?)<\/SETUP_COMPLETE>/)
  if (match) {
    try {
      const setup = JSON.parse(match[1].trim())
      // Create the business
      const { data: business, error } = await supabase
        .from('businesses')
        .insert({
          user_id: user.id,
          name: setup.name,
          category: setup.category,
          mode: setup.mode,
        })
        .select()
        .single()

      if (error) {
        console.error('Business insert error:', error)
        return NextResponse.json({ reply: `Setup failed: ${error.message}. Please try again.`, setupComplete: false })
      }

      // Create default business settings
      const { error: settingsError } = await supabase.from('business_settings').insert({
        business_id: business.id,
        landing_description: setup.description || '',
        landing_enabled: setup.mode !== 'telegram',
      })

      if (settingsError) {
        console.error('Settings insert error:', settingsError)
      }

      const cleanReply = reply.replace(/<SETUP_COMPLETE>[\s\S]*?<\/SETUP_COMPLETE>/, '').trim()
      return NextResponse.json({
        reply: cleanReply || `Your business "${setup.name}" has been set up successfully! 🎉 Let me take you to your dashboard.`,
        setupComplete: true,
        business,
      })
    } catch (e) {
      console.error('Setup parse error:', e)
      return NextResponse.json({ reply: 'There was an error saving your business. Please try again.', setupComplete: false })
    }
  }

  return NextResponse.json({ reply, setupComplete: false })
}
