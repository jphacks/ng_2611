# 須賀：ホーム画面・統合の実装指示

## 目的

プレイ方法の選択、ゲーム開始、ホームへの復帰を担当する。全体の起動ファイルを管理するが、ゲームルール・Supabase通信・エディタ内部は実装しない。

## 作成するファイル

```text
src/ui/HomeView.js           # ホーム画面DOMを生成しイベントを登録
src/ui/GameView.js           # Canvas、HUD、戻るボタンのDOMを生成
src/styles/common.css        # リセット、色変数、共通レイアウト
src/styles/home.css          # ホーム画面だけの見た目
src/main.js                  # 認証、ホーム、ゲームの接続
```

## `HomeView` の責務

- タイトル、「Googleでログイン」「ゲストでプレイ」「ゲームを開始する」を表示する。
- 起動時は `auth.getCurrentUser()` を呼び、ログイン済みなら開始可能にする。
- Googleボタンは `auth.signInWithGoogle()`、ゲストボタンは `auth.signInAsGuest()` を呼ぶだけにする。
- 開始ボタンはユーザーが選択済みの時だけ有効にする。
- エラーや準備中のメッセージを表示できる領域を持つ。

## `main.js` の接続例

```js
const user = await getCurrentUser();
renderHome({ user, onStart: async () => {
  const stage = await loadStage(defaultStageJson);
  const { canvas } = renderGameView({ onBack });
  scene.start({ canvas, stage, user, onClear: handleClear });
}});
```

- 画面切替時は `#app` の中身を置き換える前に、前の `HomeView` / `GameScene` の `dispose()` を呼ぶ。
- ゲームクリア時は `saveProgress(user, progress)` を呼び、失敗してもクリア表示は維持する。
- 共通HTMLは `index.html` の `#app` のみを使い、画面ごとにHTMLファイルを増やさない。

## 統合手順

1. ゲスト選択→ゲーム開始→移動→ゴール→ホームへ戻る、を先に通す。
2. ステージJSONを白鳥の成果物へ置き換える。
3. ゲスト保存を接続する。
4. 最後にGoogleログイン・クラウド保存を接続する。

## 完了条件

- 初回アクセスでホームが表示される。
- ゲスト選択後だけ開始できる。
- Google認証の失敗・未設定時に分かる案内が出る。
- 戻る→再開→戻るを繰り返してもゲーム入力が二重登録されない。
