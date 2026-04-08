import { createClient } from '@/lib/supabase/server'

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

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const currentWeekStart = getWeekStartJST()
  const prevMonthStart = getPrevMonthStartJST()

  const [{ data: weeks }, { data: months }] = await Promise.all([
    supabase
      .from('weekly_summaries')
      .select('week_start')
      .eq('user_id', user.id)
      .lt('week_start', currentWeekStart)
      .order('week_start', { ascending: false })
      .limit(12),
    supabase
      .from('monthly_summaries')
      .select('month_start')
      .eq('user_id', user.id)
      .lte('month_start', prevMonthStart)
      .order('month_start', { ascending: false })
      .limit(6),
  ])

  return Response.json({
    weeks: (weeks ?? []).map((w) => w.week_start),
    months: (months ?? []).map((m) => m.month_start),
  })
}
