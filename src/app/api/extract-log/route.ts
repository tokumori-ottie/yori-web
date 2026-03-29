import { createClient } from '@/lib/supabase/server'
import { extractLogFromMessages, type Message } from '@/lib/extract-log'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { sessionId, messages } = (await request.json()) as {
    sessionId: string
    messages: Message[]
  }

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('date')
    .eq('id', sessionId)
    .eq('user_id', user.id)
    .single()

  if (!session) {
    return new Response('Session not found', { status: 404 })
  }

  try {
    const extracted = await extractLogFromMessages(messages)

    const { error } = await supabase.from('daily_logs').upsert(
      {
        user_id: user.id,
        session_id: sessionId,
        date: session.date,
        events: extracted.events,
        feelings: extracted.feelings,
        achievements: extracted.achievements ?? null,
        tags: extracted.tags,
      },
      { onConflict: 'user_id,date' }
    )

    if (error) throw error

    return Response.json({ ok: true, extracted, summary: extracted.summary ?? '' })
  } catch (err) {
    console.error('Extract log error:', err)
    return new Response('Failed to extract log', { status: 500 })
  }
}
