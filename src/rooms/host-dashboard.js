import './host-dashboard.css';

const STATUS_META = {
  waiting: { label: '開始待ち', tone: 'waiting' },
  playing: { label: 'プレイ中', tone: 'playing' },
  cleared: { label: 'クリア', tone: 'cleared' },
  gameover: { label: 'ゲームオーバー', tone: 'gameover' },
  offline: { label: 'オフライン', tone: 'offline' },
};

const STATUS_ALIASES = {
  active: 'playing',
  complete: 'cleared',
  completed: 'cleared',
  done: 'cleared',
  failed: 'gameover',
  disconnected: 'offline',
  idle: 'waiting',
};

const CONNECTION_LABEL = {
  live: 'LIVE',
  syncing: 'SYNCING',
  offline: 'OFFLINE',
};

const EVENT_TONE = {
  cleared: 'success',
  success: 'success',
  gameover: 'danger',
  failed: 'danger',
  error: 'danger',
  offline: 'warning',
  waiting: 'warning',
  warning: 'warning',
};

const SHELL = `
  <div class="host-dashboard-bg" aria-hidden="true">
    <span class="host-dashboard-grid"></span>
    <span class="host-dashboard-glow host-dashboard-glow--mint"></span>
    <span class="host-dashboard-glow host-dashboard-glow--sky"></span>
  </div>
  <div class="host-dashboard-shell">
    <header class="host-dashboard-header">
      <div class="host-dashboard-brand">
        <span class="host-dashboard-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <div>
          <p class="host-dashboard-eyebrow">SHORTCUT://DUNGEON <span>/</span> MULTIPLAYER</p>
          <h1 id="host-dashboard-title">HOST CONTROL ROOM</h1>
        </div>
      </div>
      <div class="host-dashboard-session">
        <div class="host-dashboard-live" data-connection="live">
          <span class="host-dashboard-live-dot" aria-hidden="true"></span>
          <span class="host-dashboard-live-label">LIVE</span>
        </div>
        <div class="host-dashboard-room">
          <span>ROOM</span>
          <strong data-room-code>----</strong>
        </div>
        <button class="host-dashboard-icon-button" type="button" data-action="refresh" aria-label="参加者の状態を更新">
          <span aria-hidden="true">&#8635;</span>
        </button>
        <button class="host-dashboard-stop" type="button" data-action="stop-play">
          <span aria-hidden="true">&#9632;</span>
          プレイ終了
        </button>
        <button class="host-dashboard-end" type="button" data-action="end">
          <span aria-hidden="true">&#10005;</span>
          ルームを終了
        </button>
      </div>
    </header>

    <div class="host-dashboard-layout">
      <main class="host-dashboard-main">
        <section class="host-dashboard-hero">
          <div class="host-dashboard-hero-copy">
            <p class="host-dashboard-kicker">MISSION IN PROGRESS</p>
            <div class="host-dashboard-stage-line">
              <span class="host-dashboard-stage-no" data-stage-number>STAGE --</span>
              <h2 data-stage-title>ステージを準備中</h2>
            </div>
            <p class="host-dashboard-lede" data-room-note>参加者の進捗をリアルタイムで確認できます。</p>
            <div class="host-dashboard-progress">
              <div class="host-dashboard-progress-head">
                <span>ROOM PROGRESS</span>
                <strong data-progress-percent>0%</strong>
              </div>
              <div class="host-dashboard-progress-track" role="progressbar" aria-label="ルーム全体の進捗" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-progress-bar>
                <span></span>
              </div>
            </div>
          </div>
          <div class="host-dashboard-ring" data-ring aria-hidden="true">
            <div>
              <strong data-ring-percent>0%</strong>
              <span>CLEAR</span>
            </div>
          </div>
          <dl class="host-dashboard-stats">
            <div class="host-dashboard-stat host-dashboard-stat--total">
              <dt>参加者</dt>
              <dd data-stat="total">0</dd>
            </div>
            <div class="host-dashboard-stat host-dashboard-stat--playing">
              <dt>プレイ中</dt>
              <dd data-stat="playing">0</dd>
            </div>
            <div class="host-dashboard-stat host-dashboard-stat--cleared">
              <dt>クリア</dt>
              <dd data-stat="cleared">0</dd>
            </div>
            <div class="host-dashboard-stat host-dashboard-stat--attention">
              <dt>要確認</dt>
              <dd data-stat="attention">0</dd>
            </div>
          </dl>
        </section>

        <section class="host-dashboard-panel host-dashboard-roster">
          <header class="host-dashboard-panel-head">
            <div>
              <p class="host-dashboard-kicker">PARTICIPANTS</p>
              <h2>参加者のプレイ状況</h2>
            </div>
            <span class="host-dashboard-panel-tag"><i aria-hidden="true"></i> LIVE TRACKING</span>
          </header>
          <div class="host-dashboard-table-head" aria-hidden="true">
            <span>参加者</span>
            <span>現在地</span>
            <span>状態</span>
            <span>進行</span>
            <span>更新</span>
          </div>
          <ul class="host-dashboard-list" data-participants></ul>
          <p class="host-dashboard-empty" data-empty hidden>参加者はまだいません。</p>
        </section>
      </main>

      <aside class="host-dashboard-side">
        <section class="host-dashboard-panel host-dashboard-stage-board">
          <header class="host-dashboard-panel-head">
            <div>
              <p class="host-dashboard-kicker">STAGE BOARD</p>
              <h2>ステージ状況</h2>
            </div>
          </header>
          <ol class="host-dashboard-stage-list" data-stages></ol>
        </section>

        <section class="host-dashboard-panel host-dashboard-feed">
          <header class="host-dashboard-panel-head">
            <div>
              <p class="host-dashboard-kicker">ACTIVITY</p>
              <h2>最新の動き</h2>
            </div>
          </header>
          <ol class="host-dashboard-event-list" data-events></ol>
          <p class="host-dashboard-empty host-dashboard-empty--compact" data-events-empty hidden>まだアクティビティはありません。</p>
        </section>

        <section class="host-dashboard-sync">
          <span class="host-dashboard-sync-dot" aria-hidden="true"></span>
          <p data-sync role="status" aria-live="polite">自動更新を待機中</p>
          <time data-sync-time>--:--</time>
        </section>
      </aside>
    </div>

    <footer class="host-dashboard-footer">
      <p>HOST VIEW / 参加者の画面にはこの画面は表示されません</p>
      <p>最終同期 <time data-last-sync>--:--:--</time></p>
    </footer>
  </div>`;

