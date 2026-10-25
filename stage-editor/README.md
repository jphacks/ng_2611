# 白鳥：ステージ作成サイト・ステージデータ

## ローカルで起動

リポジトリのルートで依存パッケージをインストールしたあと、次のコマンドで起動します。

```bash
cd stage-editor
npm run dev
```

表示されたURL（通常は `http://127.0.0.1:5173/`）をブラウザで開いてください。終了するときはターミナルで `Ctrl+C` を押します。

最終更新: 2026-10-24  
関連: `../AGENTS.md`、`../shared/STAGE_FORMAT.md`、`../docs/GIMMICKS.md`、`../docs/WORK_BREAKDOWN.md`

## ゴール

- 既存のステージエディタを、ゲームとは独立したViteアプリとして動かす。
- 24×16のグリッドでステージを作り、検証し、JSONを保存できる。
- 保存したJSONを `src/data/stages/` に置くだけでゲームに追加される。
- 既存5ステージを壊さず、デモ用に6ステージ目まで用意する。
- 不正なステージはエディタ・CLI・ビルドの3箇所で止める。

> このフォルダは作業メモ用。実装は最初から最終パス（`packages/`、`editor/`、`src/data/stages/`）に置く。
> `stage-editor/stages/` には完成JSONを置かない。完成JSONの置き場は `src/data/stages/` だけ。

## 最初に読む

1. `shared/STAGE_FORMAT.md`
2. `docs/GIMMICKS.md`
3. `docs/IMPLEMENTATION_GUIDE.md`
4. 既存プロジェクトの `packages/stage-schema/`、`editor/src/`、`docs/stage-editor-design.md`

## 引き継ぐファイル

```text
packages/stage-schema/
  constants.js
  validate.js
  index.js
  package.json

editor/
  index.html
  package.json
  vite.config.js
  src/
    main.js
    styles.css
    state/model.js
    state/store.js
    render/render-editor.js
    io/stage-io.js

src/data/stages/
  crate-intro.json
  copy-gate-maze.json
  color-switch-gate.json
  laser-magma-lab.json
  （sample.json は差し替える）

scripts/
  validate-stages.mjs

tests/
  stage-schema.test.js
  editor-model.test.js
```

`node_modules`、`dist`、`package-lock.json` は既存のものをそのままコピーしない。移植後に `npm install` で作る。

## ルート依存の追加（須賀へ依頼）

ルート `package.json` は須賀が変更窓口。Day 1 10:30 までに次の差分を渡す。

```json
{
  "scripts": {
    "build": "npm run validate:stages && vite build",
    "validate:stages": "node scripts/validate-stages.mjs"
  },
  "dependencies": {
    "@shortcut-dungeon/stage-schema": "file:packages/stage-schema"
  }
}
```

須賀が `npm install` した後、白鳥が以下を確認する。

```bash
npm run validate:stages
npm test
```

エディタ側は独立して依存を持つ。

```bash
cd editor
npm install
npm run dev -- --port 5174
npm run build
```

## タスク

### Must（Day 1〜Day 2）

- [ ] **S1. スキーマとエディタの移植**
  - `packages/stage-schema` を最終パスへコピー。
  - `editor/` を最終パスへコピー（`node_modules`、`dist` を除く）。
  - `scripts/validate-stages.mjs`、`tests/stage-schema.test.js`、`tests/editor-model.test.js` をコピー。
  - `cd editor && npm install`、`npm run build` が通る。
  - ルートで `npm test` が通る。
  - 完了: エディタが起動し、既存JSONを読み込める。

- [ ] **S2. 既存ステージの移植・監査**
  - `crate-intro`、`copy-gate-maze`、`color-switch-gate`、`laser-magma-lab` をコピー。
  - 3番目は S7a で `copy-paste-basics` として作る。
  - 全ステージを手で解き、詰みがないことを確認。
  - 完了: 4ステージがvalidateを通り、クリアできる。

