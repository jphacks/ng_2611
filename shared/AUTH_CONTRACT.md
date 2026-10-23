# 認証・保存の共通契約

既存ゲームに認証はまだ無い。白石が以下のモジュールを追加し、他担当はSupabase SDKを直接importせず、この関数だけを使う。

```js
// src/auth/auth.js
getCurrentUser()       // Promise<null | GuestUser | SignedInUser>
signInAsGuest()        // Promise<GuestUser>
signInWithGoogle()     // Promise<void>。OAuthリダイレクトを開始
signOut()              // Promise<void>

// src/data/save/save-repository.js
loadSave(user)         // Promise<Progress>
saveProgress(user, progress) // Promise<Progress>
```

```js
// GuestUser / SignedInUser
{ type: 'guest', id: 'guest' }
{ type: 'user', id: 'uuid', email: 'user@example.com', displayName: '名前' }

// Progress
{ completedStageIds: ['crate-intro'], currentStageId: 'copy-gate-maze', updatedAt: 'ISO-8601文字列' }
```

- `getCurrentUser()` がnullならゲームを開始しない。
- ゲストはlocalStorageキー `shortcut-dungeon:guest-save:v1` を使う。
- ログインユーザーはSupabase `saves` テーブルへ `user_id` をキーとしてupsertする。
- 保存なしの場合、`loadSave()` は空のProgressを返す。nullを返さない。
- ネットワーク失敗はErrorとして呼び出し元へ伝えるが、UIはゲストプレイを継続可能にする。
