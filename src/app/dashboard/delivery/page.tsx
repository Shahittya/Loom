import Link from 'next/link'
import { Truck } from 'lucide-react'

export default function DeliveryPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Delivery</h1>
      <p className="text-gray-500 text-sm mb-8">Track and manage deliveries for your orders</p>
      <div className="card text-center py-16">
        <Truck className="w-12 h-12 mx-auto mb-4 text-gray-200" />
        <p className="text-gray-500 font-medium">Manage deliveries from the Orders page</p>
        <Link href="/dashboard/orders" className="btn-primary mt-4 inline-flex">Go to Orders</Link>
      </div>
    </div>
  )
}
