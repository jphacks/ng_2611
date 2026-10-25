import { buildHostDashboardSnapshot, setupHostDashboardUi } from './host-dashboard.js';

const stages = [
  { id: 'crate-intro', number: 1, title: '荷物取りと配置' },
  { id: 'copy-gate-maze', number: 2, title: 'コピーゲートの迷路' },
  { id: 'sample', number: 3, title: '新しいステージ' },
  { id: 'color-switch-gate', number: 4, title: '同じ色のスイッチ' },
  { id: 'laser-water-lab', number: 5, title: 'レーザーと水場' },
];

const room = {
  room_code: '4821',
  created_by: 'host-001',
  host_user_id: 'host-001',
  stage_id: 'sample',
  started_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  members: [
    {
      user_id: 'host-001',
      display_name: '須賀 葵',
      current_stage_id: null,
      completed_stage_ids: [],
      joined_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      left_at: null,
      kicked_at: null,
    },
    {
      user_id: 'member-001',
      display_name: '白鳥 颯太',
      current_stage_id: 'sample',
      completed_stage_ids: ['crate-intro', 'copy-gate-maze'],
      joined_at: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
      left_at: null,
      kicked_at: null,
    },
    {
      user_id: 'member-002',
      display_name: '白石 美咲',
      current_stage_id: 'sample',
      completed_stage_ids: ['crate-intro', 'copy-gate-maze'],
      joined_at: new Date(Date.now() - 13 * 60 * 1000).toISOString(),
      left_at: null,
      kicked_at: null,
    },
    {
      user_id: 'member-003',
      display_name: '末田 蓮',
      current_stage_id: 'sample',
      completed_stage_ids: ['crate-intro', 'copy-gate-maze'],
      joined_at: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      left_at: null,
      kicked_at: null,
    },
    {
      user_id: 'member-004',
      display_name: '高橋 凛',
      current_stage_id: null,
      completed_stage_ids: [],
      joined_at: new Date(Date.now() - 11 * 60 * 1000).toISOString(),
      left_at: null,
      kicked_at: null,
    },
    {
      user_id: 'member-005',
      display_name: '森川 悠',
      current_stage_id: null,
      completed_stage_ids: ['crate-intro', 'copy-gate-maze', 'sample', 'color-switch-gate', 'laser-water-lab'],
      joined_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      left_at: null,
      kicked_at: null,
    },
  ],
};

const participantStatus = {
  'member-001': {
    status: 'playing',
    stageId: 'sample',
    completedStageIds: ['crate-intro', 'copy-gate-maze'],
    progress: 0.48,
    updatedAt: new Date(Date.now() - 18 * 1000).toISOString(),
    lastAction: 'ステージ3で色スイッチを操作',
  },
  'member-002': {
    status: 'playing',
    stageId: 'sample',
    completedStageIds: ['crate-intro', 'copy-gate-maze'],
    progress: 0.42,
    updatedAt: new Date(Date.now() - 42 * 1000).toISOString(),
    lastAction: 'ステージ2をクリア',
  },
  'member-003': {
    status: 'gameover',
    stageId: 'sample',
    completedStageIds: ['crate-intro', 'copy-gate-maze'],
    progress: 0.45,
    updatedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    lastAction: 'レーザービームに接触',
  },
  'member-004': {
    status: 'waiting',
    stageId: null,
    completedStageIds: [],
    progress: 0,
    updatedAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    lastAction: 'ホストの開始を待っています',
  },
  'member-005': {
    status: 'cleared',
    stageId: null,
    completedStageIds: ['crate-intro', 'copy-gate-maze', 'sample', 'color-switch-gate', 'laser-water-lab'],
    progress: 1,
    updatedAt: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    lastAction: '全ステージをクリア',
  },
};

const events = [
  {
    id: 'event-001',
    type: 'playing',
    tone: 'info',
    displayName: '白鳥 颯太',
    message: 'ステージ3に到達しました',
    at: new Date(Date.now() - 18 * 1000).toISOString(),
  },
  {
    id: 'event-002',
    type: 'cleared',
    tone: 'success',
    displayName: '白石 美咲',
    message: 'ステージ2をクリアしました',
    at: new Date(Date.now() - 42 * 1000).toISOString(),
  },
  {
    id: 'event-003',
    type: 'gameover',
    tone: 'danger',
    displayName: '末田 蓮',
    message: 'レーザービームに接触しました',
    at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
  },
  {
    id: 'event-004',
    type: 'waiting',
    tone: 'warning',
    displayName: '高橋 凛',
    message: '参加しました。開始を待っています',
    at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
  },
  {
    id: 'event-005',
    type: 'cleared',
    tone: 'success',
    displayName: '森川 悠',
    message: '全ステージをクリアしました',
    at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
  },
];

function createSnapshot(overrides = {}) {
  return buildHostDashboardSnapshot({
    room,
    stages,
    participantStatus,
    events,
    hostUserId: room.host_user_id,
    connection: 'live',
    ...overrides,
  });
}

const dashboard = setupHostDashboardUi({
  onRefresh: async () => {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return createSnapshot({ updatedAt: new Date().toISOString() });
  },
  onEndRoom: async ({ roomCode }) => {
    console.info(`[host-dashboard preview] end room ${roomCode}`);
    dashboard.close();
  },
});

dashboard.open(createSnapshot());

window.hostDashboardPreview = {
  open: () => dashboard.open(createSnapshot()),
  update: (snapshot) => dashboard.update(snapshot),
  close: () => dashboard.close(),
};
