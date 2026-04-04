# Yori（より）プロジェクト

障害のある子どもを育てる親向けのAIコンパニオンアプリ。日々の気持ちや出来事を話せる場所を提供する。

## 技術スタック

- **フレームワーク**: Next.js 15 (App Router) + TypeScript
- **認証・DB**: Supabase（Google OAuthログイン、RLS有効）
- **AI**: Anthropic Claude API（claude-haiku-4-5-20251001）+ Tavily Web Search
- **スタイル**: Tailwind CSS（カスタムカラーパレット）
- **デプロイ**: Vercel（本番: https://yori-web-ruby.vercel.app）

## ディレクトリ構成

```
src/
  app/
    page.tsx              # ログインページ（Googleログインボタン）
    onboarding/page.tsx   # 初回オンボーディング（パパ/ママ・子ども情報入力）
    home/page.tsx         # ホーム（最近の記録一覧、チャットへの導線、週次サマリーカード）
    home/WeeklySummaryCard.tsx  # 週次サマリーカード（日曜日のみ表示・クライアント）
    chat/page.tsx         # チャットUI（ストリーミング対応、セッション管理）
    logs/page.tsx         # 記録一覧（カレンダー＋リスト形式）
    logs/LogsCalendar.tsx # カレンダーUIコンポーネント（クライアント）
    logs/[id]/page.tsx    # 記録詳細（チャット履歴も表示）
    account/page.tsx      # アカウント（プロフィール編集・ログアウト・退会）
    privacy/page.tsx      # プライバシーポリシー
    terms/page.tsx        # 利用規約
    auth/callback/        # Supabase OAuth コールバック
    api/
      chat/route.ts           # Claude SSEストリーミング、メッセージDB保存、プロフィール注入
      extract-log/route.ts    # 会話からログ抽出（events/feelings/achievements/tags/summary/mood_score）
      weekly-summary/route.ts # 週次サマリー生成（オンデマンド＋キャッシュ）
      cron/close-sessions/    # 日付をまたいだ未終了セッションを自動クローズ（Vercel Cron）
      delete-account/         # アカウント削除（service roleで全データ削除）
  lib/
    supabase/
      server.ts             # サーバーサイドSupabaseクライアント
      client.ts             # クライアントサイドSupabaseクライアント
    extract-log.ts          # ログ抽出ロジック（Anthropic SDK、chat/cronで共用）
    generate-weekly-summary.ts  # 週次サマリー生成ロジック（Anthropic SDK）
  middleware.ts           # Supabaseセッション更新
supabase/
  schema.sql              # テーブル定義の参照用
  migrations/             # スキーマ変更履歴（Supabaseダッシュボードで手動実行）
    001_chat_sessions_ended_at.sql
    002_daily_logs_achievements.sql
    003_profiles_parent_type_and_children.sql
    004_daily_logs_per_session.sql
    005_daily_logs_mood_score.sql
    006_weekly_summaries.sql
vercel.json               # Vercel Cron設定（0 15 * * * = 00:00 JST）
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
- `daily_logs` - セッションごとの記録（`session_id` でユニーク）
  - `session_id`: 1セッション = 1レコード（同日複数可）
  - `events`, `feelings`, `achievements`（成長・できたこと）, `tags`
  - `mood_score`: 会話全体の感情スコア（-2〜+2の整数。extract-logで自動付与）
- `weekly_summaries` - 週次サマリーキャッシュ（`user_id + week_start` でユニーク）
  - `week_start`: その週の月曜日（date型）
  - `content`: サマリー内容（jsonb。mood_chart・emotion_summary・notable_events・achievements・insight・encouragement）

## セッション管理のしくみ

- チャット開始時: `ended_at IS NULL` の当日セッションを取得、なければ新規作成
- 「今日の話を終える」: extract-log → `ended_at` を更新 → ねぎらいメッセージ表示
- 「また話す」: 新しいセッションを作成して画面リセット（同日複数セッション可）
- 記録詳細（`/logs/[id]`）からそのセッションのチャット履歴を参照できる
- **自動クローズ（Vercel Cron）**: 毎日0時JST（UTC 15:00）に前日以前の未終了セッションを自動処理。ユーザーが一度も話していないセッションはログ保存せずに終了マークのみ付与

## 週次サマリーのしくみ

- 日曜日にホームを開くと `WeeklySummaryCard` が表示される
- `/api/weekly-summary` を呼び出し、`weekly_summaries` にキャッシュがあれば即返す
- キャッシュがなければ当週（月〜日）の `daily_logs` を取得し、Claudeでサマリーを生成・保存
- サマリーの内容:
  - `mood_chart`: 月〜日のmood_scoreドット（赤系=つらい / グレー=ふつう / 青系=よかった）
  - `emotion_summary`: 週全体の感情傾向（変化の流れも含む）
  - `notable_events`: 印象的だった出来事（2〜3件）
  - `achievements`: 子どもの成長・できたこと（2〜3件）
  - `insight`: 週のパターン・傾向（1つだけ）
  - `encouragement`: ねぎらい
- ログが2件以下の週は `emotion_summary` と `encouragement` のみ出力

## Yoriのシステムプロンプト構成

チャットAPI（`api/chat/route.ts`）で毎回プロフィールと子ども情報を取得し、システムプロンプトに注入する。

```
SYSTEM_PROMPT（固定 + モード設計）
+ ニックネーム指示（ニックネームがある場合のみ）
+
【話している相手の情報】
- お母さん / お父さん
- お子さん: れお（3歳・男の子・次男・次女）、たろう（7歳・男の子・長男・長女）
```

- 子どもは誕生日昇順（年齢の高い順）で並ぶ。生まれ順（長男・次男など）も付与される
- ニックネームが設定されている場合、「長男・次男・長女・次女」と言われたらニックネームで呼ぶよう指示

**応答モード（会話から自動判断）**

| モード | 判断の目安 | Yoriの応答 |
|--------|-----------|-----------|
| 感情放出 | 強い感情・疲れ・余裕のなさ | 共感のみ。質問・アドバイスなし |
| 内省 | 落ち着いて振り返りたそう | 共感＋出来事に軽く触れる。必要なら1問 |
| 改善 | どうすればいいか考えたそう | 共感＋軽い整理・小さな提案 |
| 喜び | 子どもの成長・嬉しい出来事 | 一緒に喜ぶ。積み重ねを認める |

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

プロフィール情報は `/account` から後から編集可能。

## アカウントページ（`/account`）

- パパ/ママの切替・子ども情報（ニックネーム・生年月日・性別）を編集できる
- 子どもの更新は全削除→再挿入方式
- ログアウトボタン
- 利用規約・プライバシーポリシー・お問い合わせへのリンク
- 退会（2ステップ確認 → service roleで全データ削除）

## 環境変数（.env.local / Vercel）

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
CRON_SECRET=
TAVILY_API_KEY=
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

## ムードスコアの配色

mood_score（-2〜+2）はカレンダーと週次サマリーで共通の色を使用:

| スコア | 意味 | 色 |
|--------|------|-----|
| -2 | とても辛い | `red-400` |
| -1 | しんどい | `red-200` |
| 0 | 普通・中立 | `yori-card`（グレー） |
| +1 | 良かった | `blue-200` |
| +2 | 嬉しい・充実 | `blue-400` |

## 開発メモ

- 日時表示はすべて `timeZone: 'Asia/Tokyo'` を指定
- 当日の日付取得は `getTodayJST()` を使う（`sv-SE` ロケールで `YYYY-MM-DD` 形式）
- `@supabase/ssr` の `CookieOptions` 型を明示的にインポートしないとTypeScriptエラーになる
- マイグレーションファイルは `supabase/migrations/` に追加し、Supabaseダッシュボードの SQL Editor で手動実行する
- Vercel Cron は `Authorization: Bearer {CRON_SECRET}` ヘッダーで認証する
- ログ抽出（`lib/extract-log.ts`）は `max_tokens: 2048`。JSONをregexで抽出 (`\{[\s\S]*\}`)
- 週次サマリー生成（`lib/generate-weekly-summary.ts`）も同様の構造。ログが2件以下の場合はフォールバック出力
- お問い合わせ先: tokumori.ottie@gmail.com
