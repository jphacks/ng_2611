# ホスト専用プレイ状況画面

ルーム作成者（ホスト）が、ゲーム開始後に参加者の現在地・クリア状況・失敗・最終更新を一覧できる画面です。ホスト自身はプレイせず、参加者の進行を見守る想定です。

この画面は **表示専用のUI** です。Supabase は直接呼びません。`main.js` 側で `getRoom` / `subscribeToRoom` の結果を `buildHostDashboardSnapshot()` に渡し、`update()` で差し替えてください。

## プレビュー

```text
npm run dev
http://localhost:5173/src/rooms/host-dashboard-preview.html
```

モックデータで、プレイ中・クリア・ゲームオーバー・開始待ちが混在した状態を確認できます。更新ボタンとルーム終了ボタンもモックのコールバックに接続済みです。

## ファイル

| ファイル | 役割 |
| --- | --- |
| `host-dashboard.js` | 画面生成、スナップショット変換、公開API |
| `host-dashboard.css` | 専用デザイン、レスポンシブ、reduced motion |
| `host-dashboard-preview.html` | デザイン確認用の入口 |
| `host-dashboard-preview.js` | モックデータと接続例 |

## 公開API

```js
import {
  setupHostDashboardUi,
  buildHostDashboardSnapshot,
} from './host-dashboard.js';

const hostDashboardUi = setupHostDashboardUi({
  onRefresh: async ({ roomCode, snapshot }) => {
    const room = await getRoom(roomCode);
    return buildHostDashboardSnapshot({ room, stages: readStageMeta(), participantStatus });
  },
  onEndRoom: async ({ roomCode }) => {
    await deleteRoom(roomCode);
    hostDashboardUi.close();
  },
});

hostDashboardUi.open(snapshot);
hostDashboardUi.update(nextSnapshot);
hostDashboardUi.close();
hostDashboardUi.destroy();
```

- `open(snapshot)` は表示と初回描画を行います。
- `update(snapshot)` は表示中の内容を丸ごと差し替えます。差分更新ではありません。
- `close()` は非表示にします。DOMは残るため、再度 `open()` できます。
- `onRefresh` がスナップショットを返すと、その場で再描画します。
- `onEndRoom` / `onRefresh` を渡さない場合、対応ボタンは無効になります。
- 画面は `document.body` 直下の固定オーバーレイです。ゲーム画面やロビーの上に表示できます。

## スナップショット

```js
{
  roomCode: '4821',
  stage: { id: 'sample', number: 3, title: '新しいステージ' },
  stages: [
    { id: 'crate-intro', number: 1, title: '荷物取りと配置' },
  ],
  totalStages: 5,
  connection: 'live',
  updatedAt: '2026-10-25T12:34:56.000Z',
  note: '任意の補足文',
  participants: [
    {
      userId: 'member-001',
      displayName: '白鳥 颯太',
      status: 'playing',
      stageId: 'sample',
      stageNumber: 3,
      stageTitle: '新しいステージ',
      completedStageIds: ['crate-intro', 'copy-gate-maze'],
      completedCount: 2,
      totalStages: 5,
      progress: 0.48,
      updatedAt: '2026-10-25T12:34:40.000Z',
      lastAction: 'ステージ3で色スイッチを操作',
    },
  ],
  events: [
    {
      id: 'event-001',
      type: 'playing',
      tone: 'info',
      displayName: '白鳥 颯太',
      message: 'ステージ3に到達しました',
      at: '2026-10-25T12:34:40.000Z',
    },
  ],
}
```

`participants[].status` は次のいずれかです。

| status | 表示 | 用途 |
| --- | --- | --- |
| `waiting` | 開始待ち | 開始前、または現在地なし |
| `playing` | プレイ中 | 現在ステージを攻略中 |
| `cleared` | クリア | 全ステージ完了 |
| `gameover` | ゲームオーバー | 失敗・リトライ中 |
| `offline` | オフライン | 一定時間更新なし、切断 |

- `progress` は `0..1`。省略時は `completedCount / totalStages` です。
- `completedStageIds` はステージボードの「クリア」人数に使います。
- `events` を省略した場合は、`participants[].lastAction` から簡易アクティビティを作ります。
- `connection` は `live` / `syncing` / `offline`。ヘッダーと同期表示に反映されます。
- `stage.title` と `stages[].title` は `name` でも構いません。

## `room-service` からの変換

`getRoom()` の返却値はそのまま `buildHostDashboardSnapshot()` に渡せます。ホスト自身、退出済み、キック済みのメンバーは自動で除外されます。

```js
const snapshot = buildHostDashboardSnapshot({
  room: await getRoom(roomCode),
  stages: readStageMeta(),
  participantStatus,
  events,
  hostUserId: currentUser?.id,
});
```

`room_members` だけから分かる状態は次の通りです。

```js
function deriveParticipantStatus(member, stageCount) {
  const completed = member.completed_stage_ids ?? [];
  if (completed.length >= stageCount) return 'cleared';
  if (member.current_stage_id) return 'playing';
  return 'waiting';
}
```

現状の `room_members` には `gameover` / `offline` / 最終アクションがありません。これらを出す場合は、ゲーム側の進行イベントをリアルタイムで `participantStatus` マップへ反映するか、DB拡張を接続担当と相談してください。未接続でも `playing` / `waiting` / `cleared` は表示できます。

## `main.js` への接続例

現在はホストも `onStart` でゲームへ入ります。ホストだけダッシュボードへ分岐させてください。

```js
const hostDashboardUi = setupHostDashboardUi({
  onRefresh: async ({ roomCode }) => {
    const room = await getRoom(roomCode);
    return buildHostDashboardSnapshot({ room, stages: readStageMeta(), participantStatus });
  },
  onEndRoom: async ({ roomCode }) => {
    await deleteRoom(roomCode);
    hostDashboardUi.close();
    activeRoomCode = null;
    playModeUi.show(currentUser);
  },
});

const roomLobbyUi = setupRoomLobbyUi({
  onStart: async ({ roomCode, stageId }) => {
    const room = await getRoom(roomCode);
    if (room.host_user_id === currentUser?.id) {
      hostDashboardUi.open(buildHostDashboardSnapshot({
        room,
        stages: readStageMeta(),
        participantStatus,
      }));
      return;
    }
    startGame({ roomCode, stageId });
  },
});
```

リアルタイム更新は、購読コールバックで `getRoom()` を取り直してスナップショットを作り直すのが確実です。

```js
unsubscribe = await subscribeToRoom(room.id, async () => {
  const nextRoom = await getRoom(roomCode);
  hostDashboardUi.update(buildHostDashboardSnapshot({
    room: nextRoom,
    stages: readStageMeta(),
    participantStatus,
    events,
  }));
});
```

画面を閉じるときやルーム終了時は `unsubscribe()` と `hostDashboardUi.close()` を忘れないでください。

## 表示上の前提

- ホストはプレイしないため、参加者一覧にはホストを含めません。
- 参加者側のゲーム画面にこの画面は出ません。
- ゲーム開始後にホストがロビーへ戻る導線は、現状のAPIには含めていません。必要なら `onEndRoom` とは別の `onBackToLobby` を追加してください。
- `prefers-reduced-motion: reduce` ではアニメーションを停止します。
- 画像は使わず、CSSとテキストだけで描画します。
