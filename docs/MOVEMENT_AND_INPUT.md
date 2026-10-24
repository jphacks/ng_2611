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
| Ctrl/Cmd+A | selectAll | 操作可能なブロックすべてを選択。固定橋の木箱は対象外 |
| Ctrl/Cmd+C | copy | 選択中は、カーソルを選択ブロックに合わせて選択群を複製。未選択時は前方1マスの木箱を複製。shortcutGateがあれば開く |
| Ctrl/Cmd+X | cut | 選択中は、カーソルを選択ブロックに合わせて選択群を切り取り。未選択時は前方木箱を切り取り |
| Ctrl/Cmd+V | paste | 単体または選択群を前方へ配置。複数は基準ブロックとの相対配置を保ち、全配置先を検査してから実行。スキルエナジーを1消費 |
| Ctrl/Cmd+Z | undo | 移動・木箱操作を1つ戻す |
| Ctrl/Cmd+Shift+Z / Y | redo | 戻した操作をやり直す |
| Ctrl/Cmd+S/P | save/print | ゲーム操作ではなく、ブラウザ操作を防いでゲーム側の案内を表示 |
| R / Enter | — | ゲームオーバー時だけ現在ステージを初期化 |

単体のコピー/切り取り/貼り付け対象は常にプレイヤーの**向いている前方1マス**。選択群のコピー/切り取りは、そのカーソルが選択ブロックの一つを指している必要がある。貼り付け時は基準ブロックを前方カーソル位置へ置く。壁に一つでも重なる場合はグループ全体を拒否する。画面終了時には必ず `InputHandler.detach()` を呼ぶ。