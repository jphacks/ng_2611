# 末田：遊ぶ側サイト・マスデザインの実装指示

## 目的

検証済みのステージをCanvasに描画し、キーボード入力でパズルを遊べる状態にする。認証画面、Supabase、HTMLのホーム画面は実装しない。

## 作成するファイル

```text
src/game/
  InputHandler.js            # キーイベントをactionへ変換
  GameState.js               # プレイヤー位置・扉・コピー内容・履歴
  GameScene.js               # start/dispose/renderを提供
  StageLoader.js             # ZodでJSON検証し初期状態を作る
  tiles/renderTile.js        # typeごとの描画
  tiles/resolveTile.js       # 進入時・ショートカット時の効果
src/styles/game.css          # Canvas周辺とHUDだけ
```

## 必ず提供するAPI

```js
const scene = new GameScene();
scene.start({ canvas, stage, user, onClear, onRetry });
scene.dispose();
```

- `start()` はCanvasイベントを登録し、最初の描画まで行う。
- `dispose()` はイベント・animation frameを解除し、ホームへ戻った後にも入力が残らないようにする。
- `onClear({ stageId, moves, completedAt })` を呼ぶ。保存はこのコールバックを使い、GameScene内で直接行わない。

## 状態の形

```js
{
  player: { x: 1, y: 1 },
  copiedGroup: null,
  activeTargets: new Set(),
  openGateGroups: new Set(),
  moveCount: 0,
  status: 'playing' // 'playing' | 'cleared'
}
```

## 実装順

1. `floor`、`wall`、`start`、`goal`だけで上下左右移動とゴール判定を完成する。
2. `InputHandler` にCtrl/Cmd+C/V/X/ZとR/Enterを追加する。
3. `copy-source`→`paste-target`→`gate` の順に追加する。
4. `switch` と `hazard` を追加する。
5. HUD、アニメーション、効果音などの演出を追加する。

## 描画ルール

- 1タイルは最初 `64px`。Canvasの表示サイズに応じて倍率を計算しても、ゲーム上の座標は整数グリッドを維持する。
- `renderTile(ctx, tile, state, rect)` は描画だけをする。ルール判定を持たない。
- 色だけで状態を区別しない。`group` ごとに図形または記号も描画する。
- `docs/GIMMICKS.md` の通行可否と効果順序を変更しない。

## 完了条件

- キー入力で一度に1マスだけ動ける。
- 壁に入れず、ゴールで `onClear` が一度だけ呼ばれる。
- コピー・貼り付けによる扉の解放が動く。
- `R` で完全に初期状態へ戻り、`dispose()` 後にキー操作が反応しない。
