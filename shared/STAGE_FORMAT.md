# ステージJSON仕様（既存実装準拠）

AIがステージやローダーを実装する時の唯一の正規仕様です。参考元は既存プロジェクトの `packages/stage-schema/` と `src/data/stages/*.json`。独自の `tiles` 配列形式には変えません。

## グリッド

- Canvasは **24列 × 16行**、1タイル **40px**。
- 座標は左上が `(0, 0)`。外周は固定壁。配置可能範囲は `x: 1〜22`、`y: 1〜14` の整数。
- `schemaVersion` は必ず `1`。

## 完全な例

```json
{
  "schemaVersion": 1,
  "id": "copy-crate-intro",
  "number": 1,
  "name": "コピー箱入門",
  "start": { "x": 2, "y": 13, "facing": "right" },
  "obstacles": [{ "x": 5, "y": 5, "width": 1, "height": 4 }],
  "items": [{ "type": "pastePotion", "x": 3, "y": 12 }, { "type": "selectAllPotion", "x": 4, "y": 12 }],
  "blocks": [{ "id": "intro-crate", "name": "木箱", "kind": "normal", "x": 3, "y": 13, "color": "#b57d50" }],
  "colorSwitches": [], "colorWalls": [], "lasers": [], "water": [],
  "goal": { "x": 21, "y": 2 },
  "hint": "スタート横の箱に向いてCtrl+C。箱をコピーしよう"
}
```

## 必須フィールド

| フィールド | 型・制約 | ゲームでの意味 |
|---|---|---|
| `id` | 英小文字・数字・ハイフン、3〜64文字 | ファイル名と同じ識別子 |
| `number` | 1以上の整数、全ステージで一意 | プレイ順 |
| `name` | 1〜40文字 | HUD表示名 |
| `start` | `{x,y,facing}`、facingは上下左右 | 開始位置と初期の向き |
| `obstacles` | `{x,y,width,height}` の配列 | 固定壁 |
| `items` | `pastePotion` / `selectAllPotion` の配列 | 接触取得ポーション |
| `blocks` | `id,name,kind,x,y,color` の配列 | コピー・切り取り・貼り付け対象 |
| `colorSwitches` | `{x,y,color}` の配列 | 色つき木箱を置く台 |
| `colorWalls` | `{x,y,width,height,color,mode?}` の配列 | `mode: "open"`（省略時）は同色スイッチで開く。`"close"` は同色スイッチで閉じる |
| `lasers` | `{x,y,direction}` の配列 | 発射装置 |
| `water` | `{x,y}` の配列 | 通行できない水マス。通常木箱を置くと渡れる足場になる |
| `goal` | `{x,y}` | プレイヤーのゴール |
| `hint` | 文字列（70文字以下推奨） | 下部ヒント |

`initialPasteEnergy`（省略時1）と `initialSelectAllEnergy`（省略時0）は任意の0以上の整数。各ポーション取得で対応する残り回数が1増える。`kind` は `normal` または `colored`、色は必ず `#rrggbb`。

## 検証ルール

- 未知のフィールド、必須フィールド欠落、範囲外、重複座標はエラー。
- start/goal/壁/アイテム/スイッチ/色壁/レーザー/水場は重ねない。通常木箱は水マスに置いて橋にできる。
- レーザーは発射装置の向きに壁・障害物・木箱で遮られるまで伸びる。安全上限は21マス。JSONで長さを指定しない。ノーマル・色つき木箱のどちらも遮る。
- JSONは64KB以下。作成後は必ず `npm run validate:stages`。
