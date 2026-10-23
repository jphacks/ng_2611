# JPHACK 2026 当日開発用フォルダ

4人が並行して作業するための開始構成です。実装物は担当フォルダ内に置き、共有部分を変更する場合は担当者間で先に相談してください。

## 担当フォルダ

- `stage-editor/` — 白鳥：ステージ作成側サイトとステージJSON
- `auth-save/` — 白石：Supabase Googleログイン、認証状態、保存機能
- `game-player/` — 末田：遊ぶ側サイトのゲーム機能とマスのデザイン
- `home-integration/` — 須賀：ホーム画面と最終統合のための作業メモ
- `shared/` — 全員で参照する仕様。直接変更する前に共有する
- `docs/` — チームの進行・設計ドキュメント

詳細な作業ルールは [docs/TEAM_RULES.md](docs/TEAM_RULES.md) を確認してください。

## 開始方法

```bash
npm install
npm run dev
```

AIへ作業を依頼する時は、まずリポジトリ直下の [AGENTS.md](AGENTS.md) と、その担当フォルダのREADMEを読み込ませてください。必要に応じて共有仕様もあわせて渡します。

主要な実装資料：

- [移動キー・入力仕様](docs/MOVEMENT_AND_INPUT.md)
- [マス・ギミック仕様](docs/GIMMICKS.md)
- [実装方針・ファイル構成](docs/IMPLEMENTATION_GUIDE.md)
