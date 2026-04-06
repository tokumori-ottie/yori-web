'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export type WeekMoodEntry = {
  date: string
  day: string
  score: number | null
}

type Props = {
  userId: string
  initialGreeting: string
  weekMoodChart: WeekMoodEntry[]
}

const AGAIN_GREETING = 'また話しかけてくれたんだね。続きを聞かせて。'

function getTodayJST(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
}

function moodDotStyle(score: number | null): string {
  if (score === null) return 'bg-transparent border border-yori-card'
  if (score === -2) return 'bg-red-400'
  if (score === -1) return 'bg-red-200'
  if (score === 0) return 'bg-yori-card border border-yori-muted'
  if (score === 1) return 'bg-blue-200'
  return 'bg-blue-400'
}

export default function ChatClient({ userId, initialGreeting, weekMoodChart }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { id: 'initial', role: 'assistant', content: initialGreeting },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [logSaved, setLogSaved] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [endError, setEndError] = useState(false)
  const [showFirstHint, setShowFirstHint] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    initSession()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const initSession = async () => {
    const supabase = createClient()
    const today = getTodayJST()

    const { data: existing } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .is('ended_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let sid = existing?.id

    const messagesPromise = sid
      ? supabase
          .from('messages')
          .select('id, role, content')
          .eq('session_id', sid)
          .order('created_at', { ascending: true })
      : null

    if (!sid) {
      const { data: created } = await supabase
        .from('chat_sessions')
        .insert({ user_id: userId, date: today })
        .select('id')
        .single()
      sid = created?.id
    }

    if (!sid) return
    setSessionId(sid)

    const { data: existingMsgs } = messagesPromise
      ? await messagesPromise
      : await supabase
          .from('messages')
          .select('id, role, content')
          .eq('session_id', sid)
          .order('created_at', { ascending: true })

    if (existingMsgs && existingMsgs.length > 0) {
      setMessages(
        existingMsgs.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))
      )
    }
  }

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || !sessionId || isLoading) return

    setInput('')
    setIsLoading(true)

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
    }
    const aiPlaceholderId = `ai-${Date.now()}`
    const aiPlaceholder: Message = {
      id: aiPlaceholderId,
      role: 'assistant',
      content: '',
    }

    setMessages((prev) => [...prev, userMsg, aiPlaceholder])

    try {
      const history = messages
        .filter((m) => m.id !== 'initial')
        .map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId, history }),
      })

      if (!res.ok || !res.body) throw new Error('Chat API error')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let aiContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        aiContent += decoder.decode(value, { stream: true })
        setMessages((prev) =>
          prev.map((m) => (m.id === aiPlaceholderId ? { ...m, content: aiContent } : m))
        )
      }
    } catch (err) {
      console.error(err)
      setMessages((prev) => prev.filter((m) => m.id !== aiPlaceholderId))
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const endSession = async () => {
    if (!sessionId || isEnding) return
    const conversationMessages = messages.filter((m) => m.id !== 'initial')
    if (conversationMessages.length < 2) return

    setIsEnding(true)
    setEndError(false)
    try {
      const res = await fetch('/api/extract-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messages: conversationMessages }),
      })

      if (!res.ok) throw new Error('extract-log failed')

      const data = await res.json()

      const supabase = createClient()
      await supabase
        .from('chat_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId)

      // 初回セッション終了ヒントの判定（localStorageで管理）
      if (!localStorage.getItem('yori_session_completed')) {
        localStorage.setItem('yori_session_completed', '1')
        setShowFirstHint(true)
      }

      setLogSaved(true)

      if (data.summary) {
        setMessages((prev) => [
          ...prev,
          {
            id: `summary-${Date.now()}`,
            role: 'assistant',
            content: data.summary,
          },
        ])
      }
    } catch (err) {
      console.error(err)
      setEndError(true)
    } finally {
      setIsEnding(false)
    }
  }

  const startNewSession = async () => {
    const supabase = createClient()
    const today = getTodayJST()
    const { data: created } = await supabase
      .from('chat_sessions')
      .insert({ user_id: userId, date: today })
      .select('id')
      .single()

    if (!created?.id) return

    setSessionId(created.id)
    setMessages([{ id: 'initial', role: 'assistant', content: AGAIN_GREETING }])
    setLogSaved(false)
    setEndError(false)
    inputRef.current?.focus()
  }

  const hasConversation = messages.filter((m) => m.id !== 'initial').length >= 2

  return (
    <main className="min-h-screen bg-yori-base flex flex-col max-w-sm mx-auto">

      {/* ナビ */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-yori-light-border bg-yori-base">
        <span className="text-base font-medium text-yori-accent-dark tracking-tight">Yori</span>
        <Link
          href="/account"
          className="text-xs text-yori-muted active:opacity-75 transition-opacity"
        >
          アカウント
        </Link>
      </div>

      {/* 今週のムードチャート */}
      {weekMoodChart.length > 0 && (
        <Link
          href="/reports"
          className="flex items-center gap-3 px-5 py-2 bg-yori-base border-b border-yori-light-border active:opacity-75 transition-opacity"
        >
          <span className="text-[10px] text-yori-muted flex-shrink-0">今週</span>
          <div className="flex gap-1.5 items-end">
            {weekMoodChart.map((entry) => (
              <div key={entry.date} className="flex flex-col items-center gap-0.5">
                <div className={`w-4 h-4 rounded-full ${moodDotStyle(entry.score)}`} />
                <span className="text-[9px] text-yori-very-muted">{entry.day}</span>
              </div>
            ))}
          </div>
          <span className="text-[10px] text-yori-very-muted ml-auto">→</span>
        </Link>
      )}

      {/* メッセージ一覧 */}
      <div className="flex-1 px-4 py-4 flex flex-col gap-3.5 overflow-y-auto">
        {messages.map((msg) => (
          <MessageRow key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="border-t border-yori-light-border bg-yori-base">

        {/* 終了後: 記録保存通知 + また話すボタン */}
        {logSaved && (
          <div className="px-3.5 pt-2.5 flex flex-col gap-2">
            <div className="bg-yori-card rounded-xl px-3.5 py-2.5">
              <p className="text-xs text-yori-muted">今日の記録に保存しました</p>
              {showFirstHint && (
                <p className="text-xs text-yori-muted mt-1.5 leading-relaxed">
                  話した内容は「記録」に残り、毎週・毎月まとめてレポートになります。
                </p>
              )}
              <Link
                href="/logs"
                className="text-xs text-yori-accent mt-1 inline-block active:opacity-75 transition-opacity"
              >
                記録を見る →
              </Link>
            </div>
            <button
              onClick={startNewSession}
              className="w-full bg-yori-accent text-yori-base text-xs font-medium rounded-xl py-2.5 transition-opacity active:opacity-80"
            >
              また話す
            </button>
          </div>
        )}

        {/* エラー通知 */}
        {endError && (
          <div className="px-3.5 pt-2.5">
            <div className="bg-red-50 rounded-xl px-3.5 py-2.5">
              <p className="text-xs text-red-500">保存に失敗しました。もう一度試してみてください。</p>
            </div>
          </div>
        )}

        {/* 終了ボタン */}
        {hasConversation && !logSaved && (
          <div className="px-3.5 pt-2.5">
            <button
              onClick={endSession}
              disabled={isEnding}
              className="w-full bg-yori-card text-yori-accent text-xs font-medium rounded-xl py-2.5 disabled:opacity-50 active:opacity-75 transition-opacity"
            >
              {isEnding ? '保存中…' : '今日の話を終える'}
            </button>
          </div>
        )}

        {/* テキスト入力 */}
        <div className="px-3.5 py-3 pb-6 flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${e.target.scrollHeight}px`
            }}
            onKeyDown={handleKeyDown}
            placeholder="話す…"
            rows={1}
            className="flex-1 bg-yori-card border-none rounded-2xl px-3.5 py-2.5 text-sm text-yori-text placeholder:text-yori-very-muted outline-none resize-none leading-relaxed"
            style={{ maxHeight: '160px', overflowY: 'auto' }}
            disabled={isLoading || logSaved}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || !sessionId || logSaved}
            className="w-9 h-9 rounded-full bg-yori-accent flex-shrink-0 flex items-center justify-center disabled:opacity-40 active:opacity-75 transition-opacity mb-0.5"
            aria-label="送信"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M14 8L2 2l3 6-3 6 12-6z" fill="#FAF8F5" />
            </svg>
          </button>
        </div>

      </div>

      {/* タブバー */}
      <div className="sticky bottom-0 flex border-t border-yori-light-border bg-yori-base">
        <div className="flex-1 py-2.5 flex flex-col items-center gap-1 text-yori-accent">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M4 4h12a1 1 0 011 1v7a1 1 0 01-1 1H7l-3.5 2.5V5a1 1 0 011-1z"
              stroke="#8B6F5E"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[10px]">チャット</span>
        </div>
        <Link
          href="/logs"
          className="flex-1 py-2.5 flex flex-col items-center gap-1 text-yori-very-muted active:opacity-75 transition-opacity"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M4 6h12M4 10h8M4 14h6" stroke="#B5A89E" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[10px]">記録</span>
        </Link>
        <Link
          href="/reports"
          className="flex-1 py-2.5 flex flex-col items-center gap-1 text-yori-very-muted active:opacity-75 transition-opacity"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path
              d="M3 14l4-4 3 3 4-5 3 3"
              stroke="#B5A89E"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[10px]">レポート</span>
        </Link>
      </div>

    </main>
  )
}

function MessageRow({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex gap-2 items-start flex-row-reverse">
        <div className="w-7 h-7 rounded-full bg-yori-border flex-shrink-0 flex items-center justify-center text-[10px] text-yori-accent-dark font-medium">
          私
        </div>
        <div className="max-w-[220px]">
          <div className="bg-yori-accent text-yori-base rounded-tl-2xl rounded-bl-2xl rounded-br-2xl px-3 py-2.5 text-sm leading-relaxed">
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2 items-start">
      <div className="w-7 h-7 rounded-full bg-yori-avatar flex-shrink-0 flex items-center justify-center text-xs text-yori-base font-medium">
        よ
      </div>
      <div className="max-w-[220px]">
        <div className="bg-yori-base border border-yori-light-border rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-3 py-2.5 text-sm text-yori-text leading-relaxed whitespace-pre-wrap">
          {message.content ? message.content : <LoadingDots />}
        </div>
      </div>
    </div>
  )
}

function LoadingDots() {
  return (
    <div className="flex gap-1 items-center py-0.5 px-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-yori-border animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  )
}
