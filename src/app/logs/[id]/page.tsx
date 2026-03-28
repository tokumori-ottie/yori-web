import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'

export default async function LogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: log } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!log) notFound()

  return (
    <main className="min-h-screen bg-yori-bg flex flex-col max-w-sm mx-auto">

      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-yori-light-border bg-yori-base">
        <Link href="/logs" className="text-xs text-yori-muted">← 記録一覧</Link>
        <span className="text-sm font-medium text-yori-accent-dark">
          {formatDate(log.date)}
        </span>
        <span className="w-10" />
      </div>

      <div className="flex-1 px-4 py-5 flex flex-col gap-4">

        {/* 出来事 */}
        {log.events && (
          <section className="bg-yori-base border border-yori-light-border rounded-2xl px-4 py-4">
            <p className="text-xs text-yori-muted mb-1.5">出来事</p>
            <p className="text-sm text-yori-text leading-relaxed">{log.events}</p>
          </section>
        )}

        {/* 気持ち */}
        {log.feelings && (
          <section className="bg-yori-base border border-yori-light-border rounded-2xl px-4 py-4">
            <p className="text-xs text-yori-muted mb-1.5">気持ち</p>
            <p className="text-sm text-yori-text leading-relaxed">{log.feelings}</p>
          </section>
        )}

        {/* タグ */}
        {log.tags && (log.tags as string[]).length > 0 && (
          <section>
            <p className="text-xs text-yori-muted mb-2">タグ</p>
            <div className="flex flex-wrap gap-1.5">
              {(log.tags as string[]).map((tag) => (
                <span
                  key={tag}
                  className="text-xs text-yori-accent bg-yori-card rounded-full px-3 py-1"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* 相談への導線 */}
        <div className="mt-auto pt-4">
          <div className="bg-yori-card rounded-2xl px-4 py-4">
            <p className="text-xs text-yori-text leading-relaxed mb-3">
              この内容を持って、専門家に相談してみませんか。
            </p>
            <Link
              href="/consult"
              className="block w-full bg-yori-accent text-yori-base rounded-xl py-3 text-xs font-medium text-center"
            >
              相談先を探す
            </Link>
          </div>
        </div>

      </div>

    </main>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}
