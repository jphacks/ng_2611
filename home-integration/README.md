# 須賀：ホーム画面・UI/UX・統合

最終更新: 2026-10-24  
関連: `../AGENTS.md`、`../docs/WORK_BREAKDOWN.md`、`../shared/AUTH_CONTRACT.md`、`../auth-save/README.md`、`../game-player/README.md`

## ゴール

- 初回アクセスでホームが出て、ゲストまたはGoogleログインを選べる。
- ゲスト→開始→ゲーム→ホーム復帰が安定して動く。
- ログイン状態・保存状態・クリア数が一目で分かる。
- ゲームのCanvasとDOM UIの責務を分ける。ゲームロジックは `MainGameScene` に閉じる。
- 2日目の最後に、全員の成果を `src/main.js` で接続し、デモURLを出す。

> このフォルダは作業メモ用。実装は最初から最終パス（`index.html`、`styles/main.css`、`src/main.js`、`src/ui/`）に置く。
> CSSの最終パスは既存に合わせて `styles/main.css`。`src/styles/` は使わない。

## 実装状況（2026-10-24 / `yuusi` ブランチ）

ホーム画面のデザインと状態遷移を実装済み。PC風サイバー（ターミナルウィンドウ + グリッド + スキャンライン + ネオン）で構成する。

| ファイル | 状態 |
|---|---|
| `index.html` | 契約IDをすべて配置。ホーム / ゲーム / ヘルプの3ブロック |
| `styles/main.css` | ターミナルUI、レスポンシブ（980 / 720 / 400px）、reduced motion、focus-visible |
| `src/ui/home-ui.js` | `setupHome()` を実装（`render` / `setBusy` / `setLoading` / `setMessage` / `focusPrimary` / `openHelp`） |
| `src/ui/game-ui.js` | `setupGameUi()` を実装（`show` / `hide` / `setUser` / `setSaveStatus` / `setStageLabel`） |
| `src/main.js` | `boot`、開始・終了、進捗の直列保存。担当モジュール未接続でも落ちない |

- `src/auth`、`src/data/save`、`src/scenes`、`src/core`、`src/data/stages/*.json` は `import.meta.glob` で**存在する時だけ**読み込む。担当モジュールが入れば自動で接続される。
- 認証モジュールが無い間は、ゲスト選択をメモリ上の仮セッションで扱う（`src/main.js` のコメント参照）。`src/auth` 接続後は `signInAsGuest()` が優先される。
- ゲームモジュールが無い間は GAME START でメッセージだけ出し、画面は切り替えない。
- 保存は `onProgress` を受けて直列化。`src/data/save` 未接続時は `SAVE STATUS` に `LOCAL ONLY` を出す。
- 契約外の追加ID: `#stage-progress`、`#boss-badge`、`#sys-log`、`#game-stage-label`。須賀が所有し、他担当は触らない。

### ローカル確認

```bash
npm run dev
```

- 1440 / 900 / 420px で表示確認済み。
- ゲスト選択 → GAME START 有効化 → ヘルプダイアログ開閉（Escapeで閉じ、フォーカス復帰）を確認済み。
- `npm run build`、`npm test` が通る。

## 最初に読む

1. `docs/WORK_BREAKDOWN.md` の §3（凍結インターフェース）
2. `shared/AUTH_CONTRACT.md`
3. 既存プロジェクトの `index.html`、`styles/main.css`、`src/main.js`、`src/ui/home-ui.js`
4. `home-integration/README.md`（このファイル）

## 最終配置

```text
index.html
styles/main.css
src/main.js
src/ui/home-ui.js
src/ui/game-ui.js
package.json
vite.config.js
README.md
```

`src/ui/canvas-ui.js` は末田の担当。`home-ui.js` / `game-ui.js` は須賀の担当。名前が似ているので混同しない。

## 画面と状態

```text
boot
  └─ loading（セッション確認）
       ├─ signedOut（Google / ゲスト）
       ├─ guest（ゲストで開始 / Googleでセーブ）
       └─ user（名前 / ログアウト / 続きから）
              │
              └─ home
                   ├─ start（はじめから）
                   ├─ resume（続きから）
                   └─ game
                        ├─ progress（クリア→保存）
                        ├─ gameOver（R/Enterでリトライ）
                        └─ back（ホームへ）
```

