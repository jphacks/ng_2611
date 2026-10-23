# 白鳥：ステージ作成側の実装指示

## 目的

ブラウザでグリッド型ステージを作成・編集し、プレイ側がそのまま読み込めるJSONを書き出す。ゲーム本体のコードや認証処理は作らない。

## 作成するファイル

```text
stage-editor/
  index.html                 # エディタ画面の入口
  src/main.js                # UIの初期化
  src/editor-state.js        # 選択中マス・タイル配列・履歴の状態
  src/editor-renderer.js     # グリッドとパレットのDOM/Canvas描画
  src/stage-io.js            # JSONの読込・検証・ダウンロード
  src/styles.css
  stages/*.json              # 完成済みサンプルステージ
```

## 必須UI

1. 幅・高さを指定して新規ステージを作る（最初は 8×6）。
2. `floor`、`wall`、`start`、`goal`、`copy-source`、`paste-target`、`gate`、`switch`、`hazard` を選ぶパレットを出す。
3. パレットで選んだタイルをクリックしたマスへ配置する。右クリックまたは消しゴムで `floor` に戻す。
4. `group` が必要なタイルは `blue` などの文字列を入力できるようにする。
5. JSONファイルの読込、ダウンロード、入力エラー表示を実装する。

## 実装ルール

- JSON形式は必ず `../shared/STAGE_FORMAT.md` と同じにする。独自フィールドは追加しない。
- `start` は1個、`goal` は1個以上あるかをエクスポート前に検証する。
- 同じ座標に2つのタイルを出力しない。未指定の座標は `floor` として扱ってよい。
- `stage-io.js` で `zod` を使い、壊れたJSONを読み込ませない。
- ファイル名は `copy-gate-intro.json` のような英小文字ハイフン区切りにする。

## 他担当へ渡すもの

- `stages/` の完成JSON。
- 追加ギミックが必要なら、先に `shared/STAGE_FORMAT.md` と `docs/GIMMICKS.md` の更新案を提示する。

## 完了条件

- 新規作成→壁と開始・ゴール配置→JSONダウンロードができる。
- ダウンロードしたJSONを再読込して同じ見た目になる。
- 少なくとも「移動のみ」「コピーと扉」「スイッチ」の3ステージを用意する。