function createElement(tag, className = '', text = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function asText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clamp01(value) {
  if (!Number.isFinite(value)) return null;
  return clamp(value, 0, 1);
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeStatus(value) {
  const raw = asText(value).toLowerCase();
  const status = STATUS_ALIASES[raw] || raw;
  return STATUS_META[status] ? status : 'waiting';
}

function formatClock(value, withSeconds = true) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    ...(withSeconds ? { second: '2-digit' } : {}),
    hour12: false,
  }).format(date);
}

function stageNumberLabel(number) {
  const value = positiveNumber(number);
  return value ? String(Math.round(value)).padStart(2, '0') : '--';
}

function normalizeStages(value, totalStages) {
  const source = Array.isArray(value) ? value : [];
  const stages = source
    .map((stage, index) => ({
      id: stage?.id != null ? String(stage.id) : `stage-${index + 1}`,
      number: positiveNumber(stage?.number) || index + 1,
      title: asText(stage?.title ?? stage?.name),
    }))
    .sort((a, b) => a.number - b.number);

  if (stages.length > 0) return stages;

  return Array.from({ length: totalStages }, (_, index) => ({
    id: `stage-${index + 1}`,
    number: index + 1,
    title: '',
  }));
}

function normalizeParticipant(participant, index, stages, totalStages) {
  const completedStageIds = Array.isArray(participant?.completedStageIds)
    ? participant.completedStageIds.map(String)
    : [];
  const rawStageId = participant?.stageId ?? participant?.currentStageId ?? participant?.current_stage_id;
  const stageId = rawStageId != null && String(rawStageId) ? String(rawStageId) : null;
  const matchedStage = stages.find((stage) => stage.id === stageId);
  const status = normalizeStatus(participant?.status);
  let completedCount = Number.isFinite(Number(participant?.completedCount))
    ? Number(participant.completedCount)
    : completedStageIds.length;

  if (status === 'cleared' && completedCount === 0) completedCount = totalStages;
  completedCount = clamp(Math.round(completedCount), 0, totalStages);

  const progress = clamp01(Number(participant?.progress));
  const updatedAt = participant?.updatedAt ?? participant?.updated_at ?? null;

  return {
    userId: asText(participant?.userId ?? participant?.user_id, `participant-${index + 1}`),
    displayName: asText(participant?.displayName ?? participant?.display_name, `参加者 ${index + 1}`),
    status,
    stageId,
    stageNumber: positiveNumber(participant?.stageNumber) || matchedStage?.number || null,
    stageTitle: asText(participant?.stageTitle, matchedStage?.title || ''),
    completedStageIds,
    completedCount,
    totalStages,
    progress: progress ?? (totalStages > 0 ? completedCount / totalStages : 0),
    updatedAt,
    lastAction: asText(participant?.lastAction ?? participant?.last_action),
  };
}

