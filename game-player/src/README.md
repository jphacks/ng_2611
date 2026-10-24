# プレイ側ソースの作業メモ

実装の正式配置は `../../src/core/`、`../../src/scenes/`、`../../src/ui/canvas-ui.js`、`../../src/data/stages.js` です。`src/game/` は作りません。

既存プロジェクトの `MainGameScene` を移植し、状態・ギミック判定・描画を維持します。新しいGameState設計へ全面置換しません。

## 禁止事項

- `window.onkeydown` へ直接代入しない。`addEventListener` と `dispose()` を対にする。
- Canvasの描画関数にゲームルールを書かない。
- Supabase SDKをimportしない。
- ステージJSONを編集しない（白鳥の担当）。

## 最初の一歩

`src/scenes/MainGameScene.js`、`src/core/InputHandler.js`、`src/core/StageManager.js`、`src/core/GameLoop.js` を既存プロジェクトからコピーし、`npm run dev` でStage 1が表示されることを確認する。詳細は親フォルダの `README.md` を優先する。
