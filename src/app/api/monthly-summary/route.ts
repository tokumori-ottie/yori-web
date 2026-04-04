import { createClient } from '@/lib/supabase/server'
import { generateMonthlySummary, type MonthlySummaryContent } from '@/lib/generate-monthly-summary'
import type { DailyLogForSummary } from '@/lib/generate-weekly-summary'

function getPrevMonthStartJST(): string {
  const jstDateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const jstDate = new Date(jstDateStr + 'T00:00:00')
  const year = jstDate.getFullYear()
  const month = jstDate.getMonth() // 0-indexed, so this is the previous month
  const prevYear = month === 0 ? year - 1 : year
  const prevMonth = month === 0 ? 12 : month
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
}

export type MonthlyResponse = {
  content: MonthlySummaryContent | null
  monthStart: string
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const monthStart = getPrevMonthStartJST()

  // キャッシュ確認
  const { data: cached } = await supabase
    .from('monthly_summaries')
    .select('content')
    .eq('user_id', user.id)
    .eq('month_start', monthStart)
    .single()

  if (cached) return Response.json({ content: cached.content, monthStart })

  // 前月のログを取得
  const [year, month] = monthStart.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  const monthEnd = `${monthStart.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`

  const { data: logs } = await supabase
    .from('daily_logs')
    .select('date, events, feelings, achievements, tags, mood_score')
    .eq('user_id', user.id)
    .gte('date', monthStart)
    .lte('date', monthEnd)
    .order('date', { ascending: true })

  if (!logs || logs.length === 0) {
    return Response.json({ content: null, monthStart })
  }

  try {
    const content = await generateMonthlySummary(logs as DailyLogForSummary[])

    await supabase
      .from('monthly_summaries')
      .upsert({ user_id: user.id, month_start: monthStart, content }, { onConflict: 'user_id,month_start' })

    return Response.json({ content, monthStart })
  } catch (err) {
    console.error('Monthly summary error:', err)
    return new Response('Failed to generate summary', { status: 500 })
  }
}
