# 末田：遊ぶ側ゲーム・マスデザイン

AIは既存 `src/scenes/MainGameScene.js` を中心に実装する。別のGameState設計へ全面置換しない。MainGameSceneが現在、状態・ギミック判定・描画を一体で保持しているため、二日間では安全な小さな抽出だけを行う。

## 維持する公開形

```js
const scene = new MainGameScene(canvas);
const loop = new GameLoop({ update: (dt) => scene.update(dt), render: () => scene.render() });
loop.start();
// 終了時
loop.stop();
scene.dispose();
```

## 実装場所

- 移動/ショートカット追加: `src/core/InputHandler.js`
- ステージの順送り: `src/core/StageManager.js`
- 木箱、危険、ゴール、UI、Canvas描画: `src/scenes/MainGameScene.js`
- ボスクイズ: `src/scenes/BossQuizScene.js`
- 汎用図形/HUD描画: `src/ui/canvas-ui.js`

## 現在の重要状態

`player` はpx座標、`getPlayerTile()` でグリッド座標に変換する。`blocks`、`items`、`colorSwitches`、`colorWalls`、`lasers`、`magma` は `loadStage(stage)` でJSONから複製し、元JSONを破壊しない。Undo/Redoには player、facing、blocks、clipboard、gate状態、色壁状態、skillEnergy を保存している。

## 完了条件

矢印/WASD、Ctrl/Cmd+C/X/V/Z/Y、R/Enterの現行挙動を維持し、既存5ステージすべてで動く。ゲーム終了時に `dispose()` がInputHandler、click listener、BossQuizSceneを解除する。
