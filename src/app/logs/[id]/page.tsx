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

  // このログに紐づくセッションのメッセージを取得
  const { data: messages } = log.session_id
    ? await supabase
        .from('messages')
        .select('id, role, content')
        .eq('session_id', log.session_id)
        .order('created_at', { ascending: true })
    : { data: null }

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

        {/* できたこと・成長 */}
        {log.achievements && (
          <section className="bg-yori-base border border-yori-card rounded-2xl px-4 py-4">
            <p className="text-xs text-yori-avatar mb-1.5">できたこと・成長</p>
            <p className="text-sm text-yori-text leading-relaxed">{log.achievements}</p>
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

        {/* チャット履歴 */}
        {messages && messages.length > 0 && (
          <section>
            <p className="text-xs text-yori-muted mb-2">このときの会話</p>
            <div className="flex flex-col gap-2.5">
              {messages.map((msg) => {
                const isUser = msg.role === 'user'
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 items-start ${isUser ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-medium ${
                        isUser
                          ? 'bg-yori-border text-yori-accent-dark'
                          : 'bg-yori-avatar text-yori-base'
                      }`}
                    >
                      {isUser ? '私' : 'よ'}
                    </div>
                    <div className="max-w-[200px]">
                      <div
                        className={`px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                          isUser
                            ? 'bg-yori-accent text-yori-base rounded-tl-xl rounded-bl-xl rounded-br-xl'
                            : 'bg-yori-base border border-yori-light-border text-yori-text rounded-tr-xl rounded-br-xl rounded-bl-xl'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}


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
    timeZone: 'Asia/Tokyo',
  })
}
