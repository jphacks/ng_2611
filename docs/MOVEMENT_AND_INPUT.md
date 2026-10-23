# 入力仕様（既存 `InputHandler` 準拠）

実装時は既存の `src/core/InputHandler.js` のクラス設計を踏襲する。キー判定は `KeyboardEvent.key` を小文字化して行い、ブラウザ・Mac対応はInputHandlerへ閉じ込める。

## 移動

| 操作 | キー | `onMove` の値 |
|---|---|---|
| 上 | ArrowUp / W | `up` |
| 下 | ArrowDown / S | `down` |
| 左 | ArrowLeft / A | `left` |
| 右 | ArrowRight / D | `right` |

- keydownの最初の1回だけを受け取り、押しっぱなしのOSリピートは無視する。
- 同方向のArrow/WASDの重複押下では移動開始を二重発火しない。
- keyupまたはwindow blurで押下状態を解除する。
- 矢印キーはスクロール防止のため `preventDefault()`。Ctrl/Cmd/Alt付き移動は無効。
- `MainGameScene.handleMove()` は前方1マスを試行する。壁・閉じたゲート・閉じた色壁・発射装置・木箱には入れない。

## ショートカット

Windows/LinuxはCtrl、MacはCmd（Meta）を使う。Alt付きは無視し、対応ショートカットだけブラウザの既定動作を止める。

| キー | action | ゲーム動作 |
|---|---|---|
| Ctrl/Cmd+C | copy | 前方1マスの木箱をクリップボードへ複製。shortcutGateがあれば開く |
| Ctrl/Cmd+X | cut | 前方木箱を複製して盤面から削除 |
| Ctrl/Cmd+V | paste | 前方の空き床に木箱を配置。スキルエナジーを1消費 |
| Ctrl/Cmd+Z | undo | 移動・木箱操作を1つ戻す |
| Ctrl/Cmd+Shift+Z / Y | redo | 戻した操作をやり直す |
| Ctrl/Cmd+A/S/P | selectAll/save/print | ブラウザ操作を防ぎ、ゲーム側では案内を出す |
| R / Enter | — | ゲームオーバー時だけ現在ステージを初期化 |

コピー/切り取り/貼り付けの対象は常にプレイヤーの**向いている前方1マス**。画面終了時には必ず `InputHandler.detach()` を呼ぶ。
