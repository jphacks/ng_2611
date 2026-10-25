# 末田：ゲーム本体・ギミック

最終更新: 2026-10-24  
関連: `../AGENTS.md`、`../docs/IMPLEMENTATION_GUIDE.md`、`../docs/MOVEMENT_AND_INPUT.md`、`../docs/GIMMICKS.md`、`../docs/WORK_BREAKDOWN.md`

## ゴール

- 既存のゲーム体験をそのまま引き継ぐ。別のGameState設計へ全面置換しない。
- 既存5ステージとボスクイズが最後まで動く。
- ステージクリアをホームへ通知し、保存・再開につなげる。
- ホームへ戻った時にリスナーが残らない。
- 2日目に新しいギミックを増やすより、既存ギミックの品質と説明を上げる。

> このフォルダは作業メモ用。実装は最初から最終パス（`src/core/`、`src/scenes/`、`src/ui/canvas-ui.js`）に置く。
> 統合先は `src/game/` ではない。`docs/IMPLEMENTATION_GUIDE.md` の構成に合わせる。

## 最初に読む

1. `docs/MOVEMENT_AND_INPUT.md`
2. `docs/GIMMICKS.md`
3. `docs/IMPLEMENTATION_GUIDE.md`
4. 既存プロジェクトの `src/scenes/MainGameScene.js`、`BossQuizScene.js`、`src/core/InputHandler.js`

## 移植するファイル

```text
src/core/GameLoop.js
src/core/InputHandler.js
src/core/StageManager.js
src/scenes/MainGameScene.js
src/scenes/BossQuizScene.js
src/ui/canvas-ui.js
src/data/stages.js
```

ステージJSONは白鳥が `src/data/stages/` に置く。末田は読み取り専用で使い、JSONを編集しない。

## 維持する公開形

```js
const scene = new MainGameScene(canvas);
const loop = new GameLoop({
  update: (dt) => scene.update(dt),
  render: () => scene.render(),
});
loop.start();

// 終了時
loop.stop();
scene.dispose();
```

## 追加する公開契約

ホームと保存をつなぐため、コンストラクタの第2引数だけを追加する。既存の `new MainGameScene(canvas)` も動くこと。

```js
const scene = new MainGameScene(canvas, {
  initialProgress: progress,
  onProgress: (next) => {
    // ステージクリア時とボスクリア時に1回
    // next = {
    //   completedStageIds: ['crate-intro'],
    //   currentStageId: 'copy-gate-maze', // ボスクリア後は null
    //   bossCleared: false,
    // }
  },
  onGameOver: ({ reason, stageId }) => {
    // 任意。保存には使わない
  },
});
```

- `initialProgress.currentStageId` があれば、そのステージから開始する。
- 存在しないIDなら Stage 1 から開始する。
- `onProgress` はクリアしたステージIDを漏らさず含める。
- 同じステージで二重発火しない。
- `onProgress` の例外は `try/catch` で握りつぶし、ゲームを止めない。
- `dispose()` は InputHandler、window keydown、Canvas click、BossQuiz のリスナーをすべて解除する。

## タスク

### Must（Day 1）

- [ ] **G1. ゲームエンジンの移植**
  - 上の7ファイルを最終パスへコピー。
  - `src/data/stages.js` の `import.meta.glob('./stages/*.json')` を維持。
  - 5ステージが起動し、Stage 1 が表示される。
  - 完了: `npm run dev` でCanvasにステージが出る。

- [ ] **G2. 既存ギミックの回帰テスト**
  - 下の「手動テストマトリクス」を全項目実施。
  - 見つけた不具合は、その場で直すか、白鳥/須賀へ共有する。
  - 完了: 5ステージを最後までクリアできる。

- [ ] **G3. ライフサイクル修正**
  - `dispose()` の解除漏れを確認。
  - ホームへ戻る→再開始で、キー入力が二重にならない。
  - `GameLoop.stop()` 後に `requestAnimationFrame` が残らない。
  - ゲームオーバー中にホームへ戻っても、`keydown` のリトライリスナーが残らない。
  - 完了: 3回往復しても入力・描画が壊れない。