- [ ] **S7a. 3番目の差し替え**
  - `sample.json`（number 3、名前「新しいステージ」）を `copy-paste-basics` に差し替える。
  - Ctrl+C と Ctrl+V だけで解ける面。既存フィールドだけを使う。
  - 完了: 手で解け、validateも通る。

- [ ] **S3. ルート依存の差分を須賀へ渡す**
  - 上のJSON差分と、必要な `npm install` のタイミングを共有。
  - 完了: ゲーム側から `@shortcut-dungeon/stage-schema` をimportできる。

- [ ] **S4. エディタを独立サイトとしてビルド・公開**
  - `editor/vite.config.js` の `base: './'` を維持。
  - `cd editor && npm run build` で `editor/dist` が出る。
  - 公開する場合:
    - Cloudflare Pages / Netlify の Root: `editor`
    - Build: `npm ci && npm run build`
    - Output: `dist`
  - ゲームの `npm run build` にエディタが含まれないことを確認。
  - 完了: 公開URL、またはローカル `http://localhost:5174` で編集できる。

- [ ] **S8. 全ステージの往復確認**
  - 各JSONをエディタで import → 少し編集 → export。
  - 再importして意味的な差分がない。
  - ファイル名と `id` が一致する。
  - 完了: 5〜6ステージすべてで往復OK。

- [ ] **S9. ドキュメント**
  - `editor/README.md` に起動・ビルド・公開・JSON追加手順を書く。
  - このREADMEのステージ一覧を更新する。
  - 完了: 第三者が同じ手順で再現できる。

### Should（Day 1 夜〜Day 2）

- [ ] **S5. テンプレートから新規作成**
  - `editor/src/state/templates.js` を追加。
  - ヘッダーに「テンプレート」ボタン、`<dialog>` で3種を選ぶ。
  - テンプレート案:
    1. 基本の部屋: 開始・ゴール・ヒントのみ。
    2. コピーゲート: 開始位置の前に木箱、ゴール。
    3. カラー＆レーザー: 色つき木箱、同色スイッチ、色壁、レーザー、ノーマル木箱、マグマ。
  - 選択時に未保存の確認を出す。
  - 生成後は `validateStage()` が通る状態にする。
  - 完了: 3種すべて保存可能。

- [ ] **S6. 初回ガイドと操作説明**
  - 初回アクセス時に「使い方」ダイアログを表示（localStorageで既読管理）。
  - ヘッダーに「使い方」ボタン。
  - 内容: ツールの選び方、色の対応、検証エラー、保存→ゲーム追加の3ステップ。
  - 完了: 初見がJSON保存まで迷わない。

- [ ] **S7b. 6番目の追加（Should）**
  - `final-shortcut-trial`（仮）。コピーゲート、色スイッチ、レーザー、マグマ、goalBlockを複合。
  - 既存フィールドだけで作る。新フィールドは追加しない。
  - 完了: 手で解け、validateも通る。

## 既存エディタの機能（維持する）

- 24×16グリッド。外周は編集不可。
- ツール: 選択、固定壁、削除、開始、ゴール、goalBlock、ノーマル木箱、色つき木箱、カラースイッチ、開く色壁、閉じる色壁、レーザー、水場、スキルポーション、ライフポーション。
- 壁はタイルで塗り、保存時に決定的な矩形へ変換。
- 検証エラーは保存・コピーをブロック。警告は確認ダイアログ。
- Undo/Redo（最大100）、Delete、矢印移動、Escで選択に戻る。
- `Ctrl/Cmd+S` で保存。
- 下書きの localStorage キーは `shortcut-dungeon:editor:draft`。
- `showSaveFilePicker` が使えれば名前を付けて保存、なければダウンロード。
- プレビューでグリッド・カーソルを消す。

これらは作り直さない。壊したら既存実装に戻す。

## ステージ設計

### デモ用ステージ一覧

