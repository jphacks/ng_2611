# AI作業者向け共通指示

このリポジトリは、キーボードショートカットを使うパズル迷路ゲーム「ショートカット・ダンジョン」です。実装前に必ず `docs/` と `shared/` の仕様を読むこと。

## 絶対に守ること

1. 担当フォルダ外のファイルは、必要性を説明できる場合を除いて変更しない。
2. `shared/` の仕様を変える場合は、既存の利用側を壊さないよう互換性を保つ。
3. JavaScriptはES Modulesを使う。外部UIフレームワークは追加しない。
4. Supabase環境変数の実値、アクセストークン、個人情報をコード・Markdown・Gitに書かない。
5. 追加した公開関数にはJSDocを書き、異常入力では分かるエラーを返す。
6. 変更後は `npm run build` を実行する。

## 実装の全体像

`src/main.js` が画面を切り替える。ホームは認証モジュールからユーザーを取得し、ゲームは検証済みステージとユーザーを受け取って開始する。ゲームからSupabaseを直接呼ばず、保存モジュール経由にする。

```text
HomeView → auth.getCurrentUser() → GameScene.start({ stage, user })
GameScene → saveProgress(user, progress) → localStorage または Supabase
```

担当別の具体的な実装指示は各フォルダのREADMEを優先する。
