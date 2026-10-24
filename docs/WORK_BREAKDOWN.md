# 2日間 実装プラン（担当別・具体タスク）

最終更新: 2026-10-24  
対象: 4人 / 2日  
正とする実装: 隣の `jphacks2026_s.suex` の `src/`、`packages/`、`editor/`

> このリポジトリは作り直さない。既存実装を最終パスへ移し、足りない接続部分だけを追加する。
> 各担当の詳細は `auth-save/README.md`、`stage-editor/README.md`、`game-player/README.md`、`home-integration/README.md` を読む。

---

## 1. 2日後の完成形

### Must（必ずデモで見せる）

1. 初回アクセスでホームが表示される。
2. ゲストを選び、ゲームを開始できる。
3. 既存5ステージを Stage 1 から順に遊べる。
4. 全ステージ後にボスクイズが始まり、クリアできる。
5. ステージクリア時に進捗が保存され、再読み込み後に「続きから」できる。
6. Supabase設定済みなら Google ログインでき、同じ進捗がクラウドに保存される。
7. ゲストで進めた進捗が、初回 Google ログイン時にクラウドへ引き継がれる。
8. Supabase未設定でもゲストプレイは壊れない。
9. エディタでステージを作成し、検証を通し、JSONを `src/data/stages/` に置くとゲームに追加される。
10. `npm run validate:stages`、`npm test`、`npm run build`、エディタの `npm run build` が通る。

### Should（Mustが安定したら）

- ホームに「クリア数 / 全ステージ数」とボスクリア済みバッジを表示する。
- エディタにテンプレートから新規作成する導線を付ける。
- 6ステージ目（全ギミック複合）を追加する。
- エディタをゲームとは別URLで公開する。

### Could（時間がある時だけ）

- ステージ選択画面。
- Ctrl+S をゲーム内セーブポイントとして使う新ギミック（仕様追加が必要なので原則やらない）。
- 効果音、画面遷移アニメーション。

### デモシナリオ（5分）

1. ホームで「ゲストでプレイ」→「ゲーム開始」。
2. Stage 1 で Ctrl+X → Ctrl+V を見せる。
3. デモ用保存データで Stage 5 から再開し、レーザーとマグマを見せる。
4. ボスクイズを1問正解する。
5. ホームに戻り、クリア数が増えていることを見せる。
6. Google ログイン → 表示名と保存済み進捗を見せる。
7. エディタで新ステージを1つ作り、JSONを保存してゲームに追加されることを見せる。

---

## 2. 担当とファイル所有

作業フォルダはメモ・試作のみ。**実装は最初から最終パスに置く**。二重管理を避ける。

| 担当 | 最終的に所有するファイル | 作業メモ |
|---|---|---|
| 白石 | `src/auth/**`、`src/data/save/**`、`supabase/schema.sql`、`docs/SUPABASE_SETUP.md`、`tests/progress.test.js` | `auth-save/` |
| 白鳥 | `packages/stage-schema/**`、`editor/**`、`src/data/stages/*.json`、`scripts/validate-stages.mjs`、`tests/stage-schema.test.js`、`tests/editor-model.test.js` | `stage-editor/` |
| 末田 | `src/core/**`、`src/scenes/**`、`src/ui/canvas-ui.js`、`src/data/stages.js`（ローダー）、`tests/game-*.test.js` | `game-player/` |
| 須賀 | `index.html`、`styles/main.css`、`src/main.js`、`src/ui/home-ui.js`、`src/ui/game-ui.js`、`package.json`、`vite.config.js`、`README.md` | `home-integration/` |

### 触らないルール

- 白石はゲームの `MainGameScene` を触らない。ゲームから Supabase SDK を import しない。
- 白鳥はゲーム本体の `src/core`、`src/scenes` を触らない。ステージ仕様を変える時は `packages/stage-schema`、validator、editor、ゲーム、テストを同じ変更で更新する。
- 末田は `src/main.js`、`styles/main.css`、`src/ui/home-ui.js`、ステージJSONを触らない。
- 須賀はゲームロジック（判定・描画）を触らない。統合のために他担当の公開APIを呼ぶだけにする。
- `shared/` の変更は Day 1 12:00 以降凍結。変更したい時は全員に先に共有する。

