import { createClient as createAdminClient } from '@supabase/supabase-js'
import { extractLogFromMessages } from '@/lib/extract-log'

// Vercel Cron は Authorization: Bearer {CRON_SECRET} を付与して呼び出す
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  const supabase = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 日本時間の「今日」を取得（0時ちょうどに実行されるので、date < today = 昨日以前が対象）
  const todayJST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

  // 昨日以前の未終了セッションをすべて取得
  const { data: sessions, error: sessionsError } = await supabase
    .from('chat_sessions')
    .select('id, user_id, date')
    .is('ended_at', null)
    .lt('date', todayJST)

  if (sessionsError) {
    console.error('Failed to fetch sessions:', sessionsError)
    return new Response('DB error', { status: 500 })
  }

  if (!sessions || sessions.length === 0) {
    return Response.json({ ok: true, processed: 0 })
  }

  let processed = 0
  let skipped = 0

  for (const session of sessions) {
    try {
      // セッションのメッセージを取得
      const { data: messages } = await supabase
        .from('messages')
        .select('role, content')
        .eq('session_id', session.id)
        .order('created_at', { ascending: true })

      // ユーザーが一度も話していない場合はスキップ（ended_atだけ更新）
      if (!messages || !messages.some((m) => m.role === 'user')) {
        await supabase
          .from('chat_sessions')
          .update({ ended_at: new Date().toISOString() })
          .eq('id', session.id)
        skipped++
        continue
      }

      // ログ抽出
      const extracted = await extractLogFromMessages(
        messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      )

      // daily_logs に保存（upsert: 同日に複数セッションあっても上書き）
      await supabase.from('daily_logs').upsert(
        {
          user_id: session.user_id,
          session_id: session.id,
          date: session.date,
          events: extracted.events,
          feelings: extracted.feelings,
          achievements: extracted.achievements ?? null,
          difficulties: extracted.difficulties ?? null,
          tags: extracted.tags,
        },
        { onConflict: 'session_id' }
      )

      // セッションを終了済みにマーク
      await supabase
        .from('chat_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', session.id)

      processed++
    } catch (err) {
      console.error(`Failed to process session ${session.id}:`, err)
    }
  }

  console.log(`Cron close-sessions: processed=${processed}, skipped=${skipped}`)
  return Response.json({ ok: true, processed, skipped })
}
