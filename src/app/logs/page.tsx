import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogsCalendar from './LogsCalendar'

export default async function LogsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: logs } = await supabase
    .from('daily_logs')
    .select('id, date, events, feelings, achievements, tags, mood_score')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(365)

  return (
    <main className="min-h-screen bg-yori-bg flex flex-col max-w-sm mx-auto">

      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-yori-light-border bg-yori-base">
        <Link href="/home" className="text-xs text-yori-muted active:opacity-75 transition-opacity">← 戻る</Link>
        <span className="text-sm font-medium text-yori-accent-dark">記録</span>
        <span className="w-10" />
      </div>

      <div className="flex-1 px-4 py-4 overflow-y-auto">
        {logs && logs.length > 0 ? (
          <LogsCalendar logs={logs} />
        ) : (
          <div className="flex-1 flex items-center justify-center py-20">
            <p className="text-xs text-yori-muted leading-relaxed text-center">
              まだ記録はありません。<br />
              チャットで話すと自動で記録されます。
            </p>
          </div>
        )}
      </div>

      {/* タブバー */}
      <div className="sticky bottom-0 flex border-t border-yori-light-border bg-yori-base">
        <Link href="/home" className="flex-1 py-2.5 flex flex-col items-center gap-1 text-yori-very-muted active:opacity-75 transition-opacity">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M4 4h12a1 1 0 011 1v7a1 1 0 01-1 1H7l-3.5 2.5V5a1 1 0 011-1z"
              stroke="#B5A89E"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[10px]">チャット</span>
        </Link>
        <div className="flex-1 py-2.5 flex flex-col items-center gap-1 text-yori-accent">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M4 6h12M4 10h8M4 14h6" stroke="#8B6F5E" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[10px]">記録</span>
        </div>
        <Link href="/reports" className="flex-1 py-2.5 flex flex-col items-center gap-1 text-yori-very-muted active:opacity-75 transition-opacity">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M3 14l4-4 3 3 4-5 3 3" stroke="#B5A89E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[10px]">レポート</span>
        </Link>
      </div>

    </main>
  )
}
