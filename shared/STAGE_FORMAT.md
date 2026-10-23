# ステージJSON形式（実装契約）

ステージはJSONファイルとして `stage-editor/stages/` に保存し、統合時に `stages/` へコピーする。編集側とプレイ側はこの形式だけを使用する。

```json
{
  "id": "copy-gate-intro",
  "name": "コピーで扉を開こう",
  "width": 8,
  "height": 6,
  "tiles": [
    { "x": 0, "y": 0, "type": "wall" },
    { "x": 1, "y": 1, "type": "start" },
    { "x": 2, "y": 1, "type": "copy-source", "group": "blue" },
    { "x": 4, "y": 1, "type": "paste-target", "group": "blue" },
    { "x": 5, "y": 1, "type": "gate", "group": "blue" },
    { "x": 6, "y": 1, "type": "goal" }
  ]
}
```

## フィールド

| フィールド | 型 | 必須 | 制約 |
|---|---|---:|---|
| `id` | string | はい | 英小文字・数字・ハイフン。重複不可 |
| `name` | string | はい | 表示名、1〜40文字 |
| `width` / `height` | integer | はい | 3〜30 |
| `tiles` | array | はい | 座標重複不可 |
| `tiles[].x` / `y` | integer | はい | `0 <= x < width`、`0 <= y < height` |
| `tiles[].type` | string | はい | GIMMICKS.mdの列挙値のみ |
| `tiles[].group` | string | 条件付き | copy/paste/gate/switchでは必須 |

- `floor` は省略可能。指定されない座標はすべて床。
- `start` は正確に1つ、`goal` は1つ以上必要。
- `group` は `^[a-z][a-z0-9-]{0,19}$` に従う。
- 新しいマスを追加する時は、白鳥が窓口となり、末田と読込確認を行う。
