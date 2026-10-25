# 実装方針（既存プロジェクト準拠）

当日は素のJavaScript、Vite、Canvas 2Dを使う。React・Phaserは追加しない。既存実装のファイル責務を保ったまま機能を増やす。

## 実際の構成

```text
index.html                    # ホーム画面とゲーム画面の骨格（須賀）
styles/main.css               # 全画面のスタイル（須賀）
src/
  main.js                    # Canvas生成・ゲームループ起動・ホーム接続
  core/GameLoop.js            # requestAnimationFrame と update/render
  core/InputHandler.js        # キー入力をactionへ変換
  core/AudioManager.js        # BGM・効果音（assets/sounds/）の再生
  core/StageManager.js        # ステージ番号の進行管理
  scenes/MainGameScene.js     # ゲーム状態、ギミック、Canvas描画
  scenes/BossQuizScene.js     # 全ステージ後のキー入力クイズ
  data/stages.js              # import.meta.glob でJSONを収集・検証・順序化
  data/stages/*.json          # ステージデータ
  data/save/                  # ゲスト/クラウドの進捗保存（白石）
  auth/                       # Supabase認証（白石）
  ui/canvas-ui.js             # Canvas共通描画ヘルパー（末田）
  ui/home-ui.js               # ホームのDOM（須賀）
  ui/game-ui.js               # ゲーム画面のDOM（須賀）
packages/stage-schema/        # constants/validate をゲーム・エディタ・CLIで共有
editor/                       # 独立Viteのステージエディタ
scripts/validate-stages.mjs   # ステージJSONの一括検証
tests/                        # node --test のテスト
supabase/schema.sql           # savesテーブル・RLS
```

## 必ず守る依存方向

```text
main → MainGameScene → InputHandler / StageManager / canvas-ui / stages
stages → stage-schema
editor → stage-schema
```

ゲーム本体とエディタは、同じ `packages/stage-schema` だけを共有する。エディタのコードをゲームへimportしない。ステージ追加時に `stages.js` を編集しない。`import.meta.glob('./stages/*.json')` が自動で読込・検証・`number`順ソートする。

## 実装手順

1. 既存 `src/`、`packages/`、`editor/` を当日リポジトリに同じ構成で移す。
2. `package.json` に `@shortcut-dungeon/stage-schema: file:packages/stage-schema` を依存として登録する。
3. ゲームは `npm run dev`、エディタは `cd editor; npm run dev`。
4. 変更ごとに `npm run validate:stages`、`npm test`、`npm run build` を実行する。
5. シーンを終了する時は `dispose()` でInputHandler、Canvas click、ボスクイズを必ず解除する。

## 追加機能の置き場所

- 新しいキー操作: `core/InputHandler.js`
- 新しいステージフィールドと検証: `packages/stage-schema/`
- 新しいギミックの状態・判定・描画: `scenes/MainGameScene.js`（大きくなったら専用モジュールへ抽出）
- 新しい編集UI: `editor/src/`
- ホームとログイン: `src/ui/home-ui.js`、`src/ui/game-ui.js`、`src/auth/`
- 進捗保存: `src/data/save/`。ゲーム本体からSupabaseを直接呼ばない。
- 音: `src/core/AudioManager.js`。音源は `assets/sounds/bgm/` と `assets/sounds/se/` に置き、ファイル名がそのまま効果音のキーになる。