---

## 3. 開始時に凍結するインターフェース

Day 1 10:30 までにこの形を全員で確認する。以降の変更は統合担当（須賀）に申告する。

### 3.1 ステージJSON

- 唯一の正は `packages/stage-schema` と `shared/STAGE_FORMAT.md`。
- 24×16、外周固定、`schemaVersion: 1`。
- フィールド追加・変更はしない。既存フィールドだけで6ステージ目まで作る。

### 3.2 認証・保存API

```js
// src/auth/auth.js
export function isAuthConfigured(): boolean
export async function getCurrentUser(): Promise<null | GuestUser | SignedInUser>
export async function signInAsGuest(): Promise<GuestUser>
export async function signInWithGoogle(): Promise<void>
export async function signOut(): Promise<void>
export function onAuthStateChange(callback: (user) => void): () => void
```

```js
// src/data/save/save-repository.js
export function createEmptyProgress(): Progress
export function normalizeProgress(value): Progress
export function mergeProgress(base, incoming): Progress
export async function loadSave(user): Promise<Progress>
export async function saveProgress(user, progress): Promise<Progress>
export async function claimGuestSave(user): Promise<Progress>
```

```js
// Progress
{
  completedStageIds: ['crate-intro'], // クリア済みID。重複なし
  currentStageId: 'copy-gate-maze',   // 次に始めるID。ボスクリア後は null
  bossCleared: false,                  // 追加提案。既存データは false 扱い
  updatedAt: '2026-10-24T12:00:00.000Z'
}
```

- `getCurrentUser()` は `null` / ゲスト / ログインユーザーの3状態を返す。
- `loadSave()` は保存なしでも空の `Progress` を返し、`null` を返さない。
- ゲストの保存キーは `shortcut-dungeon:guest-save:v1`。
- ゲスト選択状態は `shortcut-dungeon:guest-session:v1`。
- クラウドは Supabase `saves` テーブル（`user_id` 主キー、`data jsonb`）。
- 通信失敗は `SaveError` として投げ、UIはゲスト続行を選べる。

> `bossCleared`、`isAuthConfigured`、`onAuthStateChange`、`claimGuestSave`、`mergeProgress` は既存 `shared/AUTH_CONTRACT.md` の「追加提案」に記載済み。Day 1 10:30 に全員で合意し、白石が確定する。

### 3.3 ゲームシーンAPI

既存の公開形は維持する。

```js
const scene = new MainGameScene(canvas);
const loop = new GameLoop({ update: (dt) => scene.update(dt), render: () => scene.render() });
loop.start();
// 終了時
loop.stop();
scene.dispose();
```

追加する任意オプション:

```js
const scene = new MainGameScene(canvas, {
  initialProgress: progress,
  onProgress: (next) => {
    // ステージクリア時とボスクリア時に1回ずつ呼ばれる
    // next = { completedStageIds, currentStageId, bossCleared }
  },
  onGameOver: ({ reason, stageId }) => {
    // 任意。UIのトーストやログ用。保存には使わない
  },
});
```

- `initialProgress.currentStageId` が存在すれば、そのステージから開始する。
- `onProgress` はステージクリア時に「クリアしたIDを含む配列」と「次のステージID」を返す。
- 最終ステージクリア後、ボスクリア時に `bossCleared: true`、`currentStageId: null` で1回呼ぶ。
- コールバック内の例外でゲームを止めない（`try/catch`）。
- `dispose()` は InputHandler、window keydown、Canvas click、BossQuiz のリスナーをすべて解除する。

### 3.4 DOM契約（須賀 ⇔ 白石/末田）

`index.html` に必ず置くID。担当外は変更しない。

```text
#home-screen
#auth-loading
#google-login-button
#google-note
#guest-play-button
#start-game-button
#resume-game-button
#sign-out-button
#user-badge
#progress-summary
#selection-status
#home-message
#help-button
#help-dialog
#help-close-button

#game-screen
#game-canvas
#back-home-button
#game-user-badge
#save-status
#game-help-button
```

