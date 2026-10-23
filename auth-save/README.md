# 白石：認証・セーブ（既存ゲームへ追加する方法）

既存ゲームはまだSupabase認証もセーブも実装していない。ゲームのギミックコードに認証を混ぜず、次の小さなモジュールとして追加する。

## 作るファイル

```text
src/auth/supabase-client.js  # VITE_SUPABASE_URL/ANON_KEYからcreateClient
src/auth/auth.js             # Googleログイン、ゲスト、セッション復元、ログアウト
src/data/save/local-save.js  # ゲスト用localStorage
src/data/save/cloud-save.js  # ログインユーザー用Supabase savesテーブル
src/data/save/save-repository.js # 保存先の共通窓口
```

## 必須API

```js
getCurrentUser() // null | { type: 'guest', id: 'guest' } | { type: 'user', id, email, displayName }
signInAsGuest()
signInWithGoogle()
loadSave(user)  // 保存なしなら { completedStageIds: [], currentStageId: null }
saveProgress(user, progress)
```

Googleログインは `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })` を使う。Supabase未設定でもゲストプレイを壊さない。`saves` テーブルは `user_id uuid primary key` と `data jsonb` を使い、RLSで `auth.uid() = user_id` の行だけを許可する。