function normalizeSnapshot(snapshot = {}) {
  const requestedTotal = positiveNumber(snapshot.totalStages) || 5;
  const stages = normalizeStages(snapshot.stages, requestedTotal);
  const totalStages = Math.max(stages.length, requestedTotal);
  const rawStage = snapshot.stage && typeof snapshot.stage === 'object' ? snapshot.stage : {};
  const rawStageId = rawStage.id ?? snapshot.stageId ?? snapshot.stage_id;
  const stageId = rawStageId != null && String(rawStageId) ? String(rawStageId) : null;
  const matchedStage = stages.find((stage) => stage.id === stageId);
  const stageNumber = positiveNumber(rawStage.number) || matchedStage?.number || null;
  const stageTitle = asText(rawStage.title ?? rawStage.name, matchedStage?.title || '');
  const participants = (Array.isArray(snapshot.participants) ? snapshot.participants : [])
    .map((participant, index) => normalizeParticipant(participant, index, stages, totalStages));
  const events = (Array.isArray(snapshot.events) ? snapshot.events : [])
    .map((event, index) => ({
      id: asText(event?.id, `event-${index + 1}`),
      type: asText(event?.type, 'info'),
      tone: asText(event?.tone, EVENT_TONE[asText(event?.type).toLowerCase()] || 'info'),
      displayName: asText(event?.displayName ?? event?.display_name),
      message: asText(event?.message),
      at: event?.at ?? event?.createdAt ?? null,
    }))
    .filter((event) => event.message);
  const connection = ['live', 'syncing', 'offline'].includes(snapshot.connection)
    ? snapshot.connection
    : 'live';

  return {
    roomCode: asText(snapshot.roomCode ?? snapshot.room_code, '----'),
    stage: {
      id: stageId,
      number: stageNumber,
      title: stageTitle,
    },
    stages,
    totalStages,
    participants,
    events,
    connection,
    note: asText(snapshot.note),
    updatedAt: snapshot.updatedAt || new Date().toISOString(),
  };
}

function summarizeParticipants(participants) {
  const summary = {
    total: participants.length,
    playing: 0,
    cleared: 0,
    gameover: 0,
    waiting: 0,
    offline: 0,
    completedStages: 0,
    goalStages: 0,
  };

  for (const participant of participants) {
    summary[participant.status] += 1;
    summary.completedStages += participant.completedCount;
    summary.goalStages += participant.totalStages;
  }

  summary.attention = summary.gameover + summary.offline;
  summary.percent = summary.goalStages > 0
    ? Math.round((summary.completedStages / summary.goalStages) * 100)
    : 0;
  return summary;
}

function buildStageBoard(stages, participants, currentStageId) {
  const board = stages.map((stage) => ({
    ...stage,
    current: stage.id === currentStageId,
    playing: 0,
    gameover: 0,
    cleared: 0,
  }));
  const byId = new Map(board.map((stage) => [stage.id, stage]));

  for (const participant of participants) {
    const activeStage = participant.stageId ? byId.get(participant.stageId) : null;
    if (activeStage && participant.status === 'playing') activeStage.playing += 1;
    if (activeStage && participant.status === 'gameover') activeStage.gameover += 1;

    for (const stageId of participant.completedStageIds) {
      const clearedStage = byId.get(stageId);
      if (clearedStage) clearedStage.cleared += 1;
    }
  }

  return board;
}