| # | id | 学ぶ操作 | 必須ギミック | 状態 |
|---:|---|---|---|---|
| 1 | `crate-intro` | Ctrl+X / Ctrl+V | goalBlock、木箱 | 既存 |
| 2 | `copy-gate-maze` | Ctrl+C | 木箱、迷路 | 既存 |
| 3 | `copy-paste-basics` | Ctrl+C / Ctrl+V | 木箱、goalBlock | `sample` を差し替え |
| 4 | `color-switch-gate` | Ctrl+C / Ctrl+V | 色つき木箱、色スイッチ、色壁 | 既存 |
| 5 | `laser-magma-lab` | Ctrl+X / Ctrl+V | レーザー、マグマ、ノーマル木箱 | 既存 |
| 6 | `final-shortcut-trial` | 全部 | ゲート、色、レーザー、マグマ、goalBlock | 新規（Should） |

### 作る時のルール

- `id` はファイル名と一致。英小文字・数字・ハイフン、3〜64文字。
- `number` は1以上、全ステージで一意。
- 開始・ゴール・壁・木箱・アイテム・スイッチ・色壁・レーザー・マグマ・ゲート・goalBlockを同じマスに置かない。
- レーザーの `length` は範囲外へ出ない。
- 外周は固定壁。配置可能範囲は `x: 1〜22`、`y: 1〜14`。
- `hint` は70文字以内。操作名を具体的に入れる。
- 作成後は必ず `npm run validate:stages`。手で解法も辿る。

### テンプレートのデータ形

```js
// editor/src/state/templates.js
export const STAGE_TEMPLATES = [
  {
    id: 'basic-room',
    label: '基本の部屋',
    description: '開始位置・ゴール・ヒントだけの最小構成',
    create: () => ({ /* createBlankStage() を元にした完全なStage */ }),
  },
  // ...
];
```

- 返す値は `validateStage()` に通る完全なStage。
- 配列は必ず出力する（`colorSwitches: []` など）。
- IDはテンプレート固有にし、そのまま保存すると重複しないよう `basic-room-1` のように連番を付ける。

## エディタの公開

### ローカル

```bash
cd editor
npm install
npm run dev -- --port 5174
```

ゲームは別ターミナルで `npm run dev`（5173）。エディタはゲームのコードをimportしない。

### 本番

- ゲーム: ルート `/`、build `npm run build`、output `dist`
- エディタ: root `editor`、build `npm ci && npm run build`、output `dist`
- 別プロジェクトにする。エディタのコードをゲームのバンドルに入れない。
- `base: './'` なので、サブパス配信でも動く。

> Phase B（GitHubへの自動公開）は今回やらない。JSONを保存し、`src/data/stages/` に置く運用で固定する。

## 検証

```bash
npm run validate:stages
npm test
cd editor && npm run build
```

手動:

1. 既存JSONを読み込む。
2. 壁を塗る、木箱を置く、色を変える。
3. エラーを作り、保存がブロックされることを確認。
4. エラーを直し、保存する。
5. `src/data/stages/` に置き、ゲームを再読み込みして出現を確認。
6. 開始位置・ゴール・木箱・ゲート・色壁・レーザー・マグマがゲームと同じ見た目で区別できる。

## 完了条件

- [ ] S1〜S4、S8、S9 が完了。
- [ ] 5ステージがvalidateを通り、実際にクリアできる。
- [ ] エディタで import → edit → export が往復する。
- [ ] エディタのビルドが通り、ゲームのバンドルに含まれない。
- [ ] `sample.json` が実ステージに置き換わっている。
- [ ] ステージ追加手順がREADMEに書かれている。
- [ ] `shared/STAGE_FORMAT.md` と実装が一致している。

## 引き渡し

- 末田へ:
  - ステージJSONのID・number・ギミック配置を共有。
  - 新しい3番目・6番目の解法ルートを共有。
  - ゲーム側のローダーは `src/data/stages.js` のまま。`stages.js` にステージを直接書かない。
- 須賀へ:
  - ルート `package.json` の差分。
  - エディタ公開URL（公開する場合）。
  - ゲームのビルドにエディタが混ざっていないこと。
- 触らない:
  - `src/core/`、`src/scenes/`、`src/main.js`、`styles/main.css`、`index.html`。
  - ゲームの見た目を変えたい時は末田・須賀に依頼する。
