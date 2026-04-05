'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { MonthlySummaryContent } from '@/lib/generate-monthly-summary'
import type { WeeklySummaryContent } from '@/lib/generate-weekly-summary'

type MonthlyData = {
  content: MonthlySummaryContent | null
  monthStart: string
}

type WeeklyData = {
  content: WeeklySummaryContent | null
  weekStart: string
}

function formatMonth(monthStart: string) {
  const d = new Date(monthStart + 'T00:00:00')
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
}

function formatWeekRange(weekStart: string) {
  const start = new Date(weekStart + 'T00:00:00')
  const end = new Date(weekStart + 'T00:00:00')
  end.setDate(end.getDate() + 6)
  const s = start.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
  const e = end.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
  return `${s}〜${e}`
}

function moodDotStyle(score: number | null): string {
  if (score === null) return 'bg-transparent border border-yori-card'
  if (score === -2) return 'bg-red-400'
  if (score === -1) return 'bg-red-200'
  if (score === 0) return 'bg-yori-card border border-yori-muted'
  if (score === 1) return 'bg-blue-200'
  return 'bg-blue-400'
}

function MonthlySummarySection() {
  const [data, setData] = useState<MonthlyData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/monthly-summary')
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

  if (!data?.content) {
    return (
      <div className="bg-yori-base border border-yori-light-border rounded-2xl p-5">
        <p className="text-xs font-medium text-yori-accent-dark mb-1">
          {data ? formatMonth(data.monthStart) : '先月'}のまとめ
        </p>
        <p className="text-xs text-yori-muted leading-relaxed">
          先月の記録がまだありません。<br />
          話すと、自動で記録されます。
        </p>
      </div>
    )
  }

  const { content, monthStart } = data

  return (
    <div className="bg-yori-base border border-yori-light-border rounded-2xl p-5 flex flex-col gap-4">
      <p className="text-xs font-medium text-yori-accent-dark">{formatMonth(monthStart)}のまとめ</p>

      {/* 1ヶ月サマリー */}
      <div>
        <p className="text-[11px] text-yori-muted mb-1">1ヶ月の振り返り</p>
        <p className="text-xs text-yori-text leading-relaxed">{content.summary}</p>
      </div>

      {/* 子どもの成長 */}
      {content.child_growth && (
        <div>
          <p className="text-[11px] text-yori-muted mb-1">子どもの成長・できたこと</p>
          <p className="text-xs text-yori-text leading-relaxed">{content.child_growth}</p>
        </div>
      )}

      {/* 子どもの特性・困りごと */}
      {content.child_difficulties && (
        <div className="bg-yori-card rounded-xl p-3">
          <p className="text-[11px] text-yori-accent-dark font-medium mb-1">相談のときのメモ</p>
          <p className="text-[11px] text-yori-muted mb-1.5">子どもの特性・困りごと</p>
          <p className="text-xs text-yori-text leading-relaxed">{content.child_difficulties}</p>
        </div>
      )}

      {/* よく出たタグ */}
      {content.top_tags.length > 0 && (
        <div>
          <p className="text-[11px] text-yori-muted mb-1.5">今月のテーマ</p>
          <div className="flex flex-wrap gap-1.5">
            {content.top_tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] text-yori-accent bg-yori-card rounded-full px-2.5 py-0.5"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ねぎらい */}
      <p className="text-xs text-yori-muted leading-relaxed">{content.encouragement}</p>
    </div>
  )
}

function WeeklySummariesSection() {
  const [items, setItems] = useState<WeeklyData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 現在週の週次サマリーを取得（キャッシュがあれば即返る）
    fetch('/api/weekly-summary')
      .then((r) => r.json())
      .then((d: WeeklyData) => {
        if (d.content) setItems([d])
      })
      .catch(() => {})
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

  if (items.length === 0) {
    return (
      <div className="bg-yori-base border border-yori-light-border rounded-2xl p-5">
        <p className="text-xs font-medium text-yori-accent-dark mb-1">今週のまとめ</p>
        <p className="text-xs text-yori-muted leading-relaxed">
          今週の記録がまだありません。<br />
          話すと、自動でまとめられます。
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map(({ content, weekStart }) => {
        if (!content) return null
        return (
          <div
            key={weekStart}
            className="bg-yori-base border border-yori-light-border rounded-2xl p-5 flex flex-col gap-3"
          >
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-medium text-yori-accent-dark">今週のまとめ</p>
              <p className="text-[10px] text-yori-muted">{formatWeekRange(weekStart)}</p>
            </div>

            {/* ムードチャート */}
            <div className="flex justify-between items-end gap-1">
              {content.mood_chart.map((entry) => (
                <div key={entry.date} className="flex flex-col items-center gap-1">
                  <div className={`w-6 h-6 rounded-full ${moodDotStyle(entry.score)}`} />
                  <span className="text-[10px] text-yori-muted">{entry.day}</span>
                </div>
              ))}
            </div>

            {/* 感情サマリー */}
            <div>
              <p className="text-[11px] text-yori-muted mb-1">今週のあなた</p>
              <p className="text-xs text-yori-text leading-relaxed">{content.emotion_summary}</p>
            </div>

            {/* 子どもの成長 */}
            {content.achievements.length > 0 && (
              <div>
                <p className="text-[11px] text-yori-muted mb-1">小さな成長・できたこと</p>
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

            {/* 子どもの特性・困りごと */}
            {content.child_difficulties && (
              <div className="bg-yori-card rounded-xl p-3">
                <p className="text-[11px] text-yori-accent-dark font-medium mb-1">相談のときのメモ</p>
                <p className="text-[11px] text-yori-muted mb-1.5">子どもの特性・困りごと</p>
                <p className="text-xs text-yori-text leading-relaxed">{content.child_difficulties}</p>
              </div>
            )}

            {/* ねぎらい */}
            <p className="text-xs text-yori-muted leading-relaxed">{content.encouragement}</p>
          </div>
        )
      })}
    </div>
  )
}

export default function ReportsPage() {
  return (
    <main className="min-h-screen bg-yori-bg flex flex-col max-w-sm mx-auto">

      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-yori-light-border bg-yori-base">
        <span className="w-10" />
        <span className="text-sm font-medium text-yori-accent-dark">レポート</span>
        <span className="w-10" />
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-4 overflow-y-auto pb-20">
        <section>
          <p className="text-xs text-yori-muted tracking-wide mb-2">月次まとめ</p>
          <MonthlySummarySection />
        </section>

        <section>
          <p className="text-xs text-yori-muted tracking-wide mb-2">週次まとめ</p>
          <WeeklySummariesSection />
        </section>
      </div>

      {/* タブバー */}
      <div className="sticky bottom-0 flex border-t border-yori-light-border bg-yori-base">
        <Link href="/home" className="flex-1 py-2.5 flex flex-col items-center gap-1 text-yori-very-muted active:opacity-75 transition-opacity">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M4 4h12a1 1 0 011 1v7a1 1 0 01-1 1H7l-3.5 2.5V5a1 1 0 011-1z"
              stroke="#B5A89E"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[10px]">チャット</span>
        </Link>
        <Link href="/logs" className="flex-1 py-2.5 flex flex-col items-center gap-1 text-yori-very-muted active:opacity-75 transition-opacity">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M4 6h12M4 10h8M4 14h6" stroke="#B5A89E" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[10px]">記録</span>
        </Link>
        <div className="flex-1 py-2.5 flex flex-col items-center gap-1 text-yori-accent">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M3 14l4-4 3 3 4-5 3 3" stroke="#8B6F5E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-[10px]">レポート</span>
        </div>
      </div>

    </main>
  )
}
