import './room-ui.css';
import { deleteRoom, getRoom, heartbeatRoom, isRoomMemberOffline, leaveRoom, ROOM_HEARTBEAT_INTERVAL_MS, setRoomStages, startRoom, subscribeToRoom } from './room-service.js';

function createLobby() {
  const screen = document.createElement('section');
  screen.className = 'room-lobby-screen';
  screen.hidden = true;
  screen.setAttribute('aria-labelledby', 'room-lobby-title');
  screen.innerHTML = `
    <div class="room-lobby-card">
      <p class="room-lobby-eyebrow">CLASSROOM / ROOM</p>
      <h1 id="room-lobby-title">ルーム待機画面</h1>
      <p class="room-lobby-code-label">ルームID</p>
      <p class="room-lobby-code"></p>
      <p class="room-lobby-status" role="status" aria-live="polite">ルーム情報を読み込んでいます…</p>
      <section class="room-lobby-stage-area" aria-label="プレイステージ"></section>
      <p class="room-lobby-start-status" role="status" aria-live="polite"></p>
      <section class="room-lobby-members-area" aria-labelledby="room-lobby-members-title">
        <h2 id="room-lobby-members-title">参加者</h2>
        <ul class="room-lobby-members"></ul>
      </section>
      <div class="room-lobby-actions">
        <button class="room-lobby-refresh" type="button">再読み込み</button>
        <button class="room-lobby-leave" type="button">退出する</button>
      </div>
    </div>`;
  document.body.append(screen);
  return screen;
}

