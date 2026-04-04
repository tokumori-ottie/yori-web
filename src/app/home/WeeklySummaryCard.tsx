'use client'

import { useEffect, useState } from 'react'
import type { WeeklySummaryContent, MoodChartEntry } from '@/lib/generate-weekly-summary'

type SummaryResponse = {
  content: WeeklySummaryContent | null
  weekStart: string
}

function moodDotStyle(score: number | null): string {
  if (score === null) return 'bg-transparent border border-yori-card'
  if (score === -2) return 'bg-red-400'
  if (score === -1) return 'bg-red-200'
  if (score === 0) return 'bg-yori-card border border-yori-muted'
  if (score === 1) return 'bg-blue-200'
  return 'bg-blue-400'
}

function MoodChart({ entries }: { entries: MoodChartEntry[] }) {
  return (
    <div className="flex justify-between items-end gap-1 mt-3">
      {entries.map((entry) => (
        <div key={entry.date} className="flex flex-col items-center gap-1">
          <div className={`w-6 h-6 rounded-full ${moodDotStyle(entry.score)}`} />
          <span className="text-[10px] text-yori-muted">{entry.day}</span>
        </div>
      ))}
    </div>
  )
}

export default function WeeklySummaryCard() {
  const [data, setData] = useState<SummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/weekly-summary')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-yori-base border border-yori-light-border rounded-2xl p-5 animate-pulse">
        <div className="h-3 w-24 bg-yori-card rounded mb-3" />
        <div className="h-3 w-full bg-yori-card rounded mb-2" />
        <div className="h-3 w-4/5 bg-yori-card rounded" />
      </div>
    )
  }

  if (!data?.content) return null

  const { content } = data

  return (
    <div className="bg-yori-base border border-yori-light-border rounded-2xl p-5 flex flex-col gap-4">
      <p className="text-xs font-medium text-yori-accent-dark">今週のまとめ</p>

      {/* ムードチャート */}
      <MoodChart entries={content.mood_chart} />

      {/* 今週のあなた */}
      <div>
        <p className="text-[11px] text-yori-muted mb-1">今週のあなた</p>
        <p className="text-xs text-yori-text leading-relaxed">{content.emotion_summary}</p>
      </div>

      {/* 印象的だった出来事 */}
      {content.notable_events.length > 0 && (
        <div>
          <p className="text-[11px] text-yori-muted mb-1.5">印象的だった出来事</p>
          <div className="flex flex-col gap-1.5">
            {content.notable_events.map((e, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-[10px] text-yori-muted flex-shrink-0 pt-0.5">{e.date}</span>
                <p className="text-xs text-yori-text leading-relaxed">{e.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 小さな成長・できたこと */}
      {content.achievements.length > 0 && (
        <div>
          <p className="text-[11px] text-yori-muted mb-1.5">小さな成長・できたこと</p>
          <div className="flex flex-col gap-1">
            {content.achievements.map((a, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className="text-yori-avatar text-xs flex-shrink-0">•</span>
                <p className="text-xs text-yori-text leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 気づき */}
      {content.insight && (
        <div className="bg-yori-card rounded-xl px-3.5 py-2.5">
          <p className="text-xs text-yori-text leading-relaxed">{content.insight}</p>
        </div>
      )}

      {/* ねぎらい */}
      <p className="text-xs text-yori-muted leading-relaxed">{content.encouragement}</p>
    </div>
  )
}
