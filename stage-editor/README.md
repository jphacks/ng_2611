# 白鳥：ステージエディタ・ステージデータ

AIはまず既存プロジェクトの `editor/src/` と `packages/stage-schema/` を読む。エディタはゲームとは独立したViteアプリで、ゲームに同居させない。

## 引き継ぐファイル構成

```text
editor/src/main.js                 # DOMイベントと画面初期化
editor/src/state/model.js          # JSONとエディタ内部モデルの相互変換
editor/src/state/store.js          # 配置、削除、選択、Undo/Redo、下書き状態
editor/src/render/render-editor.js # グリッド、パレット、プロパティUIの描画
editor/src/io/stage-io.js          # JSONの読込、保存、クリップボード、localStorage下書き
packages/stage-schema/             # 共有バリデータ
src/data/stages/*.json             # 完成ステージ
```

## 実装要求

- 24×16のグリッドで、外周を編集不可にする。
- ツールは選択、壁、開始、ゴール、goalBlock、shortcutGate、normal木箱、colored木箱、色スイッチ、色壁、レーザー、マグマ、2種ポーション、消しゴムを提供する。
- `modelToStage()` の出力を `validateStage()` で検証し、エラーがある時は保存を拒否する。
- 壁はエディタ内で1タイルごとに扱い、保存時だけ `obstacles` の矩形へ変換する。
- JSON入出力は既存 `stage-io.js` の `showSaveFilePicker` → ダウンロードfallbackを維持する。
- 下書きのlocalStorageキーは `shortcut-dungeon:editor:draft` を維持する。

## 完了条件

既存JSONをインポートし、編集し、保存し、ゲーム側 `npm run validate:stages` が通ること。ゲーム本体コードを変えずにステージを追加できること。