- [ ] **G4. 進捗コールバックと途中再開**
  - `StageManager` に `selectById(stageId)` を追加（内部indexを返す）。
  - `MainGameScene` で `completedStageIds` を `Set` で保持。
  - `checkGoal()` で現在ステージを追加し、次へ進む。
  - 次ステージがある時: `onProgress({ completedStageIds, currentStageId: next.id, bossCleared: false })`。
  - 最終ステージ後: ボスクイズを開始。
  - ボスクリア時: `onProgress({ completedStageIds, currentStageId: null, bossCleared: true })`。
  - 完了: コンソールでクリアごとに1回だけ発火する。

- [ ] **G5. ボスクイズの接続と拡張**
  - `BossQuizScene` に `onClear` と `onGameOver` を追加。
  - クリア時に `onClear` を1回だけ呼ぶ。
  - 問題を3問から4問へ増やす（Ctrl+Z / C / V / X）。
  - Macでは `Cmd` 表示、Windowsでは `Ctrl` 表示を維持。
  - 誤答でHP-1、HP0でゲームオーバー、R/Enterでリトライを維持。
  - 完了: 4問正解で `onClear`、失敗で `onGameOver`。

- [ ] **G8. 最終回帰・性能**
  - 5ステージ＋ボスを通しで2回。
  - ChromeのPerformanceで60fps付近。
  - console error / warning がない。
  - `dispose()` 後のリスナーが残っていない。
  - 完了: デモリハーサルでゲーム部分が安定。

### Should（Day 2）

- [ ] **G6. 操作メッセージとHUDの改善**
  - `Ctrl+A` / `Ctrl+S` / `Ctrl+P` の案内を具体的にする。
    - 例: `Ctrl+S: 進捗はステージクリア時に自動保存されます`
    - 例: `Ctrl+A: 全選択（このゲームでは使いません）`
  - レーザーで遮断中の木箱に残り秒数が分かる表示があるか確認。なければHUDか木箱の上に出す。
  - ステージ開始時に「何を学ぶ面か」が1行で分かるようにする（`hint` を活用）。
  - 完了: 既存挙動を変えず、説明だけが具体的になっている。

- [ ] **G7. 新ギミック（原則やらない）**
  - 追加する場合は、先に `shared/STAGE_FORMAT.md`、`packages/stage-schema`、editor、ゲーム、テストの5点を同じ変更で更新する。
  - 候補: Ctrl+S をゲーム内セーブポイントにする（ステージ内の再開位置を記録）。
  - ただし「進捗保存のCtrl+S」と混同しやすいので、デモでは使わない。
  - 完了: 全担当の合意がある時だけ。

## 手動テストマトリクス

| # | ステージ | 操作 | 期待結果 |
|---:|---|---|---|
| 1 | crate-intro | 木箱の前で Ctrl+X → goalBlockの前で Ctrl+V | 木箱が移動し、ゴールのLOCKがREADYになる |
| 2 | crate-intro | Ctrl+Z / Ctrl+Y | 移動・切り取り・貼り付けが1操作ずつ戻る/進む |
| 3 | copy-gate-maze | 開始位置の木箱へ向いて Ctrl+C | 木箱は残る |
| 4 | copy-gate-maze | スキルポーション取得後に Ctrl+V | エナジーが1減り、前方に木箱が置ける |
| 5 | copy-paste-basics | Ctrl+C → 別の場所で Ctrl+V | コピー元が残り、コピー先に木箱が増える |
| 6 | color-switch-gate | 赤い木箱を赤スイッチの前で Ctrl+V | 赤い色壁が開く |
| 7 | color-switch-gate | ノーマル木箱をスイッチに置く | 色壁は開かない。案内が出る |
| 8 | laser-water-lab | ノーマル木箱をマグマに置いて渡る | マグマでゲームオーバーにならない |
| 9 | laser-water-lab | 木箱でレーザーを遮る | 5秒間は安全。5秒後に木箱が壊れ、ビーム再開 |
| 10 | laser-water-lab | 色つき木箱でレーザーを遮ろうとする | 遮れずダメージ |
| 11 | 全ステージ | 壁・閉じたゲート・閉じた色壁・発射装置へ移動 | 入れない。案内が出る |
| 12 | 全ステージ | 矢印とWASDの同時押し | 移動が二重発火しない |
| 13 | 全ステージ | Ctrl+矢印 | 移動しない |
| 14 | プレイ中いつでも | R / Enter | 現在ステージが初期化される |
| 15 | 最終ステージ | ゴール | ボスクイズが始まる |
| 16 | ボス | 正解4問 | GAME CLEAR、`onClear` 1回 |
| 17 | ボス | 誤答 | HP-1、HP0でゲームオーバー |
| 18 | ホーム復帰 | 戻る→再開始を3回 | 入力・描画・音（あれば）が二重にならない |
| 19 | 途中再開 | Stage 3 クリア後にリロード | Stage 4 から始まる |
| 20 | モバイル幅 | 768px | Canvasが縦横比を保って縮む。横スクロールしない |

