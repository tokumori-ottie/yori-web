import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function WelcomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  // ログが存在する = すでに使ったことがある → /home へ
  const { count } = await supabase
    .from('daily_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (count && count > 0) redirect('/home')

  return (
    <main className="min-h-screen bg-yori-bg flex flex-col max-w-sm mx-auto px-6">

      <div className="flex-1 flex flex-col justify-center gap-8">

        {/* アバター */}
        <div className="w-12 h-12 rounded-full bg-yori-avatar flex items-center justify-center text-base text-yori-base font-medium">
          よ
        </div>

        {/* メッセージ */}
        <div className="flex flex-col gap-4">
          <p className="text-xl font-medium text-yori-text leading-snug">
            ようこそ。<br />
            Yoriです。
          </p>
          <p className="text-sm text-yori-text leading-relaxed">
            子どものこと、自分のこと、<br />
            しんどいことも嬉しいことも、<br />
            ここに置いていってください。
          </p>
          <p className="text-sm text-yori-text leading-relaxed">
            アドバイスより、ただ聞くことを<br />
            大切にします。
          </p>
          <p className="text-xs text-yori-muted leading-relaxed mt-1">
            話した内容は記録として残り、<br />
            毎週・毎月まとめてお届けします。
          </p>
        </div>

      </div>

      {/* ボタン */}
      <div className="pb-12">
        <Link
          href="/home"
          className="block w-full bg-yori-accent text-yori-base rounded-2xl py-4 text-sm font-medium text-center active:opacity-80"
        >
          話してみる
        </Link>
      </div>

    </main>
  )
}
