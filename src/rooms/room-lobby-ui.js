import './room-ui.css';
import { getRoom, leaveRoom, setRoomStage, startRoom, subscribeToRoom } from './room-service.js';

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
  let generation = 0;
  let busy = false;
  let handledStartAt = null;

  function setStatus(text, tone = '') {
    status.textContent = text;
    status.dataset.tone = tone;
  }

  function close() {
    generation += 1;
    unsubscribe?.();
    unsubscribe = null;
    screen.hidden = true;
    roomCode = null;
    roomId = null;
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
      details.textContent = `${currentStage} ・ クリア ${member.completed_stage_ids?.length ?? 0}`;
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
    const selectedStage = stages.find((stage) => stage.id === room.stage_id);
    const label = document.createElement('p');
    label.className = 'room-lobby-current-stage';
    label.textContent = `選択中のステージ：${selectedStage?.title || room.stage_id || '未選択'}`;
    stageArea.append(label);

    if (room.host_user_id !== userId) {
      startStatus.textContent = room.started_at
        ? 'ステージを開始しています…'
        : room.stage_id ? 'ホストが開始するまでお待ちください。' : 'ホストがステージを選ぶまでお待ちください。';
      return;
    }

    const form = document.createElement('form');
    form.className = 'room-lobby-stage-form';
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'プレイするステージ');
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'ステージを選択';
    select.append(placeholder);
    for (const stage of stages) {
      const option = document.createElement('option');
      option.value = stage.id;
      option.textContent = `Stage ${String(stage.number).padStart(2, '0')} — ${stage.title}`;
      option.selected = stage.id === room.stage_id;
      select.append(option);
    }
    const apply = document.createElement('button');
    apply.type = 'submit';
    apply.textContent = 'ステージを設定';
    apply.disabled = stages.length === 0;
    const result = document.createElement('span');
    result.className = 'room-lobby-stage-result';
    form.append(select, apply, result);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!select.value) {
        result.textContent = 'ステージを選んでください。';
        return;
      }
      apply.disabled = true;
      result.textContent = '設定中…';
      try {
        await setRoomStage(roomCode, select.value);
        result.textContent = 'ステージを設定しました。';
      } catch (error) {
        result.textContent = error.message || 'ステージを設定できませんでした。';
      } finally {
        apply.disabled = false;
      }
    });
    stageArea.append(form);

    const startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.className = 'room-lobby-start';
    startButton.textContent = room.started_at ? 'ステージ開始済み' : '選択したステージを開始';
    startButton.disabled = !room.stage_id || Boolean(room.started_at);
    startButton.addEventListener('click', async () => {
      if (!room.stage_id || room.started_at) return;
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
    startStatus.textContent = room.started_at ? '参加者へ開始を通知しました。' : '';
    startStatus.dataset.tone = room.started_at ? 'success' : '';

    const startKey = room.started_at ? `${room.id}:${room.started_at}` : null;
    if (startKey && room.stage_id && handledStartAt !== startKey) {
      handledStartAt = startKey;
      onStart?.({ roomCode, stageId: room.stage_id });
    }
  }

  async function refresh(expectedGeneration = generation) {
    if (!roomCode) return;
    try {
      const room = await getRoom(roomCode);
      if (expectedGeneration !== generation || screen.hidden) return;
      roomId = room.id;
      renderStageControl(room);
      renderMembers(room);
      setStatus('ルームは待機中です。参加者の変更は自動で反映されます。', 'success');
    } catch (error) {
      if (expectedGeneration !== generation) return;
      setStatus(error.message || 'ルーム情報を取得できませんでした。', 'error');
    }
  }

  async function open(nextRoomCode, { currentUserId, stageOptions = [] } = {}) {
    close();
    generation += 1;
    const currentGeneration = generation;
    roomCode = String(nextRoomCode);
    userId = currentUserId;
    stages = stageOptions;
    code.textContent = roomCode;
    screen.hidden = false;
    membersList.replaceChildren();
    stageArea.replaceChildren();
    setStatus('ルーム情報を読み込んでいます…');

    try {
      const initialRoom = await getRoom(roomCode);
      if (currentGeneration !== generation) return;
      roomId = initialRoom.id;
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
      await refresh(currentGeneration);
    } catch (error) {
      if (currentGeneration === generation) {
        setStatus(error.message || 'ルームに接続できませんでした。', 'error');
      }
    }
  }

  refreshButton.addEventListener('click', () => refresh());
  leaveButton.addEventListener('click', async () => {
    if (!roomCode || busy) return;
    busy = true;
    leaveButton.disabled = true;
    setStatus('ルームから退出しています…');
    try {
      await leaveRoom(roomCode);
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
