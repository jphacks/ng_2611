# 白石：Supabase Googleログイン・セーブ

最終更新: 2026-10-24  
関連: `../AGENTS.md`、`../shared/AUTH_CONTRACT.md`、`../docs/WORK_BREAKDOWN.md`、`../home-integration/README.md`

## ゴール

- Supabase未設定でもゲストプレイが壊れない。
- 設定済みなら Google ログインでき、ログインユーザーの進捗を `saves` テーブルへ保存・復元できる。
- ゲスト進捗を初回ログイン時にクラウドへ引き継げる。
- ゲーム本体は Supabase SDK を直接 import しない。`src/auth/` と `src/data/save/` の公開APIだけを使う。

> このフォルダは作業メモ用。実装は最初から最終パス（`src/auth/`、`src/data/save/`）に置く。

## 最初に読む

1. `shared/AUTH_CONTRACT.md`
2. `docs/WORK_BREAKDOWN.md` の §3.2（凍結インターフェース）
3. `home-integration/README.md`（ホームが期待する状態）
4. 既存プロジェクトの `src/main.js`、`src/ui/home-ui.js`（接続イメージ）

## 作るファイル

```text
src/auth/
  supabase-client.js       # createClient、設定判定、シングルトン
  auth.js                  # ゲスト/Google/セッション/ログアウト/状態購読
src/data/save/
  progress.js              # Progressの生成・正規化・マージ
  local-save.js            # ゲスト用localStorage
  cloud-save.js            # Supabase savesテーブル
  save-repository.js       # 保存先の共通窓口
supabase/
  schema.sql               # テーブル、RLS、updated_atトリガー
docs/
  SUPABASE_SETUP.md        # プロジェクト作成からログイン確認まで
tests/
  progress.test.js         # 正規化・マージの単体テスト
```

## 公開API（変更禁止）

```js
// src/auth/auth.js
export function isAuthConfigured(): boolean
export async function getCurrentUser(): Promise<null | GuestUser | SignedInUser>
export async function signInAsGuest(): Promise<GuestUser>
export async function signInWithGoogle(): Promise<void>
export async function signOut(): Promise<void>
export function onAuthStateChange(callback: (user) => void): () => void

// src/data/save/save-repository.js
export function createEmptyProgress(): Progress
export function normalizeProgress(value): Progress
export function mergeProgress(base, incoming): Progress
export async function loadSave(user): Promise<Progress>
export async function saveProgress(user, progress): Promise<Progress>
export async function claimGuestSave(user): Promise<Progress>
```

```js
// ユーザー
{ type: 'guest', id: 'guest' }
{ type: 'user', id: 'uuid', email: 'user@example.com', displayName: '名前' }

// Progress
{
  completedStageIds: ['crate-intro'],
  currentStageId: 'copy-gate-maze',
  bossCleared: false,
  updatedAt: '2026-10-24T12:00:00.000Z'
}
```

- `loadSave()` は保存なしでも空の `Progress` を返す。`null` を返さない。
- `saveProgress()` は保存後の正規化済み `Progress` を返す。
- `normalizeProgress()` は不明フィールドを落とし、`completedStageIds` の重複を除き、型を矯正する。
- `mergeProgress(base, incoming)` は `completedStageIds` の union、`bossCleared` の OR、`currentStageId` は incoming が非 null なら incoming、`updatedAt` は現在時刻を返す。
- 通信失敗は `SaveError`（`code`、`cause` を持つ）として投げる。UIはゲスト続行を選べる。

## タスク

### Must（Day 1 中）

- [ ] **A1. SupabaseプロジェクトとGoogle OAuth**
  - Supabaseでプロジェクト作成。
  - Google Cloud Consoleで OAuth クライアント（Web application）作成。
  - 承認済みリダイレクトURI: `https://<project-ref>.supabase.co/auth/v1/callback`。
  - Supabase → Authentication → Providers → Google を有効化。
  - Supabase → Authentication → URL Configuration:
    - Site URL: `http://localhost:5173`
    - Redirect URLs: `http://localhost:5173/**`、本番URL、必要ならLAN IP。
  - `.env.local` に `VITE_SUPABASE_URL` と `VITE_SUPABASE_ANON_KEY` を置く。`.env.local` はコミットしない。
  - 完了: `signInWithGoogle()` を呼ぶとGoogleの同意画面へ遷移する。

