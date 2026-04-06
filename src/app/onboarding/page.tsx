'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ChildForm = {
  nickname: string
  year: string
  month: string
  day: string
  gender: 'boy' | 'girl' | 'other' | ''
}

const EMPTY_CHILD: ChildForm = {
  nickname: '',
  year: '',
  month: '',
  day: '',
  gender: '',
}

const currentYear = new Date().getFullYear()
const years = Array.from({ length: 26 }, (_, i) => currentYear - i)
const months = Array.from({ length: 12 }, (_, i) => i + 1)

export default function OnboardingPage() {
  const router = useRouter()
  const [parentType, setParentType] = useState<'mama' | 'papa' | null>(null)
  const [children, setChildren] = useState<ChildForm[]>([{ ...EMPTY_CHILD }])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const getDays = (year: string, month: string) => {
    if (!year || !month) return Array.from({ length: 31 }, (_, i) => i + 1)
    const daysInMonth = new Date(Number(year), Number(month), 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => i + 1)
  }

  const updateChild = (index: number, field: keyof ChildForm, value: string) => {
    setChildren((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    )
  }

  const addChild = () => {
    setChildren((prev) => [...prev, { ...EMPTY_CHILD }])
  }

  const removeChild = (index: number) => {
    setChildren((prev) => prev.filter((_, i) => i !== index))
  }

  const isValid = () => {
    if (!parentType) return false
    return children.every(
      (c) => c.year && c.month && c.day && c.gender
    )
  }

  const handleSubmit = async () => {
    if (!isValid() || isSubmitting) return
    setIsSubmitting(true)
    setError('')

    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // プロフィール更新
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ parent_type: parentType })
        .eq('id', user.id)
      if (profileError) throw profileError

      // 子どもを登録
      const childrenToInsert = children.map((c) => ({
        user_id: user.id,
        nickname: c.nickname.trim() || null,
        birthday: `${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`,
        gender: c.gender,
      }))
      const { error: childrenError } = await supabase
        .from('children')
        .insert(childrenToInsert)
      if (childrenError) throw childrenError

      router.push('/welcome')
    } catch (err) {
      console.error(err)
      setError('保存に失敗しました。もう一度お試しください。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-yori-bg flex flex-col max-w-sm mx-auto px-5 py-8">

      <div className="mb-8">
        <div className="w-9 h-9 rounded-full bg-yori-avatar flex items-center justify-center text-sm text-yori-base font-medium mb-4">
          よ
        </div>
        <p className="text-lg font-medium text-yori-text leading-snug">
          はじめまして。<br />
          少しだけ教えてください。
        </p>
        <p className="text-xs text-yori-muted mt-1.5">
          Yoriがあなたに合わせた話し方をするために使います。
        </p>
      </div>

      {/* パパ / ママ */}
      <section className="mb-7">
        <p className="text-xs text-yori-muted mb-2.5">あなたは</p>
        <div className="flex gap-3">
          {(['mama', 'papa'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setParentType(type)}
              className={`flex-1 rounded-2xl py-4 text-sm font-medium transition-all active:opacity-75 ${
                parentType === type
                  ? 'bg-yori-accent text-yori-base'
                  : 'bg-yori-base border border-yori-light-border text-yori-text'
              }`}
            >
              {type === 'mama' ? 'ママ' : 'パパ'}
            </button>
          ))}
        </div>
      </section>

      {/* 子どもたち */}
      <section className="mb-6">
        <p className="text-xs text-yori-muted mb-2.5">お子さんについて</p>
        <div className="flex flex-col gap-4">
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
                    onClick={() => removeChild(index)}
                    className="text-xs text-yori-muted active:opacity-75 transition-opacity"
                  >
                    削除
                  </button>
                )}
              </div>

              {/* ニックネーム */}
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

              {/* 生年月日 */}
              <div>
                <p className="text-xs text-yori-muted mb-1">生年月日</p>
                <div className="flex gap-2">
                  <select
                    value={child.year}
                    onChange={(e) => updateChild(index, 'year', e.target.value)}
                    className="flex-1 bg-yori-card rounded-xl px-2 py-2.5 text-sm text-yori-text outline-none"
                  >
                    <option value="">年</option>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <select
                    value={child.month}
                    onChange={(e) => updateChild(index, 'month', e.target.value)}
                    className="w-16 bg-yori-card rounded-xl px-2 py-2.5 text-sm text-yori-text outline-none"
                  >
                    <option value="">月</option>
                    {months.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={child.day}
                    onChange={(e) => updateChild(index, 'day', e.target.value)}
                    className="w-16 bg-yori-card rounded-xl px-2 py-2.5 text-sm text-yori-text outline-none"
                  >
                    <option value="">日</option>
                    {getDays(child.year, child.month).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 性別 */}
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
            onClick={addChild}
            className="w-full rounded-2xl py-3 text-xs text-yori-accent border border-dashed border-yori-avatar bg-transparent active:opacity-75 transition-opacity"
          >
            ＋ もう一人追加
          </button>
        </div>
      </section>

      {error && (
        <p className="text-xs text-red-500 mb-3">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!isValid() || isSubmitting}
        className="w-full bg-yori-accent text-yori-base rounded-2xl py-4 text-sm font-medium disabled:opacity-40 active:opacity-75 transition-opacity"
      >
        {isSubmitting ? '保存中…' : 'はじめる'}
      </button>

    </main>
  )
}
