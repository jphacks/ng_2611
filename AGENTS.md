# AI作業者向け共通指示（既存実装を引き継ぐ）

このリポジトリはゼロから設計し直さない。既存の `jphacks2026_s.suex` の `src/`、`packages/`、`editor/` にある動作を正として引き継ぎ・改善する。実装前に `docs/IMPLEMENTATION_GUIDE.md`、`docs/MOVEMENT_AND_INPUT.md`、`docs/GIMMICKS.md`、`shared/STAGE_FORMAT.md` を読むこと。

## 守ること

1. ステージ形式は `packages/stage-schema` が唯一の正。JSONを変える時は constants、validator、editor、ゲームを同一変更で更新する。
2. InputHandler以外でキーボードの共通判定を重複実装しない。`event.preventDefault()` は対応ショートカットだけに限る。
3. MainGameSceneの描画と判定を壊さない。追加ギミックは「データ検証→ロード→状態更新→描画→エディタ」の順に追加する。
4. `src/main.js`、`styles/main.css`、ルートpackage.jsonは統合担当（須賀）が変更窓口。担当者は必要な差分を先に共有する。
5. SupabaseのURL・匿名キーは `.env.local` だけに置く。値をコミットしない。
6. 変更後は `npm run validate:stages`、`npm test`、`npm run build` を実行する。

## 担当と対象

- 白鳥: `editor/`、`src/data/stages/*.json`、`packages/stage-schema` のステージ仕様
- 白石: `src/auth/`、`src/data/save/`。ゲームはSupabaseを直接呼ばない
- 末田: `src/scenes/`、`src/core/`、`src/ui/canvas-ui.js`、ゲーム体験
- 須賀: `src/ui/home-ui.js`、`src/main.js`、`index.html`、`styles/main.css`、統合