- [ ] **A2. テーブルとRLS**
  - `supabase/schema.sql` を作成し、Supabase SQL Editorで実行。
  - 最低限の形:

```sql
create table if not exists public.saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

create policy "saves_select_own"
  on public.saves for select
  using (auth.uid() = user_id);

create policy "saves_insert_own"
  on public.saves for insert
  with check (auth.uid() = user_id);

create policy "saves_update_own"
  on public.saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.touch_saves_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists saves_touch_updated_at on public.saves;
create trigger saves_touch_updated_at
  before update on public.saves
  for each row execute function public.touch_saves_updated_at();
```

  - 完了: 別アカウントで他ユーザーの行をselectできない。

- [ ] **A3. Supabaseクライアント**
  - `src/auth/supabase-client.js`
  - `getSupabaseClient()` は環境変数が欠けていれば `null` を返す。モジュール読み込み時に例外を投げない。
  - `isAuthConfigured()` は URL と ANON KEY の両方が非空かつ URL が `https://` で始まる時だけ true。
  - `createClient()` は1回だけ。HMRで二重生成しないようモジュールスコープで保持。
  - 完了: `.env.local` を消してもアプリが起動する。

- [ ] **A4. 認証API**
  - `src/auth/auth.js`
  - `getCurrentUser()`:
    1. クライアントがなければ、ゲストセッションがあればゲスト、なければ `null`。
    2. `supabase.auth.getSession()` を待つ。
    3. `session.user` があれば `{ type: 'user', id, email, displayName }`。
    4. なければゲストセッション、なければ `null`。
  - `signInAsGuest()`: `localStorage` の `shortcut-dungeon:guest-session:v1` を `'1'` にしてゲストを返す。
  - `signInWithGoogle()`:
    - 未設定なら `AuthError('AUTH_NOT_CONFIGURED')`。
    - `redirectTo` は `window.location.origin + window.location.pathname`（query/hashを除く）。
    - `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })`。
    - 失敗は `AuthError('OAUTH_START_FAILED')`。
  - `signOut()`: `supabase.auth.signOut()` とゲストセッション削除。ゲスト保存データは消さない。
  - `onAuthStateChange(cb)`: `supabase.auth.onAuthStateChange` を購読し、解除関数を返す。未設定時は何もしない解除関数を返す。
  - 完了: ゲスト→ログイン→ログアウトの各状態が取れる。

- [ ] **A5. Progressとゲスト保存**
  - `src/data/save/progress.js`
    - `createEmptyProgress()` は `{ completedStageIds: [], currentStageId: null, bossCleared: false, updatedAt: null }`。
    - `normalizeProgress()` は文字列IDのみ、重複除去、`bossCleared === true` のみ true、`updatedAt` は文字列 or null。
    - `mergeProgress()` は §公開APIの通り。
  - `src/data/save/local-save.js`
    - キー: `shortcut-dungeon:guest-save:v1`
    - `loadGuestProgress()`、`saveGuestProgress(progress)`、`clearGuestProgress()`。
    - JSON破損・localStorage不可でも例外を投げず空Progressを返す。
  - `tests/progress.test.js` で正規化・union・bossClearedをテスト。
  - 完了: `npm test` が通る。

### Must（Day 2 午前）

- [ ] **A6. クラウド保存と共通窓口**
  - `src/data/save/cloud-save.js`
    - `loadCloudProgress(user)`: `saves` から `data` を取得。行なし（PGRST116）は空Progress。
    - `saveCloudProgress(user, progress)`: `user_id` をキーに upsert。`data` と `updated_at` を更新。
    - 例外は `SaveError('SAVE_FAILED', ...)` に変換。
  - `src/data/save/save-repository.js`
    - `loadSave(user)`: guest → local、user → cloud。
    - `saveProgress(user, progress)`: guest → local、user → cloud。必ず `normalizeProgress` を通す。
    - `claimGuestSave(user)`: guest保存を読み、クラウドと union して保存。成功したらゲスト保存を削除。ユーザーでなければ何もしない。
  - 完了: ログイン中に保存→再読込で同じProgress、通信失敗時に例外がUIへ伝わる。