function participantStageLabel(participant) {
  if (participant.status === 'cleared') return '全ステージクリア';
  if (participant.status === 'offline') return '接続待ち';
  if (!participant.stageNumber && !participant.stageTitle) return '開始待ち';
  const title = participant.stageTitle ? ` · ${participant.stageTitle}` : '';
  return `STAGE ${stageNumberLabel(participant.stageNumber)}${title}`;
}

function participantActionLabel(participant) {
  if (participant.lastAction) return participant.lastAction;
  if (participant.status === 'cleared') return 'ルームのゴールに到達';
  if (participant.status === 'gameover') return 'ステージをやり直し中';
  if (participant.status === 'offline') return '最終状態を表示しています';
  if (participant.status === 'waiting') return 'ホストの開始を待っています';
  return 'ステージを攻略中';
}

function collectEvents(snapshot) {
  if (snapshot.events.length > 0) return snapshot.events.slice(0, 6);

  return snapshot.participants
    .filter((participant) => participant.lastAction)
    .map((participant) => ({
      id: `${participant.userId}-${participant.updatedAt || participant.lastAction}`,
      tone: participant.status === 'gameover' ? 'danger' : participant.status === 'cleared' ? 'success' : 'info',
      displayName: participant.displayName,
      message: participant.lastAction,
      at: participant.updatedAt,
    }))
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())
    .slice(0, 6);
}

export function buildHostDashboardSnapshot({
  room,
  stages = [],
  participantStatus = {},
  events = [],
  hostUserId = room?.host_user_id,
  connection = 'live',
  updatedAt,
} = {}) {
  if (!room) throw new TypeError('room is required');
  const totalStages = stages.length || 5;
  const hostId = hostUserId != null ? String(hostUserId) : '';
  const members = Array.isArray(room.members) ? room.members : [];
  const participants = members
    .filter((member) => {
      if (member.left_at || member.kicked_at) return false;
      if (hostId && String(member.user_id) === hostId) return false;
      return true;
    })
    .map((member) => {
      const state = participantStatus[member.user_id] || {};
      const completedStageIds = Array.isArray(state.completedStageIds)
        ? state.completedStageIds.map(String)
        : Array.isArray(member.completed_stage_ids)
          ? member.completed_stage_ids.map(String)
          : [];
      const stageId = state.stageId ?? member.current_stage_id ?? null;
      const status = state.status
        || (completedStageIds.length >= totalStages && totalStages > 0
          ? 'cleared'
          : stageId
            ? 'playing'
            : 'waiting');
      const matchedStage = stages.find((stage) => String(stage.id) === String(stageId));

      return {
        userId: member.user_id,
        displayName: state.displayName || member.display_name,
        status,
        stageId,
        stageNumber: state.stageNumber ?? matchedStage?.number ?? null,
        stageTitle: state.stageTitle ?? matchedStage?.title ?? '',
        completedStageIds,
        completedCount: completedStageIds.length,
        progress: state.progress,
        updatedAt: state.updatedAt || member.updated_at || null,
        lastAction: state.lastAction || '',
      };
    });

  const stage = stages.find((entry) => String(entry.id) === String(room.stage_id)) || null;

  return {
    roomCode: room.room_code,
    stage: stage || { id: room.stage_id, number: null, title: '' },
    stages,
    totalStages,
    participants,
    events,
    connection,
    updatedAt: updatedAt || new Date().toISOString(),
  };
}