## 実装メモ

### 進捗の発火箇所

```js
checkGoal() {
  // ゴール判定...
  this.completedStageIds.add(this.stage.id);
  const nextStage = this.stageManager.advance();
  if (nextStage) {
    this.loadStage(nextStage);
    this.emitProgress(nextStage.id, false);
    return;
  }
  this.input.setEnabled(false);
  this.bossQuiz.start();
}

emitProgress(currentStageId, bossCleared) {
  try {
    this.onProgress?.({
      completedStageIds: [...this.completedStageIds],
      currentStageId,
      bossCleared,
    });
  } catch (error) {
    console.error('[progress]', error);
  }
}
```

- ボスクリア時は `BossQuizScene` の `onClear` から `emitProgress(null, true)`。
- `onProgress` は保存APIを呼ばない。呼ぶのは須賀の `main.js`。

### 途中再開

```js
// コンストラクタ内
this.stageManager = new StageManager(STAGES);
const startId = options.initialProgress?.currentStageId;
if (startId) this.stageManager.selectById(startId);
```

- `selectById` が見つからない場合はindexを0のままにする。
- クリア済みIDは `new Set(options.initialProgress?.completedStageIds ?? [])` で初期化。
- 再開時にクリア済みステージをスキップしない。現在ステージだけを選ぶ。

### リスナーの解除

- `InputHandler.detach()`
- `window.removeEventListener('keydown', this.handleRetryKeyDown)`
- `this.bossQuiz.dispose()`
- `this.canvas.removeEventListener('click', this.focusCanvas)`
- `GameLoop.stop()` は須賀の `main.js` が呼ぶ。`dispose()` からは呼ばない。

### 触ってはいけない挙動

- 移動は1マス単位。押しっぱなしのOSリピートは無視。
- コピー/切り取り/貼り付けの対象は「向いている前方1マス」。
- ノーマル木箱はレーザーを5秒遮り、その後壊れる。色つきは遮らない。
- マグマはノーマル木箱がないと即ゲームオーバー。
- `goalBlock` に木箱がないとゴールできない。
- はコピー成功で開く。
- 色スイッチは同色の色つき木箱を置いた時だけ開く。
- R / Enter はプレイ中いつでも現在ステージをやり直す。全ステージクリア後は最初から再開する。

## 完了条件

- [ ] G1〜G5、G8 が完了。
- [ ] 手動テストマトリクス20項目が通る。
- [ ] 5ステージ＋ボスを最後までクリアできる。
- [ ] `onProgress` がクリアごとに1回だけ発火する。
- [ ] `initialProgress.currentStageId` から再開できる。
- [ ] ホーム復帰→再開始で入力が二重にならない。
- [ ] `dispose()` 後にリスナーが残らない。
- [ ] console error がない。
- [ ] `npm test`、`npm run build` が通る（既存テストを含む）。

## 引き渡し

- 須賀へ:
  - `new MainGameScene(canvas, { initialProgress, onProgress, onGameOver })` の形。
  - `onProgress` のpayload。
  - `scene.dispose()` を必ず呼ぶこと。
  - `initialProgress` は `src/data/save` の `Progress` をそのまま渡してよい。
- 白石へ:
  - ゲームは保存APIを呼ばない。`onProgress` を返すだけ。
- 白鳥へ:
  - ステージの不具合（詰み、座標重複、ヒント不足）はJSON側で直してもらう。
- 触らない:
  - `src/main.js`、`styles/main.css`、`index.html`、`src/ui/home-ui.js`、`src/data/stages/*.json`、Supabase関連。
