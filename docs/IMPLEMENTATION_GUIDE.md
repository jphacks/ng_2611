# 実装方針・ファイル構成

## 技術選定

- **Vite + Vanilla JavaScript**：画面は軽量なSPAとして作る。Reactなどは導入しない。
- **Canvas 2D**：迷路とマスの描画。DOMはホーム、説明、ボタンに使う。
- **Supabase JS**：Google OAuth、セッション、ログインユーザーのセーブデータ。
- **Zod**：ステージJSONを読み込む時の形式検証。壊れたステージをゲームへ渡さない。

## 目標の構成

```text
src/
  main.js                 # アプリの起動、画面遷移の接続
  auth/                   # Supabaseと認証状態（白石）
  save/                   # ローカル・クラウド保存（白石）
  game/
    InputHandler.js        # 入力→アクション変換（末田）
    GameState.js           # ルールと状態更新（末田）
    StageLoader.js         # JSON読込とZod検証（白鳥・末田）
    GameScene.js           # Canvas描画とゲーム進行（末田）
    tiles/                 # マスごとの描画・効果（末田）
  ui/
    HomeView.js            # ホーム画面（須賀）
    GameView.js            # Canvasの配置・HUD（須賀・末田）
  styles/                  # home.css / game.css / common.css
stages/                    # 完成したプレイ用JSON
```

担当フォルダで作ったコードは、統合時にこの構成へ移動する。統合責任者以外は `src/main.js` と共通CSSの変更を避ける。

## 画面遷移

1. `main.js` が認証状態を復元する。
2. `HomeView` がログインまたはゲスト選択を表示する。
3. 「ゲーム開始」で選択済みユーザーとステージIDを `GameScene.start()` に渡す。
4. クリア時に進行状況を `saveProgress(user, progress)` に渡す。
5. ホームへ戻ったらゲームのイベントリスナーとループを破棄する。

## 最小API

```js
// game/GameScene.js
start({ canvas, stage, user })
dispose()

// game/StageLoader.js
loadStage(stageJson) // Zod検証済みステージを返す

// save/saveRepository.js
loadSave(user)
saveProgress(user, progress)
```

## 開発コマンド

```bash
npm run dev
npm run build
npm run test
```

初回のみ `cp .env.example .env.local` を実行し、白石がSupabase値を設定する。`.env.local` は共有・コミットしない。
