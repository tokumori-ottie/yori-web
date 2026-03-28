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
    onboarding/page.tsx   # 初回オンボーディング（パパ/ママ・子ども情報入力）
    home/page.tsx         # ホーム（最近の記録一覧、チャットへの導線）
    chat/page.tsx         # チャットUI（ストリーミング対応、セッション管理）
    logs/page.tsx         # 記録一覧（過去30件）
    logs/[id]/page.tsx    # 記録詳細（チャット履歴も表示）
    auth/callback/        # Supabase OAuth コールバック
    api/
      chat/route.ts       # Gemini SSEストリーミング、メッセージDB保存、プロフィール注入
      extract-log/route.ts # 会話からログ抽出（events/feelings/achievements/tags/summary）
  lib/supabase/
    server.ts             # サーバーサイドSupabaseクライアント
    client.ts             # クライアントサイドSupabaseクライアント
  middleware.ts           # Supabaseセッション更新
supabase/
  schema.sql              # テーブル定義の参照用
  migrations/             # スキーマ変更履歴（Supabaseダッシュボードで手動実行）
    001_chat_sessions_ended_at.sql
    002_daily_logs_achievements.sql
    003_profiles_parent_type_and_children.sql
```

## Supabaseテーブル構成

- `profiles` - ユーザープロフィール（auth.usersトリガーで自動作成）
  - `parent_type`: `'mama' | 'papa'`（オンボーディングで設定）
- `children` - 子ども情報（1ユーザーに複数）
  - `nickname`, `birthday`, `gender`（`'boy' | 'girl' | 'other'`）
- `chat_sessions` - チャットセッション（1日複数可）
  - `ended_at`: 会話終了時刻。`null` = 継続中
  - ※ `unique(user_id, date)` 制約は削除済み
- `messages` - チャットメッセージ（session_idに紐づく）
- `daily_logs` - 日次記録（user_id + date でユニーク、upsert）
  - `events`, `feelings`, `achievements`（成長・できたこと）, `tags`

## セッション管理のしくみ

- チャット開始時: `ended_at IS NULL` の当日セッションを取得、なければ新規作成
- 「今日の話を終える」: extract-log → `ended_at` を更新 → ねぎらいメッセージ表示
- 「また話す」: 新しいセッションを作成して画面リセット（同日複数セッション可）
- 記録詳細（`/logs/[id]`）からそのセッションのチャット履歴を参照できる

## Yoriのシステムプロンプト構成

チャットAPI（`api/chat/route.ts`）で毎回プロフィールと子ども情報を取得し、システムプロンプトに注入する。

```
SYSTEM_PROMPT（固定）
+
【話している相手の情報】
- お母さん / お父さん
- お子さん: たろう（7歳・男の子）、はな（4歳・女の子）
```

Yoriの設計方針:
- しんどさも嬉しさも同じように受け止める
- 子どもの小さな成長・「できた」を一緒に喜ぶ
- 質問は2〜3ターンに1回程度。受け止めて終わる返しを大切にする

## オンボーディングフロー

初回ログイン後、`profiles.parent_type` が未設定なら `/onboarding` へリダイレクト。

1. パパ / ママ を選択
2. 子どもカードを入力（ニックネーム任意・生年月日・性別）
3. 「＋もう一人追加」で複数対応
4. 「はじめる」→ `/home` へ

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
- `yori-avatar`: #C4A882（achievementsなど温かみのある表示に使用）

## 開発メモ

- 日時表示はすべて `timeZone: 'Asia/Tokyo'` を指定
- 当日の日付取得は `getTodayJST()` を使う（`sv-SE` ロケールで `YYYY-MM-DD` 形式）
- `@supabase/ssr` の `CookieOptions` 型を明示的にインポートしないとTypeScriptエラーになる
- マイグレーションファイルは `supabase/migrations/` に追加し、Supabaseダッシュボードの SQL Editor で手動実行する
