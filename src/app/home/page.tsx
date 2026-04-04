import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import WeeklySummaryCard from './WeeklySummaryCard'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  // オンボーディング未完了ならリダイレクト
  const { data: profile } = await supabase
    .from('profiles')
    .select('parent_type')
    .eq('id', user.id)
    .single()

  if (!profile?.parent_type) redirect('/onboarding')

  const isSundayJST =
    new Date().toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Asia/Tokyo' }) === 'Sun'

  const { data: logs } = await supabase
    .from('daily_logs')
    .select('id, date, events, feelings, tags')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(7)

  return (
    <main className="min-h-screen bg-yori-bg flex flex-col max-w-sm mx-auto">

      {/* ステータスバー風 */}
      <div className="flex justify-between items-center px-5 pt-3 pb-1 text-xs text-yori-muted">
        <CurrentTime />
      </div>

      {/* ナビ */}
      <nav className="flex items-center justify-between px-5 pb-3 border-b border-yori-light-border">
        <span className="text-lg font-medium text-yori-accent-dark tracking-tight">Yori</span>
        <Link href="/account" className="text-xs text-yori-muted active:opacity-75 transition-opacity">アカウント</Link>
      </nav>

      <div className="flex-1 px-4 py-5 flex flex-col gap-4 overflow-y-auto">

        {/* グリーティングカード */}
        <div className="bg-yori-card rounded-2xl p-5">
          <p className="text-xs text-yori-muted mb-1.5">
            <TodayLabel />
          </p>
          <p className="text-sm text-yori-text leading-relaxed">
            <span className="font-medium">おつかれさまです。</span>
            <br />
            今日はどんな一日でしたか？
          </p>
          <div className="flex gap-2.5 mt-3.5 items-start">
            <div className="w-7 h-7 rounded-full bg-yori-avatar flex-shrink-0 flex items-center justify-center text-xs text-yori-base font-medium">
              よ
            </div>
            <div className="bg-yori-base rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-3 py-2.5 text-xs text-yori-text leading-relaxed flex-1">
              今日感じたこと、子どもとのこと。なんでもここに置いていってください。
            </div>
          </div>
        </div>

        {/* 話すボタン */}
        <Link
          href="/chat"
          className="block w-full bg-yori-accent text-yori-base rounded-2xl py-3.5 text-sm font-medium text-center active:opacity-80 transition-opacity"
        >
          話す
        </Link>

        {/* 週次サマリー（日曜日のみ表示） */}
        {isSundayJST && <WeeklySummaryCard />}

        {/* 最近の記録 */}
        {logs && logs.length > 0 ? (
          <div>
            <p className="text-xs text-yori-muted tracking-wide mb-2">今週の記録</p>
            <div className="flex flex-col gap-2">
              {logs.map((log) => (
                <Link
                  key={log.id}
                  href={`/logs/${log.id}`}
                  className="bg-yori-base border border-yori-light-border rounded-2xl px-3.5 py-3 flex gap-3 items-start active:opacity-75 transition-opacity"
                >
                  <span className="text-xs text-yori-muted flex-shrink-0 pt-0.5">
                    {formatDate(log.date)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-yori-text leading-snug line-clamp-2">
                      {log.events ?? '（記録なし）'}
                    </p>
                    {log.feelings && (
                      <span className="inline-block text-xs text-yori-accent bg-yori-card rounded-full px-2 py-0.5 mt-1.5">
                        {log.feelings.split('、')[0].slice(0, 12)}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-10">
            <p className="text-xs text-yori-muted leading-relaxed">
              まだ記録はありません。<br />
              話すと、自動で記録されます。
            </p>
          </div>
        )}

      </div>

      {/* タブバー */}
      <div className="sticky bottom-0 flex border-t border-yori-light-border bg-yori-base">
        <div className="flex-1 py-2.5 flex flex-col items-center gap-1 text-yori-accent">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M3 10L10 3l7 7" stroke="#8B6F5E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="5" y="10" width="10" height="7" rx="1.5" stroke="#8B6F5E" strokeWidth="1.5" />
          </svg>
          <span className="text-[10px]">ホーム</span>
        </div>
        <Link href="/logs" className="flex-1 py-2.5 flex flex-col items-center gap-1 text-yori-very-muted active:opacity-75 transition-opacity">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M4 6h12M4 10h8M4 14h6" stroke="#B5A89E" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[10px]">記録</span>
        </Link>
      </div>

    </main>
  )
}

function CurrentTime() {
  const now = new Date()
  const time = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
  return <span>{time}</span>
}

function TodayLabel() {
  const now = new Date()
  const label = now.toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Tokyo',
  })
  const time = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
  return <>{`今日 · ${label} ${time}`}</>
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Tokyo' })
}
