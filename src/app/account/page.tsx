'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function AccountPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [step, setStep] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null)
    })
  }, [])

  const handleDelete = async () => {
    setStep('deleting')
    setError('')
    try {
      const res = await fetch('/api/delete-account', { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')

      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/')
    } catch {
      setError('削除に失敗しました。もう一度お試しください。')
      setStep('confirm')
    }
  }

  return (
    <main className="min-h-screen bg-yori-bg flex flex-col max-w-sm mx-auto">

      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-yori-light-border bg-yori-base">
        <Link href="/home" className="text-xs text-yori-muted">← 戻る</Link>
        <span className="text-sm font-medium text-yori-accent-dark">アカウント</span>
        <span className="w-10" />
      </div>

      <div className="flex-1 px-5 py-6 flex flex-col gap-5">

        {/* アカウント情報 */}
        <section className="bg-yori-base border border-yori-light-border rounded-2xl px-4 py-4 flex flex-col gap-1">
          <p className="text-xs text-yori-muted">ログイン中のアカウント</p>
          <p className="text-sm text-yori-text">{email ?? '…'}</p>
        </section>

        {/* リンク集 */}
        <section className="flex flex-col gap-0 bg-yori-base border border-yori-light-border rounded-2xl overflow-hidden">
          <Link
            href="/privacy"
            className="px-4 py-3.5 text-sm text-yori-text flex justify-between items-center border-b border-yori-light-border"
          >
            プライバシーポリシー
            <span className="text-yori-muted text-xs">→</span>
          </Link>
          <a
            href="mailto:tokumori.pudding@gmail.com"
            className="px-4 py-3.5 text-sm text-yori-text flex justify-between items-center"
          >
            お問い合わせ
            <span className="text-yori-muted text-xs">→</span>
          </a>
        </section>

        {/* 退会 */}
        <section className="mt-auto pt-4">
          {step === 'idle' && (
            <button
              onClick={() => setStep('confirm')}
              className="w-full text-xs text-yori-muted py-3 rounded-2xl border border-yori-light-border bg-yori-base"
            >
              退会する
            </button>
          )}

          {(step === 'confirm' || step === 'deleting') && (
            <div className="bg-yori-base border border-yori-light-border rounded-2xl px-4 py-5 flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium text-yori-text mb-1.5">本当に退会しますか？</p>
                <p className="text-xs text-yori-muted leading-relaxed">
                  チャット履歴・記録・子ども情報を含む、すべてのデータが完全に削除されます。この操作は取り消せません。
                </p>
              </div>
              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}
              <div className="flex gap-2.5">
                <button
                  onClick={() => { setStep('idle'); setError('') }}
                  disabled={step === 'deleting'}
                  className="flex-1 py-2.5 rounded-xl text-xs text-yori-text bg-yori-card disabled:opacity-40"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDelete}
                  disabled={step === 'deleting'}
                  className="flex-1 py-2.5 rounded-xl text-xs text-red-500 border border-red-200 bg-red-50 disabled:opacity-40"
                >
                  {step === 'deleting' ? '削除中…' : '退会する'}
                </button>
              </div>
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
