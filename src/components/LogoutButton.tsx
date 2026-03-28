'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LogoutButton() {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      className="w-8 h-8 rounded-full bg-yori-card flex items-center justify-center"
      aria-label="ログアウト"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="5.5" r="2.5" stroke="#8B6F5E" strokeWidth="1.4" fill="none" />
        <path d="M2.5 13.5c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="#8B6F5E" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      </svg>
    </button>
  )
}
