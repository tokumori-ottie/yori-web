'use client'

import { useState } from 'react'
import Link from 'next/link'

type Log = {
  id: string
  date: string
  events: string | null
  feelings: string | null
  achievements: string | null
  tags: string[]
  mood_score: number | null
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

function moodDotClass(score: number | null): string {
  if (score === -2) return 'bg-red-400'
  if (score === -1) return 'bg-red-200'
  if (score === 0) return 'bg-yori-card border border-yori-muted'
  if (score === 1) return 'bg-blue-200'
  if (score === 2) return 'bg-blue-400'
  return 'bg-yori-card border border-yori-muted'
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'Asia/Tokyo',
  })
}

export default function LogsCalendar({ logs }: { logs: Log[] }) {
  const today = new Date()
  const todayStr = today.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)

  const isCurrentMonth =
    year === today.getFullYear() && month === today.getMonth() + 1

  // date → logs[] (created_at descending = 先頭が最新)
  const dateMap: Record<string, Log[]> = {}
  for (const log of logs) {
    if (!dateMap[log.date]) dateMap[log.date] = []
    dateMap[log.date].push(log)
  }

  // カレンダーグリッド
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  // 今月のログ（降順）
  const monthPrefix = `${year}-${String(month).padStart(2, '0')}`
  const monthLogs = logs.filter(l => l.date.startsWith(monthPrefix))

  // 同日複数セッションのインデックス（昇順で1,2,...）
  const dateIndexMap: Record<string, number> = {}
  const monthLogsWithIndex = [...monthLogs].reverse().map(log => {
    dateIndexMap[log.date] = (dateIndexMap[log.date] ?? 0) + 1
    return { ...log, sessionIndex: dateIndexMap[log.date] }
  }).reverse()

  return (
    <div className="flex flex-col gap-4">

      {/* カレンダー */}
      <div className="bg-yori-base border border-yori-light-border rounded-2xl px-4 pt-4 pb-3">

        {/* 月ナビ */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={prevMonth}
            className="w-8 h-8 flex items-center justify-center text-yori-muted text-lg active:opacity-75"
          >
            ‹
          </button>
          <span className="text-sm font-medium text-yori-text">
            {year}年{month}月
          </span>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="w-8 h-8 flex items-center justify-center text-yori-muted text-lg active:opacity-75 disabled:opacity-20"
          >
            ›
          </button>
        </div>

        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((d, i) => (
            <div
              key={d}
              className={`text-center text-[10px] font-medium py-1 ${
                i === 0 ? 'text-red-300' : i === 6 ? 'text-blue-300' : 'text-yori-muted'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="h-10" />

            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayLogs = dateMap[dateStr]
            const isToday = dateStr === todayStr
            const latestLog = dayLogs?.reduce((prev, curr) =>
              Math.abs(curr.mood_score ?? 0) > Math.abs(prev.mood_score ?? 0) ? curr : prev
            )

            return (
              <div key={dateStr} className="flex flex-col items-center h-10 justify-start pt-0.5">
                {latestLog ? (
                  <Link
                    href={`/logs/${latestLog.id}`}
                    className="flex flex-col items-center gap-0.5 active:opacity-75"
                  >
                    <span
                      className={`text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium ${
                        isToday
                          ? 'bg-yori-accent text-yori-base'
                          : 'text-yori-text'
                      }`}
                    >
                      {day}
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${moodDotClass(latestLog.mood_score)}`} />
                  </Link>
                ) : (
                  <span
                    className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday
                        ? 'bg-yori-accent text-yori-base font-medium'
                        : 'text-yori-very-muted'
                    }`}
                  >
                    {day}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* 凡例 */}
        <div className="flex items-center justify-center gap-4 mt-2 pt-2.5 border-t border-yori-light-border">
          {([[-2, 'つらい'], [0, 'ふつう'], [2, 'よかった']] as [number, string][]).map(([score, label]) => (
            <div key={score} className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${moodDotClass(score)}`} />
              <span className="text-[10px] text-yori-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 今月のログリスト */}
      {monthLogsWithIndex.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-yori-muted">{year}年{month}月の記録</p>
          {monthLogsWithIndex.map(log => (
            <Link
              key={log.id}
              href={`/logs/${log.id}`}
              className="bg-yori-base border border-yori-light-border rounded-2xl px-4 py-3.5 flex flex-col gap-1.5 active:opacity-75"
            >
              <div className="flex items-baseline gap-2">
                <p className="text-xs text-yori-muted">{formatDate(log.date)}</p>
                {(dateMap[log.date]?.length ?? 0) > 1 && (
                  <p className="text-xs text-yori-very-muted">{log.sessionIndex}回目</p>
                )}
              </div>
              <p className="text-sm text-yori-text leading-snug line-clamp-2">
                {log.events ?? '（記録なし）'}
              </p>
              {log.achievements && (
                <p className="text-xs text-yori-avatar leading-snug line-clamp-1">{log.achievements}</p>
              )}
              {!log.achievements && log.feelings && (
                <p className="text-xs text-yori-muted leading-snug line-clamp-1">{log.feelings}</p>
              )}
              {log.tags && log.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {(log.tags as string[]).map(tag => (
                    <span key={tag} className="text-xs text-yori-accent bg-yori-card rounded-full px-2 py-0.5">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-xs text-yori-muted text-center py-6">この月の記録はありません</p>
      )}

    </div>
  )
}
