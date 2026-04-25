import { createClient } from '@/lib/supabase/server'
import { Users } from 'lucide-react'

export default async function CustomersPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: business } = await supabase.from('businesses').select('id').eq('user_id', user!.id).single()

  const { data: orders } = await supabase
    .from('orders')
    .select('customer_name, customer_contact, total_price, status, created_at')
    .eq('business_id', business!.id)
    .order('created_at', { ascending: false })

  // Deduplicate by contact
  const seen = new Set()
  const customers = (orders || []).filter(o => {
    if (seen.has(o.customer_contact)) return false
    seen.add(o.customer_contact)
    return true
  })

  return (
    <div className="p-8">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Customers</h1>
      <p className="text-gray-500 text-sm mb-8">{customers.length} unique customer{customers.length !== 1 ? 's' : ''}</p>

      {customers.length === 0 ? (
        <div className="card text-center py-16">
          <Users className="w-12 h-12 mx-auto mb-4 text-gray-200" />
          <p className="text-gray-500 font-medium">No customers yet</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Contact</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Last Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c, i) => (
                <tr key={i} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-gray-900">{c.customer_name}</td>
                  <td className="px-5 py-3 text-gray-500">{c.customer_contact}</td>
                  <td className="px-5 py-3 text-gray-500">RM {c.total_price?.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
