# JPHACK 2026 当日開発用フォルダ

4人が並行して作業するための開始構成です。各担当フォルダ（`stage-editor/`、`auth-save/`、`game-player/`、`home-integration/`）はメモ・試作専用です。実装は最初から最終パス（`src/`、`packages/`、`editor/`、`styles/`、`index.html`）に置き、共有部分を変更する場合は担当者間で先に相談してください。

## 担当フォルダ

- `stage-editor/` — 白鳥：ステージ作成側サイトとステージJSON
- `auth-save/` — 白石：Supabase Googleログイン、認証状態、保存機能
- `game-player/` — 末田：遊ぶ側サイトのゲーム機能とマスのデザイン
- `home-integration/` — 須賀：ホーム画面と最終統合のための作業メモ
- `shared/` — 全員で参照する仕様。直接変更する前に共有する
- `docs/` — チームの進行・設計ドキュメント

詳細な作業ルールは [docs/TEAM_RULES.md](docs/TEAM_RULES.md)、具体的なタスクと受け渡しは [docs/WORK_BREAKDOWN.md](docs/WORK_BREAKDOWN.md) を確認してください。

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

## Cloudflare Pages への公開

ゲームは Cloudflare Pages の Git 連携でビルドします。`dist/` はコミットしません（`.gitignore` 済み）。

| 項目 | 値 |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `.nvmrc` の `22` |

環境変数（Production / Preview の両方に設定）:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

値は Cloudflare のダッシュボードにだけ置き、リポジトリへコミットしない。

公開後にやること:

- Supabase → Authentication → URL Configuration の Redirect URLs に `https://<project>.pages.dev/**` を追加する。
- Google Cloud Console のリダイレクトURIは Supabase の callback（`https://<project-ref>.supabase.co/auth/v1/callback`）のままでよい。
- エディタは別プロジェクト（Root directory: `editor`、Build: `npm ci && npm run build`、Output: `dist`）で公開する。

`public/_headers` でキャッシュとセキュリティヘッダーを設定している。Vite が `dist/` 直下へコピーする。

```bash
npm run build
npx wrangler pages deploy dist
```

