# プレイ側ソースの作業メモ

このフォルダは試作コードの置き場。統合時の正式配置は `../../src/game/` とする。AIが実装する場合は親フォルダのREADMEを優先する。

## 禁止事項

- `window.onkeydown` へ直接代入しない。`addEventListener` と `dispose()` を対にする。
- Canvasの描画関数にゲームルールを書かない。
- Supabase SDKをimportしない。

## 最初の一歩

`GameState.js` を作り、`tryMove(dx, dy)` が「壁ならfalse、床ならtrueと新座標」を返す小さい実装から始める。その後にCanvas描画とキー入力をつなぐ。