- 画面切り替えは `hidden` 属性で行う。
- `main.js` 以外は画面の表示切り替えをしない。
- `home-ui.js` / `game-ui.js` はDOM操作だけを行い、認証・保存を直接呼ばない。コールバックで `main.js` に渡す。

### 3.5 ルート `package.json` の差分（須賀が適用）

```json
{
  "scripts": {
    "build": "npm run validate:stages && vite build",
    "validate:stages": "node scripts/validate-stages.mjs"
  },
  "dependencies": {
    "@shortcut-dungeon/stage-schema": "file:packages/stage-schema"
  }
}
```

- 白鳥が差分を用意し、Day 1 10:30 までに須賀へ渡す。
- 須賀が `npm install` し、`package-lock.json` を更新する。
- 依存追加後、`cd editor && npm install` も実行する。

---

## 4. タスク一覧

優先度: **M** = Must、**S** = Should、**C** = Could。  
見積: S = 1〜2h、M = 2〜4h、L = 4h以上。

### 4.1 白石：認証・セーブ

| ID | P | 見積 | タスク | 成果物 | 完了条件 | 依存 |
|---|---|---:|---|---|---|---|
| A1 | M | M | Supabaseプロジェクト作成、Googleプロバイダ有効化、リダイレクトURL登録 | `.env.local`、設定メモ | `localhost:5173` でGoogleログイン開始できる | - |
| A2 | M | M | `saves` テーブル、RLS、更新時刻トリガー | `supabase/schema.sql` | 別ユーザーの行を読めない | A1 |
| A3 | M | S | Supabaseクライアント初期化と設定判定 | `src/auth/supabase-client.js` | 環境変数なしでも例外を投げず `null` を返す | - |
| A4 | M | M | ゲスト/Google/セッション復元/ログアウト | `src/auth/auth.js` | 4つの公開APIが契約どおり動く | A1,A3 |
| A5 | M | M | Progress正規化、ゲストlocalStorage、単体テスト | `src/data/save/progress.js`、`local-save.js`、`tests/progress.test.js` | `npm test` が通る | - |
| A6 | M | M | クラウド保存、保存先の共通窓口、エラー型 | `cloud-save.js`、`save-repository.js` | 保存なしで空Progress、upsert成功、失敗時 `SaveError` | A2,A3 |
| A7 | M | M | ゲスト進捗のクラウド引き継ぎ | `claimGuestSave()` | 初回ログインでクリアIDがunionされる | A5,A6 |
| A8 | M | M | 須賀との接続確認、ログイン→保存→再読込 | 動作確認メモ | リロード後に続きからできる | A4,A6,H4,H5 |
| A9 | M | S | セキュリティ・デモ最終確認 | チェックリスト | 秘密情報なし、RLS確認、別アカウント検証 | A2 |

### 4.2 白鳥：ステージ作成サイト・ステージデータ

| ID | P | 見積 | タスク | 成果物 | 完了条件 | 依存 |
|---|---|---:|---|---|---|---|
| S1 | M | L | `packages/stage-schema`、`editor/`、`scripts/`、テストを移植 | 最終パスの一式 | `npm test`、`cd editor && npm run build` が通る | - |
| S2 | M | M | 既存4ステージJSONを移植・監査（3番目はS7a） | `src/data/stages/*.json` | 4ステージが動き、validateが通る | S1 |
| S3 | M | S | ルート `package.json` の依存・script差分を須賀へ渡す | 差分メモ | 須賀が適用し、ゲームからschemaをimportできる | - |
| S4 | M | M | エディタを単独で起動・ビルド・公開 | `editor/dist`、公開URL | ゲームのバンドルにeditorが含まれない | S1,S3 |
| S5 | S | M | テンプレートから新規作成 | `editor/src/state/templates.js`、ダイアログ | 3種のテンプレートが検証OK | S1 |
| S6 | S | S | 初回ガイド、保存手順、キーボード一覧 | ヘルプダイアログ、README | 初見でJSON保存までできる | S4 |
| S7a | M | M | `sample.json` を実ステージ `copy-paste-basics` へ差し替え | JSON 1本 | 手で解けてvalidateも通る | S2 |
| S7b | S | M | 6番目の複合ステージ追加 | JSON 1本 | 手で解けてvalidateも通る | S7a |
| S8 | M | M | 全ステージの import → edit → export 往復確認 | 確認結果 | 意味差分なし、ファイル名=ID | S2,S4 |
| S9 | M | S | エディタの公開手順・ステージ追加手順を文書化 | `editor/README.md`、`stage-editor/README.md` | 第三者が同じ手順で再現できる | S4 |

