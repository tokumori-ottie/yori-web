'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const INITIAL_MESSAGE: Message = {
  id: 'initial',
  role: 'assistant',
  content: '今日はどんな一日でしたか？子どものことでも、自分のことでも。',
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [logSaved, setLogSaved] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [endError, setEndError] = useState(false)
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
    // getSession はローカルキャッシュから読むため getUser より高速
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const today = getTodayJST()

    // 今日の未終了セッションを取得（なければ作成）
    const { data: existing } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('date', today)
      .is('ended_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let sid = existing?.id

    // 既存セッションがあればメッセージ取得を並列で開始、なければ新規作成
    const messagesPromise = sid
      ? supabase.from('messages').select('id, role, content').eq('session_id', sid).order('created_at', { ascending: true })
      : null

    if (!sid) {
      const { data: created } = await supabase
        .from('chat_sessions')
        .insert({ user_id: user.id, date: today })
        .select('id')
        .single()
      sid = created?.id
    }

    if (!sid) return
    setSessionId(sid)

    // 既存メッセージをロード（並列で取得済みの場合はそれを使う）
    const { data: existingMsgs } = messagesPromise
      ? await messagesPromise
      : await supabase.from('messages').select('id, role, content').eq('session_id', sid).order('created_at', { ascending: true })

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
          prev.map((m) =>
            m.id === aiPlaceholderId ? { ...m, content: aiContent } : m
          )
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

      // セッションを終了済みにマーク
      const supabase = createClient()
      await supabase
        .from('chat_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId)

      setLogSaved(true)

      // ねぎらいメッセージをYoriの発言として追加
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
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user
    if (!user) return

    const today = getTodayJST()
    const { data: created } = await supabase
      .from('chat_sessions')
      .insert({ user_id: user.id, date: today })
      .select('id')
      .single()

    if (!created?.id) return

    setSessionId(created.id)
    setMessages([INITIAL_MESSAGE])
    setLogSaved(false)
    setEndError(false)
    inputRef.current?.focus()
  }

  const hasConversation = messages.filter((m) => m.id !== 'initial').length >= 2

  return (
    <main className="min-h-screen bg-yori-base flex flex-col max-w-sm mx-auto">

      {/* ナビ */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-yori-light-border bg-yori-base">
        <Link href="/home" className="text-xs text-yori-muted">
          ← 戻る
        </Link>
        <span className="text-sm font-medium text-yori-accent-dark">Yoriと話す</span>
        <span className="w-10" />
      </div>

      {/* メッセージ一覧 */}
      <div className="flex-1 px-4 py-4 flex flex-col gap-3.5 overflow-y-auto">
        {messages.map((msg) => (
          <MessageRow key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 入力エリア */}
      <div className="border-t border-yori-light-border bg-yori-base">

        {/* 終了後: ねぎらい通知 + また話すボタン */}
        {logSaved && (
          <div className="px-3.5 pt-2.5 flex flex-col gap-2">
            <div className="bg-yori-card rounded-xl px-3.5 py-2.5">
              <p className="text-xs text-yori-muted">今日の記録に保存しました</p>
              <Link href="/logs" className="text-xs text-yori-accent mt-0.5 inline-block active:opacity-75 transition-opacity">
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

    </main>
  )
}

function getTodayJST(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
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
      <Avatar label="よ" />
      <div className="max-w-[220px]">
        <div className="bg-yori-base border border-yori-light-border rounded-tr-2xl rounded-br-2xl rounded-bl-2xl px-3 py-2.5 text-sm text-yori-text leading-relaxed whitespace-pre-wrap">
          {message.content ? message.content : <LoadingDots />}
        </div>
      </div>
    </div>
  )
}

function Avatar({ label }: { label: string }) {
  return (
    <div className="w-7 h-7 rounded-full bg-yori-avatar flex-shrink-0 flex items-center justify-center text-xs text-yori-base font-medium">
      {label}
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
