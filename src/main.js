// アプリの統合入口です。ホーム画面・認証・ゲーム開始処理はここで接続します。
const app = document.querySelector('#app');

if (!app) throw new Error('#app が見つかりません。');

app.textContent = 'ショートカット・ダンジョン 開発準備中';
