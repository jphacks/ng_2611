# 認証・保存の共通契約（実装契約）

画面やゲーム機能はSupabaseを直接操作せず、以下のモジュールだけをimportする。

```js
// src/auth/auth.js
getCurrentUser()       // Promise<User | null>
signInWithGoogle()     // Promise<void>
signInAsGuest()        // Promise<GuestUser>
signOut()              // Promise<void>

// src/save/save-repository.js
loadSave(user)         // Promise<Progress>
saveProgress(user, progress) // Promise<Progress>
```

## 型の形

```js
// User
{ type: 'guest', id: 'guest' }
{ type: 'user', id: 'uuid', email: 'user@example.com', displayName: '名前' }

// Progress
{
  completedStageIds: ['move-intro'],
  currentStageId: 'copy-gate-intro',
  updatedAt: '2026-10-24T10:00:00.000Z'
}
```

## 呼び出し側のルール

- `null` の時はゲームを開始しないでホームに選択案内を出す。
- ゲストとログインユーザーの分岐は保存モジュール内で行う。ゲーム側に `if (user.type)` を増やさない。
- `loadSave()` に保存がない場合は空のProgressを返す。`null` は返さない。
- ネットワークエラーは握り潰さずthrowする。ただしホーム／ゲームUIはエラーを表示し、プレイ自体は続行可能にする。