### 4.3 末田：ゲーム本体・ギミック

| ID | P | 見積 | タスク | 成果物 | 完了条件 | 依存 |
|---|---|---:|---|---|---|---|
| G1 | M | L | ゲームエンジン一式を移植 | `src/core/**`、`src/scenes/**`、`src/ui/canvas-ui.js`、`src/data/stages.js` | 既存5ステージが起動する | S1,S2 |
| G2 | M | L | 5ステージの回帰テスト（移動・コピー・切り取り・貼り付け・ゲート・色・レーザー・マグマ・ゴール） | テスト記録 | 全ステージを手でクリアできる | G1 |
| G3 | M | M | ライフサイクル修正（`dispose()`、再入場、二重ループ防止） | 修正差分 | ホームへ戻って再開始しても入力が二重にならない | G1,H3 |
| G4 | M | M | 進捗コールバックと途中再開 | `MainGameScene`、`StageManager` | クリア時に `onProgress` が1回、`currentStageId` から再開 | G1 |
| G5 | M | M | ボスクイズのコールバックと問題拡張 | `BossQuizScene` | 4問、クリア時 `onClear` が1回、失敗時HP減 | G4 |
| G6 | S | M | 操作メッセージとHUDの改善（Ctrl+A/S/Pの案内、レーザー遮断残り秒など） | 修正差分 | 既存挙動を壊さず案内が具体的 | G2 |
| G7 | C | L | 新ギミック（原則やらない。やるなら仕様追加を先に合意） | 仕様＋実装＋editor＋test | 全担当の合意がある | G4,S1 |
| G8 | M | M | 最終回帰・性能・クリーンアップ | テスト記録 | 5ステージ＋ボス、60fps、console errorなし | 全部 |

### 4.4 須賀：ホーム・UI/UX・統合

| ID | P | 見積 | タスク | 成果物 | 完了条件 | 依存 |
|---|---|---:|---|---|---|---|
| H1 | M | M | 既存 `index.html`、`styles/main.css`、`home-ui.js`、`main.js` を移植 | 2画面の骨格 | ホームとゲーム画面が表示される | - |
| H2 | M | M | 画面状態機械（loading / signedOut / guest / user / saving / error） | `main.js`、`home-ui.js`、`game-ui.js` | 各状態がDOMに出る | H1,A4 |
| H3 | M | M | ゲスト開始、二重開始防止、ホーム復帰、後片付け | `main.js` | ゲスト→ゲーム→戻る→再開始が動く | H1,G1 |
| H4 | M | M | Googleログイン、ログアウト、未設定時の無効化 | ホームUI | ログイン成功/失敗/未設定の3系統が動く | A4,H2 |
| H5 | M | M | 保存・続きから・保存ステータス表示 | `main.js` | クリア→保存→リロード→続きから | G4,A6,H2 |
| H6 | S | M | レスポンシブ、フォーカス、aria-live、reduced motion | CSS/HTML | 1024px/768pxで崩れない、キーボードで操作可能 | H2 |
| H7 | M | M | 結合、ビルド、デプロイ、README更新 | デモURL | 4コマンドが通り、URLで動く | 全部 |
| H8 | M | S | デモリハーサル2回、進行データ固定 | デモ手順 | 5分で通しが見える | H7 |

---

## 5. スケジュール（開始を10:00とした例）

### Day 1