- 画面は `#home-screen` と `#game-screen` の2枚。`hidden` 属性で切り替える。
- ルーターは作らない。URLは増やさない。
- ゲームのステージ名・HP・エナジーはCanvas HUDが描く。DOMには重複して出さない。
- DOMに出すのは「戻る」「保存状態」「ログインユーザー」「操作説明」。

## DOM契約

`index.html` に必ず置く。白石・末田はこのIDを変更しない。

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

- `#auth-loading` は起動中のオーバーレイ。`hidden` で消す。
- `#google-login-button` は `isAuthConfigured()` が false の時 `disabled` + `#google-note` に理由。
- `#resume-game-button` は `progress.currentStageId` がある時だけ表示。
- `#save-status` は `保存中…` / `保存済み HH:mm` / `保存できません` を出す。`aria-live="polite"`。
- `#home-message` はエラー・引き継ぎ完了などの通知。`role="status"`。
- ヘルプは `<dialog>`。Escapeで閉じる。フォーカスを元に戻す。

## UIモジュール契約

`home-ui.js` と `game-ui.js` はDOMだけを扱う。認証・保存を直接importしない。

```js
// src/ui/home-ui.js
export function setupHome({
  onGuest,
  onGoogle,
  onStart,
  onResume,
  onSignOut,
}) {
  // ...
  return {
    show(),
    hide(),
    render({ user, progress, authConfigured, loading, saving, error }),
    setBusy(busy),
    setMessage(text, tone = 'info'),
    focusPrimary(),
  };
}
```

```js
// src/ui/game-ui.js
export function setupGameUi({ onBack, onHelp }) {
  return {
    show({ user }),
    hide(),
    setSaveStatus({ state, at, message }),
    setUser(user),
  };
}
```

- `render()` は毎回DOMを作り直さず、既存要素のtextContent/disabled/hiddenを更新する。
- ボタンの二重クリックは `setBusy(true)` で防ぐ。
- `onGoogle` は `main.js` が白石の `signInWithGoogle()` を呼ぶ。`home-ui.js` からSupabaseを触らない。

## タスク

### Must（Day 1）

- [ ] **H1. 既存画面の移植**
  - 既存 `index.html` のホームとゲーム画面をベースにする。
  - `styles/main.css` を移植。
  - ルート `package.json` に schema 依存、`validate:stages`、build前検証を追加。
  - `setupHome({ onStart })` の既存挙動を壊さない。
  - `src/main.js` の `startGame()`、`visibilitychange`、`pagehide` を移植。
  - 完了: ホーム→ゲスト→開始→Canvas表示。

- [ ] **H2. 状態機械とDOM契約**
  - `boot()` で `getCurrentUser()` を待ち、loadingを解除。
  - `authConfigured` でGoogleボタンを出し分ける。
  - `user.type` でゲスト/ログイン表示を切り替える。
  - `progress` からクリア数と「続きから」を出す。
  - `saving` / `error` を `#save-status` と `#home-message` に出す。
  - 完了: 4状態（signedOut / guest / user / loading）が目視で区別できる。

- [ ] **H3. ゲスト開始と後片付け**
  - `startGame({ resume })` は `scene` が既にあれば何もしない。
  - 開始時に `home.hide`、`game.show`、Canvasにフォーカス。
  - 戻る時は `gameLoop.stop()` → `scene.dispose()` → `scene = null` → ホーム表示。
  - `pagehide` でも同じ後片付け。
  - 完了: ゲスト→ゲーム→戻る→再開始を3回繰り返しても入力が二重にならない。

### Must（Day 2）

- [ ] **H4. GoogleログインUI**
  - `onGoogle` → `signInWithGoogle()`。
  - OAuthリダイレクト後、`boot()` でユーザーを検出してホームに表示。
  - 失敗時は `#home-message` に「ログインできませんでした。ゲストで遊べます」。
  - 未設定時はGoogleボタン無効＋`#google-note` に「現在利用できません」。
  - `signOut()` 後はホームに戻り、ゲストを選べる。
  - 完了: 成功・失敗・未設定の3系統が動く。

