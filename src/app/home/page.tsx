import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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

  // レポートバナー: 週次または月次サマリーがキャッシュ済みか確認
  const weekStartStr = getWeekStartJST()
  const monthStartStr = getPrevMonthStartJST()

  const [{ data: weeklyCached }, { data: monthlyCached }] = await Promise.all([
    supabase
      .from('weekly_summaries')
      .select('id')
      .eq('user_id', user.id)
      .eq('week_start', weekStartStr)
      .maybeSingle(),
    supabase
      .from('monthly_summaries')
      .select('id')
      .eq('user_id', user.id)
      .eq('month_start', monthStartStr)
      .maybeSingle(),
  ])

  const hasReport = !!(weeklyCached || monthlyCached)

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

        {/* レポートバナー */}
        {hasReport && (
          <Link
            href="/reports"
            className="flex items-center justify-between bg-yori-base border border-yori-light-border rounded-2xl px-4 py-3.5 active:opacity-75 transition-opacity"
          >
            <div>
              <p className="text-xs font-medium text-yori-accent-dark">
                {monthlyCached ? '先月のまとめができています' : '今週のまとめができています'}
              </p>
              <p className="text-[11px] text-yori-muted mt-0.5">レポートで確認する</p>
            </div>
            <span className="text-yori-muted text-xs">→</span>
          </Link>
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

function getWeekStartJST(): string {
  const jstDateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const jstDate = new Date(jstDateStr + 'T00:00:00')
  const dayOfWeek = jstDate.getDay()
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  jstDate.setDate(jstDate.getDate() - daysFromMonday)
  return jstDate.toLocaleDateString('sv-SE')
}

function getPrevMonthStartJST(): string {
  const jstDateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const jstDate = new Date(jstDateStr + 'T00:00:00')
  const year = jstDate.getFullYear()
  const month = jstDate.getMonth()
  const prevYear = month === 0 ? year - 1 : year
  const prevMonth = month === 0 ? 12 : month
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
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
