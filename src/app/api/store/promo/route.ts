import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { valid: false, error: 'Supabase environment variables are missing' },
      { status: 500 }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')?.trim()
  const businessId = searchParams.get('businessId')

  if (!code || !businessId) {
    return NextResponse.json({ valid: false, error: 'Missing code or businessId' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('promos')
    .select('id, code, description, discount_type, discount_value, max_uses, current_uses, active, expires_at')
    .eq('business_id', businessId)
    .eq('active', true)
    .ilike('code', code) // case-insensitive match
    .single()

  if (error || !data) {
    return NextResponse.json({ valid: false, error: 'Invalid promo code' })
  }

  if (data.max_uses !== null && data.current_uses >= data.max_uses) {
    return NextResponse.json({ valid: false, error: 'This promo code has reached its usage limit' })
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: 'This promo code has expired' })
  }

  return NextResponse.json({ valid: true, promo: data })
}