| 時刻 | 全員 | 白石 | 白鳥 | 末田 | 須賀 |
|---|---|---|---|---|---|
| 10:00-10:30 | キックオフ、§3の契約確認、ブランチ作成 | A1 | S3差分を用意 | 移植対象の確認 | H1開始、package差分適用 |
| 10:30-12:00 | 並行実装 | A1-A3 | S1,S2 | G1 | H1,H2 |
| 12:00-13:00 | **CP1** 昼 | A4 | S1続き | G1続き | ホーム→Canvas表示 |
| 13:00-15:30 | 並行実装 | A4,A5 | S2,S4 | G2,G3 | H2,H3 |
| 15:30-16:00 | **CP2** | ゲストAPI | エディタ起動 | Stage1動作 | ゲスト開始 |
| 16:00-19:00 | 並行実装 | A6 | S5 | G4 | H3,H4 |
| 19:00-20:00 | **CP3** 夕食 | 保存API | エディタbuild | 進捗コールバック | ログインUI |
| 20:00-22:00 | 並行実装 | A7 | S6 | G5 | H5 draft |
| 22:00 | 終了 | コミット・課題共有 | コミット・課題共有 | コミット・課題共有 | コミット・課題共有 |

### Day 2

| 時刻 | 全員 | 白石 | 白鳥 | 末田 | 須賀 |
|---|---|---|---|---|---|
| 9:30-10:00 | スタンドアップ、**CP4** | A8準備 | S7a準備 | G6準備 | 前日の不具合共有 |
| 10:00-12:00 | 結合 | A8 | S7a,S7b | G5,G6 | H5 |
| 12:00-13:00 | **CP5** 昼 | ログイン確認 | 6面validate | 通し確認 | 保存・再開確認 |
| 13:00-15:00 | バグ修正 | A9 | S8 | G6,G8 | H6 |
| 15:00-16:30 | **CP6** ビルド・デプロイ | 最終確認 | エディタ公開 | 最終回帰 | H7 |
| 16:30-17:30 | デモリハーサル | ログイン担当 | エディタ担当 | ゲーム担当 | 全体進行 |
| 17:30 | **コードフリーズ** | - | - | - | - |

---

## 6. 統合チェックポイント

### CP1 Day 1 12:00「画面が出る」

- `npm run dev` でホームが表示される。
- ゲスト→開始→Canvasが見える。
- console に赤いエラーがない。

### CP2 Day 1 16:00「1ステージ動く」

- Stage 1 で移動、Ctrl+X、Ctrl+V、ゴールが動く。
- エディタが `cd editor && npm run dev -- --port 5174` で起動する。
- ゲストAPI `signInAsGuest()` が返る。

### CP3 Day 1 20:00「データがつながる」

- 全5ステージがロードされる。
- ステージクリア時に `onProgress` が呼ばれる（consoleで確認）。
- `cd editor && npm run build` が通る。

### CP4 Day 2 10:00「ログインが通る」

- `localhost:5173` で Google ログインできる。
- リダイレクト後にログインユーザー名が出る。
- Supabase未設定の別環境でもゲストが動く。

### CP5 Day 2 12:00「通しで遊べる」

- ゲストで全5ステージ＋ボスをクリアできる。
- クリア後に保存され、リロードで「続きから」できる。
- エディタで新規ステージを作り、validateが通る。

### CP6 Day 2 15:00「出せる状態」

```bash
npm run validate:stages
npm test
npm run build
cd editor && npm run build
```

- すべて成功。
- console error なし。
- ホームへ戻った後にキー入力が残らない。
- `.env.local` がGitに入っていない（`.gitignore` 済み）。

### CP7 Day 2 16:30「デモが通る」

- §1のデモシナリオを2回連続で成功。
- デモ用保存データを固定し、Stage 5 から再開できる。

---

## 7. マージ順序と競合回避

1. 須賀がルート `package.json` に schema 依存、`validate:stages`、build前検証を追加。
2. 白鳥が `packages/stage-schema`、`scripts/validate-stages.mjs`、`src/data/stages/*.json` を入れる。
3. 末田が `src/core`、`src/scenes`、`src/ui/canvas-ui.js`、`src/data/stages.js` を入れる。
4. 白石が `src/auth`、`src/data/save` を入れる。
5. 須賀が `index.html`、`styles/main.css`、`src/main.js`、`src/ui/*` を入れる。
6. 白鳥が `editor/` を入れる（ゲームのバンドルとは独立）。
7. 統合後、須賀が `npm install`、`npm test`、`npm run build` を実行。

