import Link from 'next/link'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-yori-bg flex flex-col max-w-sm mx-auto">

      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-yori-light-border bg-yori-base">
        <Link href="/home" className="text-xs text-yori-muted">← 戻る</Link>
        <span className="text-sm font-medium text-yori-accent-dark">プライバシーポリシー</span>
        <span className="w-10" />
      </div>

      <div className="flex-1 px-5 py-6 flex flex-col gap-6 text-yori-text">

        <p className="text-xs text-yori-muted leading-relaxed">
          最終更新日: 2025年7月1日
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">はじめに</h2>
          <p className="text-xs leading-relaxed text-yori-muted">
            Yori（より）（以下「本サービス」）は、障害のある子どもを育てる親のための
            AIコンパニオンアプリです。本ポリシーでは、お客様の個人情報の取り扱いについて説明します。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">収集する情報</h2>
          <ul className="text-xs leading-relaxed text-yori-muted flex flex-col gap-1.5 list-disc list-inside">
            <li>Googleアカウントの名前・メールアドレス（ログイン時）</li>
            <li>パパ / ママの種別</li>
            <li>お子さんのニックネーム・生年月日・性別</li>
            <li>Yoriとのチャット内容・記録データ</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">利用目的</h2>
          <ul className="text-xs leading-relaxed text-yori-muted flex flex-col gap-1.5 list-disc list-inside">
            <li>本サービスの提供・運営</li>
            <li>AIによる応答の生成（文脈に合わせた返答のため）</li>
            <li>記録・ログの自動生成</li>
            <li>サービスの改善</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">第三者への提供</h2>
          <p className="text-xs leading-relaxed text-yori-muted">
            以下のサービスにデータが送信されます。
          </p>
          <ul className="text-xs leading-relaxed text-yori-muted flex flex-col gap-1.5 list-disc list-inside">
            <li>
              <span className="text-yori-text">Anthropic Claude API</span>
              　— AI応答の生成のため、チャット内容が送信されます
            </li>
            <li>
              <span className="text-yori-text">Supabase</span>
              　— データベースおよび認証基盤（米国サーバー）
            </li>
          </ul>
          <p className="text-xs leading-relaxed text-yori-muted mt-1">
            上記以外の第三者にお客様の情報を販売・提供することはありません。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">データの保管・セキュリティ</h2>
          <p className="text-xs leading-relaxed text-yori-muted">
            データはSupabaseのサーバーに保存されます。各ユーザーは自分のデータにのみアクセスできる設計です（Row Level Security）。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">データの削除</h2>
          <p className="text-xs leading-relaxed text-yori-muted">
            アカウント設定ページから退会することで、すべてのデータ（チャット履歴・記録・子ども情報）を完全に削除できます。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">免責事項</h2>
          <p className="text-xs leading-relaxed text-yori-muted">
            本サービスは医療・診断・治療を目的としたものではありません。精神的なサポートや専門家への相談を促すことはありますが、医学的な判断はできません。危機的な状況（緊急性のある自傷・他傷のおそれ）がある場合は、専門機関にご相談ください。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">ポリシーの変更</h2>
          <p className="text-xs leading-relaxed text-yori-muted">
            本ポリシーは予告なく変更される場合があります。変更後もサービスをご利用された場合は、新しいポリシーに同意したものとみなします。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">お問い合わせ</h2>
          <p className="text-xs leading-relaxed text-yori-muted">
            個人情報の取り扱いに関するご質問は、以下までご連絡ください。<br />
            <span className="text-yori-accent">tokumori.pudding@gmail.com</span>
          </p>
        </section>

        <div className="pb-6" />

      </div>
    </main>
  )
}
