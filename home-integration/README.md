# 須賀：ホーム画面・統合

既存の `src/main.js` と `src/ui/home-ui.js` には、ホームで選択後にゲームを開始する実装がある。これを正として引き継ぎ、置き換えない。

## 現在の実装構造

- `index.html` は `#home-screen` と、最初は `hidden` の `#game-screen` を持つ。
- `src/ui/home-ui.js` の `setupHome({ onStart })` は、ゲスト選択時に開始ボタンを有効化し、開始クリックで `onStart()` を呼ぶ。
- `src/main.js` の `startGame()` が、Canvas、`MainGameScene`、`GameLoop` を初期化する。
- `visibilitychange` はGameLoopが存在する時だけ停止／再開し、`pagehide` で `gameLoop.stop()` と `scene.dispose()` を呼ぶ。

## AIへの実装指示

1. ホームのDOM操作は `src/ui/home-ui.js` に閉じ込める。MainGameSceneへDOMコードを追加しない。
2. Googleボタンは白石の `signInWithGoogle()` を呼ぶだけにし、Supabase未設定中は「準備中」で無効化する。
3. ゲストボタンは `signInAsGuest()` を呼び、成功した時だけ開始ボタンを有効にする。
4. `startGame()` は二重実行を防ぐ。すでにsceneがある場合は新しいGameLoopを作らない。
5. 認証状態の表示、ログアウト、セーブ済みステージの表示はホームに追加してよいが、保存処理は白石の公開APIを呼ぶだけにする。

## 完了条件

初回アクセスでホームが表示され、ゲスト選択→開始→既存ゲーム操作まで動く。Google認証が失敗または未設定でもゲストプレイを選べる。画面終了後にゲームの入力イベントが残らない。
