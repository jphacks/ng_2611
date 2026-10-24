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

## 追加提案（Day 1 10:30 に全員で合意する）

ホームの状態表示・ゲスト進捗の引き継ぎ・途中再開のために、次の追加を提案する。既存の関数は変更しない。

```js
// src/auth/auth.js
isAuthConfigured()            // boolean。未設定ならGoogleボタンを無効化
onAuthStateChange(callback)   // 解除関数を返す。ログイン/ログアウトの反映用

// src/data/save/save-repository.js
createEmptyProgress()         // Progress
normalizeProgress(value)      // Progress
mergeProgress(base, incoming) // クリアIDをunionする
claimGuestSave(user)          // ゲスト進捗をクラウドへunionし、Progressを返す
```

```js
// Progress に追加
{ bossCleared: false }
```

- `bossCleared` は既存データにない場合 `false` として扱う。
- `currentStageId` は「次に始めるステージ」。ボスクリア後は `null`。
- `claimGuestSave()` はユーザー以外には何もせず、現在のProgressを返す。
- ゲストセッションのキーは `shortcut-dungeon:guest-session:v1` とし、ゲスト保存データとは分ける。