- [ ] **H5. 保存・続きから**
  - `startGame({ resume: true })` は `initialProgress` に現在のProgressを渡す。
  - `startGame({ resume: false })` は空ProgressでStage 1から。ただし保存時は既存Progressと `mergeProgress` でunionする。
  - `onProgress` を受けたら、`main.js` 内で保存を直列化する。
    - 保存中に次のイベントが来たら、最後の1件だけ保存する。
    - 成功: `保存済み HH:mm`。
    - 失敗: `保存できません（通信）`。ゲームは続行。
  - ログインユーザーは起動時に `claimGuestSave(user)` を1回呼ぶ。
  - 完了: クリア→保存→リロード→「続きから」で次のステージから始まる。

- [ ] **H7. 結合・ビルド・デプロイ**
  - `npm install`、`npm run validate:stages`、`npm test`、`npm run build`。
  - `cd editor && npm run build`。
  - ゲームとエディタを別プロジェクトで公開する場合の設定をREADMEに書く。
  - 完了: デモURL、またはローカルで全機能が動く。

- [ ] **H8. デモリハーサル**
  - `docs/WORK_BREAKDOWN.md` §1のシナリオを2回。
  - デモ用保存データでStage 5から再開できる。
  - 完了: 5分以内に通しが見える。

### Should

- [ ] **H6. UI/UX仕上げ**
  - 1024px / 768px / 375px でレイアウト確認。ゲームはキーボード必須の注意を出す。
  - `:focus-visible`、`aria-live`、`aria-pressed`、`disabled` の見た目。
  - `prefers-reduced-motion` でアニメーションを減らす。
  - 保存状態・ログイン状態の色だけでなくラベルでも区別。
  - 完了: キーボードだけでホーム→開始→戻るができる。

## `main.js` の処理順

```js
let scene = null;
let gameLoop = null;
let currentUser = null;
let progress = createEmptyProgress();
let saveChain = Promise.resolve();
let pendingProgress = null;

async function boot() {
  home.setBusy(true);
  try {
    currentUser = await getCurrentUser();
    if (currentUser?.type === 'user') {
      progress = await claimGuestSave(currentUser);
    } else {
      progress = currentUser ? await loadSave(currentUser) : createEmptyProgress();
    }
    home.render({ user: currentUser, progress, authConfigured: isAuthConfigured() });
  } catch (error) {
    home.setMessage('進捗を読み込めませんでした。ゲストで遊べます。', 'error');
  } finally {
    home.setBusy(false);
  }
}

async function startGame({ resume = false } = {}) {
  if (scene) return;
  home.setBusy(true);
  try {
    const initialProgress = resume ? progress : createEmptyProgress();
    scene = new MainGameScene(canvas, {
      initialProgress,
      onProgress: handleProgress,
      onGameOver: ({ reason }) => console.info('[gameover]', reason),
    });
    gameLoop = new GameLoop({ update: (dt) => scene.update(dt), render: () => scene.render() });
    home.hide();
    gameUi.show({ user: currentUser });
    canvas.focus({ preventScroll: true });
    scene.render();
    gameLoop.start();
  } catch (error) {
    gameLoop?.stop();
    gameLoop = null;
    scene?.dispose();
    scene = null;
    gameUi.hide();
    home.show();
    home.setMessage('ゲームを開始できませんでした。もう一度お試しください。', 'error');
    console.error(error);
  } finally {
    home.setBusy(false);
  }
}

function handleProgress(next) {
  progress = mergeProgress(progress, next);
  pendingProgress = progress;
  saveChain = saveChain
    .catch(() => {})
    .then(async () => {
      const toSave = pendingProgress;
      pendingProgress = null;
      gameUi.setSaveStatus({ state: 'saving' });
      try {
        progress = await saveProgress(currentUser, toSave);
        gameUi.setSaveStatus({ state: 'saved', at: new Date() });
      } catch {
        gameUi.setSaveStatus({ state: 'error', message: '保存できません（通信）' });
      }
    });
}
```

