'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

export default function NewUserSetupBanner({ userId }: { userId: string }) {
  const storageKey = useMemo(() => `loom_setup_tip_seen_${userId}`, [userId])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!userId) return
    const seen = localStorage.getItem(storageKey)
    if (seen) return

    setVisible(true)
    const timer = window.setTimeout(() => {
      setVisible(false)
      localStorage.setItem(storageKey, '1')
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [storageKey, userId])

  if (!visible) return null

  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <p>
        Welcome! Please set up your account from{' '}
        <Link href="/dashboard/settings" className="font-semibold underline underline-offset-2">
          Settings
        </Link>
        .
      </p>
    </div>
  )
}
