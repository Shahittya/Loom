import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (!business) redirect('/onboarding')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar business={business} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