export function setupRoomLobbyUi({ onClose, onStart } = {}) {
  const screen = createLobby();
  const code = screen.querySelector('.room-lobby-code');
  const status = screen.querySelector('.room-lobby-status');
  const stageArea = screen.querySelector('.room-lobby-stage-area');
  const startStatus = screen.querySelector('.room-lobby-start-status');
  const membersList = screen.querySelector('.room-lobby-members');
  const refreshButton = screen.querySelector('.room-lobby-refresh');
  const leaveButton = screen.querySelector('.room-lobby-leave');

  let roomCode = null;
  let roomId = null;
  let userId = null;
  let stages = [];
  let unsubscribe = null;
  let pollTimer = null;
  let heartbeatTimer = null;
  let generation = 0;
  let busy = false;
  let refreshRequest = 0;
  let handledStartAt = null;
  let currentRoom = null;
  let selectedStageIds = [];
  let selectionInitialized = false;

  function setStatus(text, tone = '') {
    status.textContent = text;
    status.dataset.tone = tone;
  }

  function close() {
    generation += 1;
    unsubscribe?.();
    unsubscribe = null;
    if (pollTimer !== null) window.clearInterval(pollTimer);
    pollTimer = null;
    if (heartbeatTimer !== null) window.clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    screen.hidden = true;
    roomCode = null;
    roomId = null;
    currentRoom = null;
  }

  function renderMembers(room) {
    const stageNames = new Map(stages.map((stage) => [stage.id, stage.title || stage.id]));
    const activeMembers = (room.members ?? []).filter((member) => !member.left_at && !member.kicked_at);
    membersList.replaceChildren();

    if (!activeMembers.length) {
      const empty = document.createElement('li');
      empty.className = 'room-lobby-empty';
      empty.textContent = '参加者はいません。';
      membersList.append(empty);
    }

    for (const member of activeMembers) {
      const item = document.createElement('li');
      item.className = 'room-lobby-member';
      const name = document.createElement('strong');
      name.textContent = member.display_name;
      const details = document.createElement('span');
      const currentStage = member.current_stage_id
        ? stageNames.get(member.current_stage_id) || member.current_stage_id
        : '未開始';
      const presence = isRoomMemberOffline(member)
        ? 'オフライン'
        : member.is_playing ? 'プレイ中' : '待機中';
      details.textContent = `${presence} ・ ${currentStage} ・ クリア ${member.completed_stage_ids?.length ?? 0}`;
      item.append(name, details);

      const tags = [];
      if (member.user_id === room.created_by) tags.push('作成者');
      if (member.user_id === room.host_user_id) tags.push('ホスト');
      if (tags.length) {
        const badge = document.createElement('span');
        badge.className = 'room-lobby-member-badge';
        badge.textContent = tags.join(' / ');
        item.append(badge);
      }
      membersList.append(item);
    }
  }

  function renderStageControl(room) {
    stageArea.replaceChildren();
    if (!selectionInitialized) {
      selectedStageIds = Array.isArray(room.stage_ids) && room.stage_ids.length
        ? [...room.stage_ids]
        : room.stage_id ? [room.stage_id] : [];
      selectionInitialized = true;
    }
    const label = document.createElement('p');
    label.className = 'room-lobby-current-stage';
    const updateSequenceLabel = () => {
      const sequence = selectedStageIds
        .map((stageId) => stages.find((stage) => stage.id === stageId))
        .filter(Boolean);
      label.textContent = sequence.length
        ? `プレイ順：${sequence.map((stage) => stage.title || stage.id).join(' → ')}`
        : 'プレイするステージを選択してください。';
    };
    updateSequenceLabel();
    stageArea.append(label);
    const activePlayers = (room.members ?? []).filter((member) => (
      member.user_id !== room.host_user_id && !member.left_at && !member.kicked_at
    ));

    const startKey = room.started_at ? `${room.id}:${room.started_at}` : null;
    if (startKey && room.stage_id && handledStartAt !== startKey) {
      handledStartAt = startKey;
      if (room.host_user_id === userId) {
        startStatus.textContent = '開始を参加者へ通知しました。ホスト画面を開いています…';
        onStart?.({ roomCode, stageId: room.stage_id, isHost: true });
      } else {
        startStatus.textContent = 'ホストが開始しました。ゲームを開いています…';
        onStart?.({ roomCode, stageId: room.stage_id, isHost: false });
      }
    }

    if (room.host_user_id !== userId) {
      if (!room.started_at) {
        startStatus.textContent = room.stage_id
          ? 'ホストが開始するまでお待ちください。'
          : 'ホストがステージを選ぶまでお待ちください。';
      }
      return;
    }

    const form = document.createElement('form');
    form.className = 'room-lobby-stage-form';
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'room-lobby-stage-options';
    fieldset.disabled = Boolean(room.started_at);
    const legend = document.createElement('legend');
    legend.textContent = 'プレイするステージ（チェックした順にプレイ）';
    fieldset.append(legend);
    const hint = document.createElement('p');
    hint.className = 'room-lobby-stage-order-hint';
    hint.textContent = '保存済みの順番を変えるときは、いったんチェックをすべて外してから、希望する順に付け直してください。';
    fieldset.append(hint);
    const stageControls = [];
    let startButton = null;
    let configuredStageIds = Array.isArray(room.stage_ids) && room.stage_ids.length
      ? [...room.stage_ids]
      : room.stage_id ? [room.stage_id] : [];
    const isSelectionSaved = () => selectedStageIds.length === configuredStageIds.length
      && selectedStageIds.every((id, index) => id === configuredStageIds[index]);
    const updateStartButton = () => {
      if (!startButton) return;
      const unsavedOrder = !isSelectionSaved();
      startButton.disabled = configuredStageIds.length === 0
        || unsavedOrder
        || Boolean(room.started_at)
        || activePlayers.length === 0;
      startButton.textContent = room.started_at
        ? 'プレイ中'
        : unsavedOrder ? '先にステージ順を保存してください' : '選択した順番でプレイ開始';
    };

    for (const [index, stage] of stages.entries()) {
      const option = document.createElement('div');
      option.className = 'room-lobby-stage-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `room-lobby-stage-${index}`;
      checkbox.value = stage.id;
      checkbox.checked = selectedStageIds.includes(stage.id);
      const checkboxLabel = document.createElement('label');
      checkboxLabel.htmlFor = checkbox.id;
      const title = document.createElement('span');
      title.textContent = `Stage ${String(stage.number).padStart(2, '0')} — ${stage.title}`;
      checkboxLabel.append(title);
      const order = document.createElement('span');
      order.className = 'room-lobby-stage-order';
      option.append(checkbox, checkboxLabel, order);
      fieldset.append(option);
      stageControls.push({ stage, checkbox, order });
    }
    const apply = document.createElement('button');
    apply.type = 'submit';
    apply.textContent = '選択したステージを設定';
    apply.disabled = stages.length === 0 || selectedStageIds.length === 0 || Boolean(room.started_at);
    const result = document.createElement('span');
    result.className = 'room-lobby-stage-result';
    form.append(fieldset, apply, result);

    const updateSelectionControls = () => {
      updateSequenceLabel();
      for (const control of stageControls) {
        const orderIndex = selectedStageIds.indexOf(control.stage.id);
        control.checkbox.checked = orderIndex !== -1;
        control.order.textContent = orderIndex === -1 ? '未選択' : `${orderIndex + 1}番目`;
      }
      apply.disabled = selectedStageIds.length === 0 || Boolean(room.started_at);
      updateStartButton();
    };

    for (const control of stageControls) {
      control.checkbox.addEventListener('change', () => {
        if (control.checkbox.checked) {
          if (!selectedStageIds.includes(control.stage.id)) selectedStageIds.push(control.stage.id);
        } else {
          selectedStageIds = selectedStageIds.filter((id) => id !== control.stage.id);
        }
        updateSelectionControls();
      });
    }
    updateSelectionControls();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (selectedStageIds.length === 0) {
        result.textContent = 'ステージを1つ以上選んでください。';
        return;
      }
      apply.disabled = true;
      result.textContent = '設定中…';
      try {
        await setRoomStages(roomCode, selectedStageIds);
        configuredStageIds = [...selectedStageIds];
        result.textContent = 'ステージのプレイ順を保存しました。';
        updateStartButton();
      } catch (error) {
        result.textContent = error.message || 'ステージを設定できませんでした。';
      } finally {
        apply.disabled = selectedStageIds.length === 0 || Boolean(room.started_at);
      }
    });
    stageArea.append(form);

    startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.className = 'room-lobby-start';
    updateStartButton();
    startButton.addEventListener('click', async () => {
      if (configuredStageIds.length === 0 || !isSelectionSaved() || room.started_at) return;
      startButton.disabled = true;
      startButton.textContent = '開始しています…';
      try {
        await startRoom(roomCode);
        await refresh();
      } catch (error) {
        startStatus.textContent = error.message || 'ステージを開始できませんでした。';
        startStatus.dataset.tone = 'error';
        startButton.disabled = false;
        startButton.textContent = '選択したステージを開始';
      }
    });
    stageArea.append(startButton);
    startStatus.textContent = room.started_at
      ? '開始を参加者へ通知しました。ホストは待機画面に残ります。'
      : activePlayers.length === 0 ? '開始できる参加者がルームにいません。' : '';
    startStatus.dataset.tone = room.started_at ? 'success' : '';
  }

  async function refresh(expectedGeneration = generation) {
    if (!roomCode) return;
    const currentRequest = ++refreshRequest;
    try {
      const room = await getRoom(roomCode);
      if (expectedGeneration !== generation || screen.hidden || currentRequest !== refreshRequest) return;
      roomId = room.id;
      currentRoom = room;
      leaveButton.textContent = room.created_by === userId ? 'ルームを終了' : '退出する';
      renderStageControl(room);
      renderMembers(room);
      setStatus('ルームは待機中です。参加者の変更は自動で反映されます。', 'success');
    } catch (error) {
      if (expectedGeneration !== generation || currentRequest !== refreshRequest) return;
      if (error.code === 'ROOM_NOT_FOUND') {
        close();
        onClose?.({ roomDeleted: true });
        return;
      }
      setStatus(error.message || 'ルーム情報を取得できませんでした。', 'error');
    } finally {
      if (currentRequest === refreshRequest) refreshButton.disabled = false;
    }
  }

  async function open(nextRoomCode, { currentUserId, stageOptions = [] } = {}) {
    close();
    generation += 1;
    const currentGeneration = generation;
    roomCode = String(nextRoomCode);
    userId = currentUserId;
    stages = stageOptions;
    selectedStageIds = [];
    selectionInitialized = false;
    const heartbeatCode = roomCode;
    const sendHeartbeat = () => heartbeatRoom(heartbeatCode).catch((error) => {
      console.warn('[room lobby] heartbeat failed', error);
    });
    void sendHeartbeat();
    heartbeatTimer = window.setInterval(sendHeartbeat, ROOM_HEARTBEAT_INTERVAL_MS);
    code.textContent = roomCode;
    screen.hidden = false;
    membersList.replaceChildren();
    stageArea.replaceChildren();
    setStatus('ルーム情報を読み込んでいます…');

    try {
      const initialRoom = await getRoom(roomCode);
      if (currentGeneration !== generation) return;
      roomId = initialRoom.id;
      currentRoom = initialRoom;
      leaveButton.textContent = initialRoom.created_by === userId ? 'ルームを終了' : '退出する';
      renderStageControl(initialRoom);
      renderMembers(initialRoom);
      setStatus('ルームは待機中です。参加者の変更は自動で反映されます。', 'success');
      const stopSubscription = await subscribeToRoom(roomId, () => refresh(currentGeneration), (subscriptionStatus) => {
        if (subscriptionStatus === 'CHANNEL_ERROR' || subscriptionStatus === 'TIMED_OUT') {
          setStatus('リアルタイム接続に失敗しました。再読み込みで最新状態を取得できます。', 'error');
        }
      });
      if (currentGeneration !== generation) {
        stopSubscription();
        return;
      }
      unsubscribe = stopSubscription;
      pollTimer = window.setInterval(() => refresh(currentGeneration), 5000);
      await refresh(currentGeneration);
    } catch (error) {
      if (currentGeneration === generation) {
        setStatus(error.message || 'ルームに接続できませんでした。', 'error');
      }
    }
  }

  refreshButton.addEventListener('click', async () => {
    refreshButton.disabled = true;
    setStatus('最新のルーム情報を読み込んでいます…');
    await refresh();
  });
  leaveButton.addEventListener('click', async () => {
    if (!roomCode || busy) return;
    busy = true;
    leaveButton.disabled = true;
    setStatus('ルームから退出しています…');
    try {
      if (currentRoom?.created_by === userId) await deleteRoom(roomCode);
      else await leaveRoom(roomCode);
      close();
      onClose?.();
    } catch (error) {
      setStatus(error.message || '退出できませんでした。', 'error');
    } finally {
      busy = false;
      leaveButton.disabled = false;
    }
  });

  return { open, close };
}