- `currentUser` が `null` の時は開始しない。ゲストは `signInAsGuest()` で必ずユーザーを作る。
- `startGame` の二重実行は `scene` と `home.setBusy` の両方で防ぐ。
- 保存は `saveProgress` の中で `updatedAt` を付ける。`main.js` で時刻を作らない。
- `beforeunload` / `pagehide` では `scene.dispose()` と `gameLoop.stop()` を呼ぶ。保存はベストエフォート。

## ホーム画面の表示要素

### 未ログイン（signedOut）

- タイトル、リード文。
- 「Googleでログイン」（設定済みなら有効）。
- 「ゲストでプレイ」。
- 「ゲーム開始」は選択後に有効。
- 進捗カードは出さない、または空状態。

### ゲスト

- 「ゲスト」バッジ。
- 「クリア 2 / 5」。
- 「続きから STAGE 03」。
- 「Googleでログインすると進捗を保存できます」。
- 「ゲーム開始」。
- 「ログアウト」は出さない（ゲスト解除は不要）。

### ログイン

- 表示名（`displayName || email`）。
- 「クラウド保存」バッジ。
- 「クリア 2 / 5」、ボスクリア済みなら「BOSS CLEAR」。
- 「続きから STAGE 03」。
- 「ログアウト」。

### ゲーム中

- Canvas。
- 左上または上部に「← ホーム」ボタン。
- 右上に「保存済み / 保存中 / 保存できません」。
- 下部にキー操作の凡例（移動、Ctrl+C/X/V/Z、R/Enter）。
- ヘルプボタン。

## CSS / UIの注意

- 既存のダークテーマ、`#70e1c1`、`#f3c969`、`#ff5e68` を踏襲する。
- 画面ごとにCSSを増やしすぎない。`styles/main.css` 1枚で管理する。
- Canvasは `width: 100%; height: auto;` で縦横比を保つ。960×640。
- ボタンは最低44pxのタップ領域。ただしゲームはキーボード前提。
- `[hidden] { display: none !important; }` を維持。
- 追加するUIも `hidden` 属性で出し分け、`display:none` をJSで直接触らない。
- `prefers-reduced-motion: reduce` では transform / transition を止める。

## テスト

```bash
npm run validate:stages
npm test
npm run build
```

手動:

1. `.env.local` なし: ホーム表示、Google無効、ゲスト開始可。
2. `.env.local` あり: Googleログイン、戻り後に名前表示。
3. ゲストでStage 1クリア→ホーム→クリア数が増える。
4. リロード→「続きから」でStage 2。
5. ログアウト→ゲストで開始可。
6. ホーム→ゲーム→戻るを3回。入力が二重にならない。
7. 768px幅でCanvasがはみ出さない。
8. Tabキーで主要ボタンにフォーカスできる。

## 完了条件

- [ ] H1〜H5、H7、H8 が完了。
- [ ] ゲストでホーム→ゲーム→ホームが安定。
- [ ] Googleログインの成功・失敗・未設定が動く。
- [ ] 保存・続きからが動く。
- [ ] `npm run build` が通る。
- [ ] `scene.dispose()` が必ず呼ばれる。
- [ ] 画面終了後にキー入力が残らない。
- [ ] デモシナリオが5分で通る。

## 触らない

- `src/core/`、`src/scenes/`、`src/ui/canvas-ui.js`（末田）。
- `src/data/stages/*.json`、`packages/stage-schema/`、`editor/`（白鳥）。
- `src/auth/`、`src/data/save/`（白石）。
- `shared/`（変更は全員に相談）。

## デモ前の最終チェック

- [ ] `.env.local` がコミットされていない。
- [ ] `npm run build` の出力に editor が含まれていない。
- [ ] ゲームとエディタのURLを間違えていない。
- [ ] デモ用保存データを入れた状態と空の状態の両方を確認。
- [ ] ログイン済みアカウントとゲストの両方でリハーサル。
