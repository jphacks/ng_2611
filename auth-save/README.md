# 白石：Googleログイン・Supabase・保存の実装指示

## 目的

Googleログイン、ゲスト選択、セッション復元、進行保存を実装する。ゲームやホームはこのモジュールの公開関数だけを呼ぶため、DOMやCanvasには触れない。

## 最終的に作るファイル

```text
src/auth/
  supabase-client.js         # createClientを1回だけ実行
  auth.js                    # ユーザー取得・ログイン・ログアウト
src/save/
  save-repository.js         # 保存先を分岐する公開窓口
  local-save.js              # guest用localStorage
  cloud-save.js              # user用Supabaseテーブル
```

この担当フォルダでは上記の実装を作ってから、須賀と相談して `src/` へ移す。公開APIは `../shared/AUTH_CONTRACT.md` を厳守する。

## 実装詳細

### `supabase-client.js`

- `import { createClient } from '@supabase/supabase-js'` を使う。
- `import.meta.env.VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を読む。
- 値が空なら `null` を返す。アプリの起動時に例外を投げない。

### `auth.js`

- `getCurrentUser()` はセッションを取得し、ログインなら `{ type: 'user', id, email, displayName }` を返す。選択前は `null`。
- `signInAsGuest()` は `{ type: 'guest', id: 'guest' }` を返す。ゲスト選択は `sessionStorage` に保存する。
- `signInWithGoogle()` は `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })` を呼ぶ。
- `signOut()` はSupabaseからログアウトし、ゲスト状態も消す。
- Google OAuth後も `getCurrentUser()` が同じ形式で返すことを確認する。

### 保存

- 進行データは `{ completedStageIds: string[], currentStageId: string | null, updatedAt: string }` とする。
- ゲストはキー `shortcut-dungeon:guest-save:v1` でlocalStorageにJSON保存する。
- ログインユーザーは `saves` テーブルの `user_id`（auth.users.id）を一意キーとしてupsertする。
- 通信失敗時はゲームを停止しない。呼び出し側が表示できる `Error` を返す。

## Supabase側の準備メモ

1. Google Providerを有効化し、リダイレクトURLに開発URLと公開URLを登録する。
2. `saves` テーブルを作る：`user_id uuid primary key references auth.users(id)`、`data jsonb not null`、`updated_at timestamptz default now()`。
3. Row Level Securityを有効にし、`auth.uid() = user_id` の行だけSELECT/INSERT/UPDATEできるポリシーを作る。

## 完了条件

- Supabase設定がない状態でもゲスト選択とローカル保存が動く。
- 設定済みならGoogleログイン、再読み込み後のセッション復元、ログアウトが動く。
- ゲーム側はSupabase SDKをimportせず保存できる。
