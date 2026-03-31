import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function LogsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: logs } = await supabase
    .from('daily_logs')
    .select('id, date, events, feelings, achievements, tags, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  // 同じ日付が複数あるか把握する（セッション番号表示用）
  const dateCounts: Record<string, number> = {}
  if (logs) {
    for (const log of logs) {
      dateCounts[log.date] = (dateCounts[log.date] ?? 0) + 1
    }
  }

  // 同日内でのセッション番号を付与（古い順に1, 2, ...）
  const dateIndexMap: Record<string, number> = {}
  const logsWithIndex = logs
    ? [...logs].reverse().map((log) => {
        dateIndexMap[log.date] = (dateIndexMap[log.date] ?? 0) + 1
        return { ...log, sessionIndex: dateIndexMap[log.date] }
      }).reverse()
    : []

  return (
    <main className="min-h-screen bg-yori-bg flex flex-col max-w-sm mx-auto">

      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-yori-light-border bg-yori-base">
        <Link href="/home" className="text-xs text-yori-muted">← 戻る</Link>
        <span className="text-sm font-medium text-yori-accent-dark">記録</span>
        <span className="w-10" />
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-2.5">
        {logsWithIndex.length > 0 ? (
          logsWithIndex.map((log) => (
            <Link
              key={log.id}
              href={`/logs/${log.id}`}
              className="bg-yori-base border border-yori-light-border rounded-2xl px-4 py-3.5 flex flex-col gap-1.5"
            >
              <div className="flex items-baseline gap-2">
                <p className="text-xs text-yori-muted">{formatDate(log.date)}</p>
                {dateCounts[log.date] > 1 && (
                  <p className="text-xs text-yori-very-muted">{log.sessionIndex}回目</p>
                )}
              </div>
              <p className="text-sm text-yori-text leading-snug line-clamp-2">
                {log.events ?? '（記録なし）'}
              </p>
              {log.achievements && (
                <p className="text-xs text-yori-avatar leading-snug line-clamp-1">
                  {log.achievements}
                </p>
              )}
              {!log.achievements && log.feelings && (
                <p className="text-xs text-yori-muted leading-snug line-clamp-1">
                  {log.feelings}
                </p>
              )}
              {log.tags && log.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {(log.tags as string[]).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs text-yori-accent bg-yori-card rounded-full px-2 py-0.5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))
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
      <div className="flex border-t border-yori-light-border bg-yori-base">
        <Link href="/home" className="flex-1 py-2.5 flex flex-col items-center gap-1 text-yori-very-muted">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M3 10L10 3l7 7" stroke="#B5A89E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="5" y="10" width="10" height="7" rx="1.5" stroke="#B5A89E" strokeWidth="1.5" />
          </svg>
          <span className="text-[10px]">ホーム</span>
        </Link>
        <div className="flex-1 py-2.5 flex flex-col items-center gap-1 text-yori-accent">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M4 6h12M4 10h8M4 14h6" stroke="#8B6F5E" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[10px]">記録</span>
        </div>
      </div>

    </main>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Tokyo',
  })
}