- [ ] **A7. ゲスト進捗の引き継ぎ**
  - ログイン直後のホーム初期化で `claimGuestSave(user)` を1回呼ぶ。
  - `claimGuestSave()` はマージ後の `Progress` を返す。ゲスト保存が空ならクラウドのProgressをそのまま返す。
  - 引き継ぎの有無は、呼ぶ前後の `completedStageIds.length` を比較してUIで判断する。
  - 完了: ゲストでStage 1をクリア→ログイン→クラウドにStage 1が入る。

- [ ] **A8. 須賀との接続**
  - `home-integration/README.md` のDOM契約に合わせ、`main.js` が呼ぶ関数を提供する。
  - ログイン→ホーム表示→開始→クリア→保存→リロード→続きから、を通しで確認。
  - 未設定・OAuth失敗・通信失敗の3パターンを確認。
  - 完了: デモシナリオの認証部分が成功する。

- [ ] **A9. セキュリティ・最終確認**
  - `.env.local`、`supabase/schema.sql` に実キーがない。
  - `saves` のRLSを別アカウントで確認。
  - `src/auth/` と `src/data/save/` 以外に `@supabase/supabase-js` の import がない。
  - `docs/SUPABASE_SETUP.md` に、プロジェクト作成、Google設定、URL設定、SQL実行、環境変数、確認手順を書く。

## 実装メモ

### セッション復元の順序

```js
// 悪い例: モジュール読み込み時にcreateClientして例外
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, ...);

// 良い例: 呼ばれた時に判定
export function getSupabaseClient() {
  if (!isAuthConfigured()) return null;
  if (!client) client = createClient(url, key);
  return client;
}
```

### OAuth後のURL

- Supabaseが `?code=...` や `#access_token=...` を付けて戻す。
- `getSession()` が処理するので、独自にトークンをparseしない。
- エラー時は `error` / `error_description` が付くことがある。ホームにメッセージを出し、`history.replaceState` でURLをきれいにする。

### 保存の競合

- ゲーム側の `onProgress` はステージクリアごとに発火する。
- `main.js` は保存を直列化し、前の保存が終わる前に次が来たら最後の値だけ保存する。
- `mergeProgress` は必ず union を使う。上書きでクリア済みが消えないようにする。

### ゲストとログインの分離

- ゲスト保存とクラウド保存は別キー・別テーブル。ログアウトでゲスト保存を消さない。
- ゲストセッションだけ消す。ゲスト保存は残す。
- ログイン中にゲストへ戻る操作は「ログアウト」として扱う。

## テスト

```bash
npm test
npm run build
```

手動:

1. `.env.local` なしで起動 → Googleボタン無効、ゲスト開始できる。
2. `.env.local` ありで起動 → Googleログインできる。
3. ログイン後に名前が出る。リロードしてもログインが維持される。
4. Stage 1 クリア → リロード → 続きから。
5. ログアウト → ゲストで開始できる。
6. 別アカウントでログイン → 前のアカウントの進捗が見えない。
7. 通信を切って保存 → UIにエラーが出るが、ゲームは続行できる。

## 完了条件

- [ ] A1〜A9 が完了。
- [ ] `npm test`、`npm run build` が通る。
- [ ] ゲストプレイがSupabase未設定でも壊れない。
- [ ] Googleログイン→保存→再読込が通る。
- [ ] RLSで他ユーザーのデータが見えない。
- [ ] 秘密情報がコミットされていない。
- [ ] `MainGameScene` にSupabaseのコードが入っていない。

## 引き渡し

- 須賀へ:
  - `isAuthConfigured()` の結果でGoogleボタンを出し分ける。
  - `getCurrentUser()` の3状態でホームを描画する。
  - `loadSave()` / `saveProgress()` / `claimGuestSave()` を `main.js` から呼ぶ。
  - エラー時の文言は `SaveError.code` で分ける。
- 末田へ:
  - ゲーム側は `onProgress` を返すだけ。保存はしない。
- 触らない:
  - `src/core/`、`src/scenes/`、`src/ui/canvas-ui.js`、`index.html`、`styles/main.css`。
