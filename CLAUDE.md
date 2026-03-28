# Yori（より）プロジェクト

障害のある子どもを育てる親向けのAIコンパニオンアプリ。日々の気持ちや出来事を話せる場所を提供する。

## 技術スタック

- **フレームワーク**: Next.js 15 (App Router) + TypeScript
- **認証・DB**: Supabase（Google OAuthログイン、RLS有効）
- **AI**: Google Gemini API（gemini-2.5-flash）
- **スタイル**: Tailwind CSS（カスタムカラーパレット）
- **デプロイ**: Vercel（本番: https://yori-web-ruby.vercel.app）

## ディレクトリ構成

```
src/
  app/
    page.tsx              # ログインページ（Googleログインボタン）
    home/page.tsx         # ホーム（最近の記録一覧、チャットへの導線）
    chat/page.tsx         # チャットUI（ストリーミング対応、セッション管理）
    logs/page.tsx         # 記録一覧（過去30件）
    logs/[id]/page.tsx    # 記録詳細
    auth/callback/        # Supabase OAuth コールバック
    api/
      chat/route.ts       # Gemini SSEストリーミング、メッセージDB保存
      extract-log/route.ts # 会話からログ抽出（events/feelings/tags/summary）
  lib/supabase/
    server.ts             # サーバーサイドSupabaseクライアント
    client.ts             # クライアントサイドSupabaseクライアント
  middleware.ts           # Supabaseセッション更新
```

## Supabaseテーブル構成

- `profiles` - ユーザープロフィール（auth.usersトリガーで自動作成）
- `chat_sessions` - チャットセッション（user_id + date でユニーク）
- `messages` - チャットメッセージ（session_idに紐づく）
- `daily_logs` - 日次記録（user_id + date でユニーク、events/feelings/tags）

## 環境変数（.env.local / Vercel）

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
```

## カラーパレット（tailwind.config）

- `yori-bg`: #F5F0EB（背景）
- `yori-base`: #FAF8F5（カードベース）
- `yori-card`: #EDE5DC（カード）
- `yori-accent`: #8B6F5E（アクセント・ブラウン）
- `yori-accent-dark`: #6B4F3F
- `yori-text`: #3D2B1F（本文）
- `yori-muted`: #9C8276
- `yori-avatar`: #C4A882

## 開発メモ

- AI応答は質問しすぎないよう設計（2〜3ターンに1回程度）
- 「今日の話を終える」ボタンで会話をまとめてDBに保存 + ねぎらいメッセージ表示
- 日時表示はすべて `timeZone: 'Asia/Tokyo'` を指定
- `@supabase/ssr` の `CookieOptions` 型を明示的にインポートしないとTypeScriptエラーになる
