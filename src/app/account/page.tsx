'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type ChildForm = {
  nickname: string
  year: string
  month: string
  day: string
  gender: 'boy' | 'girl' | 'other' | ''
}

const EMPTY_CHILD: ChildForm = { nickname: '', year: '', month: '', day: '', gender: '' }

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 26 }, (_, i) => currentYear - i)
const months = Array.from({ length: 12 }, (_, i) => i + 1)

function getDays(year: string, month: string) {
  if (!year || !month) return Array.from({ length: 31 }, (_, i) => i + 1)
  return Array.from({ length: new Date(Number(year), Number(month), 0).getDate() }, (_, i) => i + 1)
}

export default function AccountPage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [parentType, setParentType] = useState<'mama' | 'papa' | null>(null)
  const [children, setChildren] = useState<ChildForm[]>([{ ...EMPTY_CHILD }])
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [withdrawStep, setWithdrawStep] = useState<'idle' | 'confirm' | 'deleting'>('idle')
  const [withdrawError, setWithdrawError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setEmail(user.email ?? null)

      const [{ data: profile }, { data: childrenData }] = await Promise.all([
        supabase.from('profiles').select('parent_type').eq('id', user.id).single(),
        supabase.from('children').select('nickname, birthday, gender').eq('user_id', user.id).order('created_at', { ascending: true }),
      ])

      if (profile?.parent_type) setParentType(profile.parent_type as 'mama' | 'papa')

      if (childrenData && childrenData.length > 0) {
        setChildren(childrenData.map((c) => {
          const [year, month, day] = (c.birthday ?? '').split('-')
          return {
            nickname: c.nickname ?? '',
            year: year ?? '',
            month: month ? String(Number(month)) : '',
            day: day ? String(Number(day)) : '',
            gender: (c.gender ?? '') as ChildForm['gender'],
          }
        }))
      }
      setLoading(false)
    }
    load()
  }, [router])

  const updateChild = (index: number, field: keyof ChildForm, value: string) => {
    setChildren((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)))
  }

  const isValid = () => {
    if (!parentType) return false
    return children.length > 0 && children.every((c) => c.year && c.month && c.day && c.gender)
  }

  const handleSave = async () => {
    if (!isValid() || isSaving) return
    setIsSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ parent_type: parentType })
        .eq('id', user.id)
      if (profileError) throw profileError

      // 全削除して再挿入
      const { error: deleteError } = await supabase.from('children').delete().eq('user_id', user.id)
      if (deleteError) throw deleteError

      const { error: insertError } = await supabase.from('children').insert(
        children.map((c) => ({
          user_id: user.id,
          nickname: c.nickname.trim() || null,
          birthday: `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`,
          gender: c.gender,
        }))
      )
      if (insertError) throw insertError

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err) {
      console.error(err)
      setSaveError('保存に失敗しました。もう一度お試しください。')
    } finally {
      setIsSaving(false)
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleDelete = async () => {
    setWithdrawStep('deleting')
    setWithdrawError('')
    try {
      const res = await fetch('/api/delete-account', { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/')
    } catch {
      setWithdrawError('削除に失敗しました。もう一度お試しください。')
      setWithdrawStep('confirm')
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-yori-bg flex flex-col max-w-sm mx-auto">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-yori-light-border bg-yori-base">
          <Link href="/home" className="text-xs text-yori-muted active:opacity-75 transition-opacity">← 戻る</Link>
          <span className="text-sm font-medium text-yori-accent-dark">アカウント</span>
          <span className="w-10" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-yori-muted">読み込み中…</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-yori-bg flex flex-col max-w-sm mx-auto">

      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-yori-light-border bg-yori-base">
        <Link href="/home" className="text-xs text-yori-muted active:opacity-75 transition-opacity">← 戻る</Link>
        <span className="text-sm font-medium text-yori-accent-dark">アカウント</span>
        <span className="w-10" />
      </div>

      <div className="flex-1 px-5 py-6 flex flex-col gap-6">

        {/* プロフィール編集 */}
        <section className="flex flex-col gap-4">
          <p className="text-xs font-medium text-yori-accent-dark">プロフィール</p>

          {/* ママ / パパ */}
          <div>
            <p className="text-xs text-yori-muted mb-2">あなたは</p>
            <div className="flex gap-3">
              {(['mama', 'papa'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setParentType(type)}
                  className={`flex-1 rounded-2xl py-3 text-sm font-medium transition-all active:opacity-75 ${
                    parentType === type
                      ? 'bg-yori-accent text-yori-base'
                      : 'bg-yori-base border border-yori-light-border text-yori-text'
                  }`}
                >
                  {type === 'mama' ? 'ママ' : 'パパ'}
                </button>
              ))}
            </div>
          </div>

          {/* 子ども */}
          <div>
            <p className="text-xs text-yori-muted mb-2">お子さん</p>
            <div className="flex flex-col gap-3">
              {children.map((child, index) => (
                <div
                  key={index}
                  className="bg-yori-base border border-yori-light-border rounded-2xl px-4 py-4 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-yori-accent-dark">
                      {index === 0 ? '上の子' : index === 1 ? '下の子' : `${index + 1}人目`}
                    </p>
                    {children.length > 1 && (
                      <button
                        onClick={() => setChildren((prev) => prev.filter((_, i) => i !== index))}
                        className="text-xs text-yori-muted active:opacity-75 transition-opacity"
                      >
                        削除
                      </button>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-yori-muted mb-1">ニックネーム（任意）</p>
                    <input
                      type="text"
                      value={child.nickname}
                      onChange={(e) => updateChild(index, 'nickname', e.target.value)}
                      placeholder="例：たろう"
                      className="w-full bg-yori-card rounded-xl px-3 py-2.5 text-sm text-yori-text placeholder:text-yori-very-muted outline-none"
                    />
                  </div>

                  <div>
                    <p className="text-xs text-yori-muted mb-1">生年月日</p>
                    <div className="flex gap-2">
                      <select
                        value={child.year}
                        onChange={(e) => updateChild(index, 'year', e.target.value)}
                        className="flex-1 bg-yori-card rounded-xl px-2 py-2.5 text-sm text-yori-text outline-none"
                      >
                        <option value="">年</option>
                        {years.map((y) => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select
                        value={child.month}
                        onChange={(e) => updateChild(index, 'month', e.target.value)}
                        className="w-16 bg-yori-card rounded-xl px-2 py-2.5 text-sm text-yori-text outline-none"
                      >
                        <option value="">月</option>
                        {months.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select
                        value={child.day}
                        onChange={(e) => updateChild(index, 'day', e.target.value)}
                        className="w-16 bg-yori-card rounded-xl px-2 py-2.5 text-sm text-yori-text outline-none"
                      >
                        <option value="">日</option>
                        {getDays(child.year, child.month).map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-yori-muted mb-1">性別</p>
                    <div className="flex gap-2">
                      {[
                        { value: 'boy', label: '男の子' },
                        { value: 'girl', label: '女の子' },
                        { value: 'other', label: 'その他' },
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => updateChild(index, 'gender', opt.value)}
                          className={`flex-1 rounded-xl py-2 text-xs font-medium transition-all active:opacity-75 ${
                            child.gender === opt.value
                              ? 'bg-yori-accent text-yori-base'
                              : 'bg-yori-card text-yori-text'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={() => setChildren((prev) => [...prev, { ...EMPTY_CHILD }])}
                className="w-full rounded-2xl py-3 text-xs text-yori-accent border border-dashed border-yori-avatar bg-transparent active:opacity-75 transition-opacity"
              >
                ＋ もう一人追加
              </button>
            </div>
          </div>

          {saveError && <p className="text-xs text-red-500">{saveError}</p>}

          <button
            onClick={handleSave}
            disabled={!isValid() || isSaving}
            className="w-full bg-yori-accent text-yori-base rounded-2xl py-3.5 text-sm font-medium disabled:opacity-40 active:opacity-75 transition-opacity"
          >
            {isSaving ? '保存中…' : saveSuccess ? '保存しました' : '保存する'}
          </button>
        </section>

        {/* アカウント情報 */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-medium text-yori-accent-dark">アカウント</p>
          <div className="bg-yori-base border border-yori-light-border rounded-2xl px-4 py-3.5 flex flex-col gap-0.5">
            <p className="text-xs text-yori-muted">ログイン中のアカウント</p>
            <p className="text-sm text-yori-text">{email ?? '…'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full bg-yori-base border border-yori-light-border rounded-2xl py-3.5 text-sm text-yori-text active:opacity-75 transition-opacity"
          >
            ログアウト
          </button>
        </section>

        {/* リンク */}
        <section className="flex flex-col gap-0 bg-yori-base border border-yori-light-border rounded-2xl overflow-hidden">
          <Link
            href="/privacy"
            className="px-4 py-3.5 text-sm text-yori-text flex justify-between items-center border-b border-yori-light-border active:opacity-75 transition-opacity"
          >
            プライバシーポリシー
            <span className="text-yori-muted text-xs">→</span>
          </Link>
          <Link
            href="/terms"
            className="px-4 py-3.5 text-sm text-yori-text flex justify-between items-center border-b border-yori-light-border active:opacity-75 transition-opacity"
          >
            利用規約
            <span className="text-yori-muted text-xs">→</span>
          </Link>
          <a
            href="mailto:tokumori.ottie@gmail.com"
            className="px-4 py-3.5 text-sm text-yori-text flex justify-between items-center active:opacity-75 transition-opacity"
          >
            お問い合わせ
            <span className="text-yori-muted text-xs">→</span>
          </a>
        </section>

        {/* 退会 */}
        <section className="pb-6">
          {withdrawStep === 'idle' && (
            <button
              onClick={() => setWithdrawStep('confirm')}
              className="w-full text-xs text-yori-muted py-3 rounded-2xl border border-yori-light-border bg-yori-base active:opacity-75 transition-opacity"
            >
              退会する
            </button>
          )}
          {(withdrawStep === 'confirm' || withdrawStep === 'deleting') && (
            <div className="bg-yori-base border border-yori-light-border rounded-2xl px-4 py-5 flex flex-col gap-4">
              <div>
                <p className="text-sm font-medium text-yori-text mb-1.5">本当に退会しますか？</p>
                <p className="text-xs text-yori-muted leading-relaxed">
                  チャット履歴・記録・子ども情報を含む、すべてのデータが完全に削除されます。この操作は取り消せません。
                </p>
              </div>
              {withdrawError && <p className="text-xs text-red-500">{withdrawError}</p>}
              <div className="flex gap-2.5">
                <button
                  onClick={() => { setWithdrawStep('idle'); setWithdrawError('') }}
                  disabled={withdrawStep === 'deleting'}
                  className="flex-1 py-2.5 rounded-xl text-xs text-yori-text bg-yori-card disabled:opacity-40 active:opacity-75 transition-opacity"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleDelete}
                  disabled={withdrawStep === 'deleting'}
                  className="flex-1 py-2.5 rounded-xl text-xs text-red-500 border border-red-200 bg-red-50 disabled:opacity-40 active:opacity-75 transition-opacity"
                >
                  {withdrawStep === 'deleting' ? '削除中…' : '退会する'}
                </button>
              </div>
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
