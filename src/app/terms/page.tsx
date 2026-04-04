import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-yori-bg flex flex-col max-w-sm mx-auto">

      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-yori-light-border bg-yori-base">
        <Link href="/home" className="text-xs text-yori-muted active:opacity-75 transition-opacity">← 戻る</Link>
        <span className="text-sm font-medium text-yori-accent-dark">利用規約</span>
        <span className="w-10" />
      </div>

      <div className="flex-1 px-5 py-6 flex flex-col gap-6 text-yori-text">

        <p className="text-xs text-yori-muted leading-relaxed">
          最終更新日: 2026年3月31日
        </p>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">はじめに</h2>
          <p className="text-xs leading-relaxed text-yori-muted">
            本利用規約（以下「本規約」）は、Yori（より）（以下「本サービス」）のご利用条件を定めるものです。本サービスをご利用いただくことで、本規約に同意したものとみなします。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">サービスの性質</h2>
          <p className="text-xs leading-relaxed text-yori-muted">
            本サービスは、障害のある子どもを育てる親のための AIコンパニオンアプリです。日々の気持ちや出来事を話せる場を提供することを目的としています。
          </p>
          <p className="text-xs leading-relaxed text-yori-muted">
            本サービスは医療・診断・治療・福祉的判断を目的としたものではありません。AIによる応答は専門家の意見に代わるものではなく、その正確性・適切性を保証するものではありません。
          </p>
          <p className="text-xs leading-relaxed text-yori-muted">
            緊急性のある状況（自傷・他傷のおそれ等）が生じた場合は、直ちに専門機関や緊急サービスにご相談ください。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">利用資格</h2>
          <p className="text-xs leading-relaxed text-yori-muted">
            本サービスは18歳以上の方を対象としています。未成年の方は保護者の同意を得た上でご利用ください。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">禁止事項</h2>
          <ul className="text-xs leading-relaxed text-yori-muted flex flex-col gap-1.5 list-disc list-inside">
            <li>本サービスを違法な目的で利用すること</li>
            <li>他のユーザーや第三者を誹謗中傷すること</li>
            <li>本サービスのシステムに不正にアクセスすること</li>
            <li>AIの応答を医療・法律・福祉の専門的判断として第三者に提供すること</li>
            <li>本サービスを商業目的で無断利用すること</li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">免責事項</h2>
          <p className="text-xs leading-relaxed text-yori-muted">
            本サービスは現状有姿で提供されます。運営者は、AIの応答内容・サービスの継続性・データの保全について、法令上許容される範囲で一切の保証を行いません。
          </p>
          <p className="text-xs leading-relaxed text-yori-muted">
            本サービスの利用により生じた損害について、運営者の故意または重大な過失による場合を除き、運営者は責任を負いません。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">サービスの変更・終了</h2>
          <p className="text-xs leading-relaxed text-yori-muted">
            運営者は、事前の通知なく本サービスの内容を変更、または提供を終了する場合があります。終了の際は、可能な範囲で事前にお知らせするよう努めます。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">知的財産</h2>
          <p className="text-xs leading-relaxed text-yori-muted">
            本サービスに関するデザイン・コード・テキスト等の著作権は運営者に帰属します。ユーザーが入力したデータの権利はユーザー本人に帰属します。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">規約の変更</h2>
          <p className="text-xs leading-relaxed text-yori-muted">
            本規約は予告なく変更される場合があります。変更後もサービスをご利用された場合は、新しい規約に同意したものとみなします。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">準拠法・管轄</h2>
          <p className="text-xs leading-relaxed text-yori-muted">
            本規約は日本法に準拠します。本サービスに関する紛争については、運営者の所在地を管轄する裁判所を専属的合意管轄とします。
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">お問い合わせ</h2>
          <p className="text-xs leading-relaxed text-yori-muted">
            本規約に関するご質問は、以下までご連絡ください。<br />
            <span className="text-yori-accent">tokumori.ottie@gmail.com</span>
          </p>
        </section>

        <div className="pb-6" />

      </div>
    </main>
  )
}