export function setupHostDashboardUi({ onRefresh, onStopPlay, onEndRoom } = {}) {
  const screen = document.createElement('section');
  screen.className = 'host-dashboard';
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-modal', 'true');
  screen.setAttribute('aria-labelledby', 'host-dashboard-title');
  screen.setAttribute('tabindex', '-1');
  screen.hidden = true;
  screen.innerHTML = SHELL;
  document.body.append(screen);

  const roomCode = screen.querySelector('[data-room-code]');
  const live = screen.querySelector('.host-dashboard-live');
  const liveLabel = screen.querySelector('.host-dashboard-live-label');
  const refreshButton = screen.querySelector('[data-action="refresh"]');
  const stopPlayButton = screen.querySelector('[data-action="stop-play"]');
  const endButton = screen.querySelector('[data-action="end"]');
  const stageNumber = screen.querySelector('[data-stage-number]');
  const stageTitle = screen.querySelector('[data-stage-title]');
  const roomNote = screen.querySelector('[data-room-note]');
  const progressPercent = screen.querySelector('[data-progress-percent]');
  const progressBar = screen.querySelector('[data-progress-bar]');
  const ring = screen.querySelector('[data-ring]');
  const ringPercent = screen.querySelector('[data-ring-percent]');
  const participantsList = screen.querySelector('[data-participants]');
  const emptyParticipants = screen.querySelector('[data-empty]');
  const stagesList = screen.querySelector('[data-stages]');
  const eventsList = screen.querySelector('[data-events]');
  const emptyEvents = screen.querySelector('[data-events-empty]');
  const syncMessage = screen.querySelector('[data-sync]');
  const syncTime = screen.querySelector('[data-sync-time]');
  const lastSync = screen.querySelector('[data-last-sync]');
  const stats = new Map(
    [...screen.querySelectorAll('[data-stat]')].map((element) => [element.dataset.stat, element]),
  );

  refreshButton.disabled = typeof onRefresh !== 'function';
  if (typeof onRefresh !== 'function') refreshButton.title = '更新処理は未接続です';
  stopPlayButton.disabled = typeof onStopPlay !== 'function';
  if (typeof onStopPlay !== 'function') stopPlayButton.title = 'プレイ終了処理は未接続です';
  endButton.disabled = typeof onEndRoom !== 'function';
  if (typeof onEndRoom !== 'function') endButton.title = '終了処理は未接続です';

  let snapshot = null;
  let syncing = false;
  let previousFocus = null;

  function setSyncMessage(text, tone = '') {
    syncMessage.textContent = text;
    syncMessage.dataset.tone = tone;
  }

  function setConnection(connection) {
    const value = ['live', 'syncing', 'offline'].includes(connection) ? connection : 'live';
    screen.dataset.connection = value;
    live.dataset.connection = value;
    liveLabel.textContent = CONNECTION_LABEL[value];
  }

  function renderParticipant(participant) {
    const meta = STATUS_META[participant.status] || STATUS_META.waiting;
    const item = createElement('li', `host-dashboard-participant host-dashboard-participant--${meta.tone}`);
    item.setAttribute(
      'aria-label',
      `${participant.displayName}、${meta.label}、${participant.completedCount}/${participant.totalStages} ステージクリア`,
    );

    const avatar = createElement('span', 'host-dashboard-avatar', Array.from(participant.displayName)[0] || '?');
    avatar.setAttribute('aria-hidden', 'true');

    const identity = createElement('div', 'host-dashboard-participant-identity');
    identity.append(
      createElement('strong', '', participant.displayName),
      createElement('span', 'host-dashboard-participant-action', participantActionLabel(participant)),
    );

    const stage = createElement('div', 'host-dashboard-participant-stage');
    stage.append(
      createElement('span', 'host-dashboard-cell-label', '現在地'),
      createElement('span', '', participantStageLabel(participant)),
    );

    const status = createElement('div', 'host-dashboard-status');
    status.append(
      createElement('i', 'host-dashboard-status-dot'),
      createElement('span', '', meta.label),
    );

    const progress = createElement('div', 'host-dashboard-participant-progress');
    const progressHead = createElement('div', 'host-dashboard-participant-progress-head');
    progressHead.append(
      createElement('span', 'host-dashboard-cell-label', '進行'),
      createElement('strong', '', `${participant.completedCount} / ${participant.totalStages}`),
    );
    const progressTrack = createElement('div', 'host-dashboard-mini-track');
    const progressFill = createElement('span');
    progressFill.style.width = `${Math.round(participant.progress * 100)}%`;
    progressTrack.append(progressFill);
    progressTrack.setAttribute('role', 'progressbar');
    progressTrack.setAttribute('aria-label', `${participant.displayName}の進捗`);
    progressTrack.setAttribute('aria-valuemin', '0');
    progressTrack.setAttribute('aria-valuemax', '100');
    progressTrack.setAttribute('aria-valuenow', String(Math.round(participant.progress * 100)));
    progress.append(progressHead, progressTrack);

    const updated = createElement('time', 'host-dashboard-participant-updated', formatClock(participant.updatedAt, false));
    if (participant.updatedAt) updated.dateTime = participant.updatedAt;
    updated.title = participant.updatedAt ? `${formatClock(participant.updatedAt)} 更新` : '更新時刻なし';

    item.append(avatar, identity, stage, status, progress, updated);
    return item;
  }

  function renderParticipants(participants) {
    participantsList.replaceChildren(...participants.map(renderParticipant));
    emptyParticipants.hidden = participants.length > 0;
  }

  function renderStages(snapshotValue) {
    const board = buildStageBoard(snapshotValue.stages, snapshotValue.participants, snapshotValue.stage.id);
    const items = board.map((stage) => {
      const item = createElement('li', `host-dashboard-stage-item${stage.current ? ' is-current' : ''}`);
      item.setAttribute(
        'aria-label',
        `ステージ${stage.number}${stage.title ? ` ${stage.title}` : ''}、プレイ中${stage.playing}人、失敗${stage.gameover}人、クリア${stage.cleared}人`,
      );

      const index = createElement('span', 'host-dashboard-stage-index', stageNumberLabel(stage.number));
      const body = createElement('div', 'host-dashboard-stage-body');
      const title = createElement('strong', '', stage.title || `STAGE ${stageNumberLabel(stage.number)}`);
      if (stage.current) title.append(createElement('span', 'host-dashboard-stage-current', 'NOW'));
      body.append(title);

      const counts = createElement('div', 'host-dashboard-stage-counts');
      if (stage.playing) {
        counts.append(createElement('span', 'host-dashboard-stage-chip host-dashboard-stage-chip--playing', `${stage.playing} 挑戦中`));
      }
      if (stage.gameover) {
        counts.append(createElement('span', 'host-dashboard-stage-chip host-dashboard-stage-chip--gameover', `${stage.gameover} 失敗`));
      }
      if (stage.cleared) {
        counts.append(createElement('span', 'host-dashboard-stage-chip host-dashboard-stage-chip--cleared', `${stage.cleared} クリア`));
      }
      if (!stage.playing && !stage.gameover && !stage.cleared) {
        counts.append(createElement('span', 'host-dashboard-stage-chip host-dashboard-stage-chip--idle', '待機'));
      }
      body.append(counts);
      item.append(index, body);
      return item;
    });

    stagesList.replaceChildren(...items);
  }

  function renderEvents(snapshotValue) {
    const events = collectEvents(snapshotValue);
    const items = events.map((event) => {
      const item = createElement('li', `host-dashboard-event host-dashboard-event--${event.tone}`);
      const dot = createElement('span', 'host-dashboard-event-dot');
      dot.setAttribute('aria-hidden', 'true');
      const body = createElement('div', 'host-dashboard-event-body');
      if (event.displayName) body.append(createElement('strong', '', event.displayName));
      body.append(createElement('p', '', event.message));
      const time = createElement('time', 'host-dashboard-event-time', formatClock(event.at, false));
      if (event.at) time.dateTime = event.at;
      item.append(dot, body, time);
      return item;
    });

    eventsList.replaceChildren(...items);
    emptyEvents.hidden = events.length > 0;
  }

  function render(nextSnapshot) {
    if (!nextSnapshot) return;
    snapshot = nextSnapshot;
    const summary = summarizeParticipants(nextSnapshot.participants);
    const stage = nextSnapshot.stage;

    roomCode.textContent = nextSnapshot.roomCode;
    setConnection(nextSnapshot.connection);
    stageNumber.textContent = `STAGE ${stageNumberLabel(stage.number)}`;
    stageTitle.textContent = stage.title || 'ステージ未設定';
    roomNote.textContent = nextSnapshot.note
      || (stage.title
        ? '参加者の現在地とクリア状況をリアルタイムで追跡しています。'
        : '参加者がステージを開始すると、ここに進捗が表示されます。');

    progressPercent.textContent = `${summary.percent}%`;
    progressBar.setAttribute('aria-valuenow', String(summary.percent));
    progressBar.firstElementChild.style.width = `${summary.percent}%`;
    ring.style.setProperty('--progress', String(summary.percent));
    ringPercent.textContent = `${summary.percent}%`;

    stats.get('total').textContent = String(summary.total);
    stats.get('playing').textContent = String(summary.playing);
    stats.get('cleared').textContent = String(summary.cleared);
    stats.get('attention').textContent = String(summary.attention);

    renderParticipants(nextSnapshot.participants);
    renderStages(nextSnapshot);
    renderEvents(nextSnapshot);

    const syncAt = formatClock(nextSnapshot.updatedAt);
    syncTime.textContent = syncAt;
    syncTime.dateTime = nextSnapshot.updatedAt;
    lastSync.textContent = syncAt;
    lastSync.dateTime = nextSnapshot.updatedAt;

    if (nextSnapshot.connection === 'offline') {
      setSyncMessage('接続が切れています。再接続を待っています。', 'error');
    } else if (nextSnapshot.connection === 'syncing') {
      setSyncMessage('最新の状態を取得しています…', 'syncing');
    } else {
      setSyncMessage('自動更新を待機中', 'live');
    }
  }

  async function handleRefresh() {
    if (syncing || typeof onRefresh !== 'function') return;
    syncing = true;
    refreshButton.disabled = true;
    setConnection('syncing');
    setSyncMessage('最新の状態を取得しています…', 'syncing');

    try {
      const nextSnapshot = await onRefresh({ roomCode: snapshot?.roomCode, snapshot });
      if (nextSnapshot) {
        render(normalizeSnapshot(nextSnapshot));
      } else if (snapshot) {
        render(normalizeSnapshot({ ...snapshot, updatedAt: new Date().toISOString(), connection: 'live' }));
      }
    } catch (error) {
      console.error('[host-dashboard refresh]', error);
      setConnection('offline');
      setSyncMessage(error?.message || '更新に失敗しました。', 'error');
    } finally {
      syncing = false;
      refreshButton.disabled = false;
    }
  }

  async function handleEndRoom() {
    if (typeof onEndRoom !== 'function') return;
    endButton.disabled = true;
    setSyncMessage('ルームの終了処理を実行しています…', 'syncing');

    try {
      await onEndRoom({ roomCode: snapshot?.roomCode, snapshot });
    } catch (error) {
      console.error('[host-dashboard end]', error);
      setSyncMessage(error?.message || 'ルームを終了できませんでした。', 'error');
    } finally {
      endButton.disabled = false;
    }
  }

  async function handleStopPlay() {
    if (typeof onStopPlay !== 'function') return;
    stopPlayButton.disabled = true;
    setSyncMessage('全員を待機画面へ戻しています…', 'syncing');

    try {
      await onStopPlay({ roomCode: snapshot?.roomCode, snapshot });
    } catch (error) {
      console.error('[host-dashboard stop play]', error);
      setSyncMessage(error?.message || 'プレイを終了できませんでした。', 'error');
    } finally {
      stopPlayButton.disabled = false;
    }
  }

  function open(nextSnapshot) {
    previousFocus = document.activeElement;
    document.body.classList.add('host-dashboard-open');
    screen.hidden = false;
    render(normalizeSnapshot(nextSnapshot));
    screen.focus({ preventScroll: true });
  }

  function update(nextSnapshot) {
    if (!snapshot) return;
    render(normalizeSnapshot(nextSnapshot));
  }

  function close() {
    if (screen.hidden) return;
    screen.hidden = true;
    snapshot = null;
    document.body.classList.remove('host-dashboard-open');
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus({ preventScroll: true });
    }
    previousFocus = null;
  }

  function destroy() {
    close();
    screen.remove();
  }

  refreshButton.addEventListener('click', handleRefresh);
  stopPlayButton.addEventListener('click', handleStopPlay);
  endButton.addEventListener('click', handleEndRoom);

  return {
    open,
    update,
    close,
    destroy,
    get isOpen() {
      return !screen.hidden;
    },
  };
}
