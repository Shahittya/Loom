import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import StoreClient from './StoreClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function StorePage({ params }: { params: { businessId: string } }) {
  noStore()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', params.businessId)
    .single()

  if (!business) notFound()

  const [settingsRes, itemsRes, paymentRes, promosRes] = await Promise.all([
    supabase.from('business_settings').select('*').eq('business_id', business.id).single(),
    supabase.from('items').select('*').eq('business_id', business.id).eq('available', true).order('created_at', { ascending: true }),
    supabase.from('payment_methods').select('*').eq('business_id', business.id).single(),
    supabase.from('promos').select('id, code, description, discount_type, discount_value, max_uses, current_uses').eq('business_id', business.id).eq('active', true),
  ])

  return (
    <StoreClient
      business={business}
      settings={settingsRes.data}
      items={itemsRes.data || []}
      payment={paymentRes.data}
      promos={promosRes.data || []}
    />
  )
}
