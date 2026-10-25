# 共有アセットの作業指示

ロゴ、画像、音、フォントを置く。ゲームの最低限のマスはCanvasコードで描くため、初日に画像アセットを必須にしない。

## 配置規則

```text
assets/
  logo/       # ロゴ。例: shortcut-dungeon-logo.svg
  images/     # 背景・説明用画像
  sounds/
    bgm/      # BGM。例: title-loop.ogg, dungeon-loop.ogg
    se/       # 効果音。例: move.mp3, clear.mp3
```

- ファイル名は英小文字とハイフンのみを使う。
- BGM は `.ogg` を基本にし、Safari 用に同名の `.mp3` を併置する。効果音は `.mp3` でよい。
- 出典、ライセンス、利用箇所をこのREADMEの末尾へ追記する。
- 外部素材を追加する前に、商用利用・改変・クレジット表記の条件を確認する。
- 読み込み失敗時にもゲームが止まらないよう、画像・音は必須のルール判定に使わない。

## 音の使い方（現在）

音源は `src/core/AudioManager.js` が `import.meta.glob` で読み込む。ファイル名（拡張子なし・大文字小文字は区別しない）がそのまま効果音のキーになるため、追加した音は `audio.playSe('ファイル名')` で鳴らせる。

| ファイル | 再生されるタイミング |
| --- | --- |
| `bgm/dungeon-loop.mp3` | ゲームプレイ中のみループ再生（ホームやモード選択では流れない） |
| `se/move.mp3` | プレイヤーが1マス移動したとき |
| `se/error.mp3` | 移動できないとき、ブロックの設置・コマンドの実行に失敗したとき、ゲームオーバー時 |
| `se/ctrlA.mp3` | Ctrl / Cmd + A（全選択）が成功したとき |
| `se/ctrlC.mp3` | Ctrl / Cmd + C（コピー）が成功したとき |
| `se/ctrlX.mp3` | Ctrl / Cmd + X（切り取り）が成功したとき |
| `se/ctrlV.mp3` | Ctrl / Cmd + V（貼り付け）が成功したとき |
| `se/ctrlZ.mp3` | Ctrl / Cmd + Z（取り消し）が成功したとき |
| `se/ctrlY.mp3` | Ctrl / Cmd + Y（やり直し）が成功したとき |
| `se/ctrlS.mp3` | Ctrl / Cmd + S を押したとき（保存は自動） |