- 1コミット1目的。コミットメッセージに担当と内容を日本語で書く。
- 他担当のファイルを直す必要が出たら、直接編集せずに差分を共有する。
- `src/data/stages/*.json` は白鳥のみ。ゲーム側で都合が悪い時は白鳥に依頼する。
- `src/ui/home-ui.js` は須賀、`src/ui/canvas-ui.js` は末田。名前が似ているので注意する。

---

## 8. 完了定義（Definition of Done）

### 自動チェック

```bash
npm install
npm run validate:stages
npm test
npm run build
cd editor
npm install
npm run build
```

### 手動チェック

- [ ] Supabase未設定で、Googleボタンが無効＋理由が出る。ゲストは開始できる。
- [ ] ゲストで Stage 1〜5＋ボスをクリアできる。
- [ ] クリア後にリロードし、「続きから」で次のステージから始まる。
- [ ] Googleログイン後、表示名が出て、同じ進捗が復元される。
- [ ] 別Googleアカウントでログインしても、他ユーザーの進捗が見えない。
- [ ] ログアウト後、ゲストで遊べる。
- [ ] ホームへ戻って再開始しても、キー入力が二重にならない。
- [ ] エディタで新規作成→検証→JSON保存→`src/data/stages/` に配置→ゲームに出現する。
- [ ] 全ステージで詰みがない（白鳥と末田が手で確認）。
- [ ] `.env.local`、Supabaseキー、OAuthシークレットがコミットされていない。
- [ ] console error がない。

### デモ用保存データ（ゲスト）

Stage 5 から見せたい時は、ブラウザの console で以下を実行して再読み込みする。

```js
localStorage.setItem('shortcut-dungeon:guest-save:v1', JSON.stringify({
  completedStageIds: ['crate-intro', 'copy-gate-maze', 'copy-paste-basics', 'color-switch-gate'],
  currentStageId: 'laser-magma-lab',
  bossCleared: false,
  updatedAt: new Date().toISOString(),
}));
```

> Stage 3 のIDは、白鳥が `sample` を差し替えた後のIDに合わせる。

---

## 9. リスクと対策

| リスク | 影響 | 担当 | 対策 |
|---|---|---|---|
| OAuthのリダイレクトURL不一致 | ログインできない | 白石 | localhostと本番URLを両方登録。シークレットウィンドウで確認 |
| RLS設定ミス | 他ユーザーの進捗が見える | 白石 | 2アカウントでselect/upsertを確認 |
| Supabase未設定 | ログイン不能 | 白石/須賀 | Google無効＋ゲスト継続を必ず実装 |
| schema依存の追加忘れ | ゲームがビルドできない | 須賀 | Day 1 10:30に適用。最初に `npm run validate:stages` |
| ファイル所有の越境 | コンフリクト | 全員 | §2の所有表を守る。変更は依頼する |
| スコープ膨張 | 未完成 | 須賀 | Day 2 12:00以降はMust以外を凍結 |
| エディタのbaseパス | 公開後に404 | 白鳥 | `base: './'` を維持。ゲームと別プロジェクトで公開 |
| リスナーリーク | 戻った後にキーが二重に効く | 末田 | `dispose()` を毎回呼ぶ。再入場テスト |
| 保存の競合 | 進捗が巻き戻る | 白石/須賀 | 保存を直列化し、`mergeProgress` でunion |
| デモステージが解けない | デモ失敗 | 白鳥/末田 | 手で解法を確認し、ルートをメモ |

---

## 10. キックオフで決めること（Day 1 10:00-10:30）

1. `Progress.bossCleared` を追加してよいか（推奨: 追加）。
2. ゲームの `onProgress` コールバック名と引数（推奨: §3.3の形）。
3. ステージ選択画面を作るか（推奨: Mustが終わってから）。
4. デプロイ先（推奨: ゲームとエディタを別プロジェクト。Cloudflare Pages か Netlify）。
5. エディタを公開URLにするか、デモはローカル起動でもよいか。
6. 新ギミックを追加するか（推奨: 追加しない。既存5＋複合1面まで）。
7. CSSの最終パス（推奨: 既存に合わせて `styles/main.css`。`docs/TEAM_RULES.md` の表記も合わせる）。
8. 統合担当は須賀、コードフリーズは Day 2 17:30 で確定。
