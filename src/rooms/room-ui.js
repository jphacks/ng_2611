import './room-ui.css';
import { createRoom, joinRoom } from './room-service.js';

function createDialog() {
  const dialog = document.createElement('dialog');
  dialog.className = 'room-entry-dialog';
  dialog.setAttribute('aria-labelledby', 'room-entry-title');
  dialog.innerHTML = `
    <form class="room-entry-form">
      <h2 id="room-entry-title"></h2>
      <p class="room-entry-description"></p>
      <label class="room-entry-field room-code-field">
        <span>ルームID（4桁）</span>
        <input name="roomCode" type="text" inputmode="numeric" autocomplete="off" pattern="[0-9]{4}" minlength="4" maxlength="4" placeholder="例：0123" required />
      </label>
      <label class="room-entry-field">
        <span>ルーム内の表示名</span>
        <input name="displayName" type="text" autocomplete="nickname" minlength="1" maxlength="40" placeholder="表示名" required />
      </label>
      <p class="room-entry-message" role="status" aria-live="polite"></p>
      <div class="room-entry-actions">
        <button class="room-entry-cancel" type="button">戻る</button>
        <button class="room-entry-submit" type="submit">送信</button>
      </div>
    </form>`;
  document.body.append(dialog);
  return dialog;
}

export function setupRoomUi({ onSuccess } = {}) {
  const dialog = createDialog();
  const form = dialog.querySelector('form');
  const title = dialog.querySelector('#room-entry-title');
  const description = dialog.querySelector('.room-entry-description');
  const codeField = dialog.querySelector('.room-code-field');
  const codeInput = form.elements.roomCode;
  const nameInput = form.elements.displayName;
  const message = dialog.querySelector('.room-entry-message');
  const submitButton = dialog.querySelector('.room-entry-submit');
  let mode = 'create';

  function setMessage(text = '', tone = '') {
    message.textContent = text;
    message.dataset.tone = tone;
  }

  function open(nextMode) {
    mode = nextMode;
    const isCreate = mode === 'create';
    title.textContent = isCreate ? 'ルームを作成' : 'ルームに参加';
    description.textContent = isCreate
      ? '4桁のルームIDと、ルーム内で使う表示名を入力してください。'
      : '参加するルームのIDと、ルーム内で使う表示名を入力してください。';
    codeField.hidden = false;
    codeInput.value = '';
    nameInput.value = '';
    submitButton.textContent = isCreate ? '作成する' : '参加する';
    setMessage();
    dialog.showModal();
    codeInput.focus();
  }

  dialog.querySelector('.room-entry-cancel').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.replace(/[^0-9]/g, '').slice(0, 4);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = { roomCode: codeInput.value, displayName: nameInput.value };
    submitButton.disabled = true;
    setMessage(mode === 'create' ? 'ルームを作成しています…' : 'ルームに参加しています…');

    try {
      const room = mode === 'create' ? await createRoom(payload) : await joinRoom(payload);
      dialog.close();
      onSuccess?.({ mode, room, displayName: payload.displayName.trim() });
    } catch (error) {
      console.error(`[room ${mode}]`, error);
      setMessage(error.message || '処理に失敗しました。入力内容を確認して、もう一度お試しください。');
    } finally {
      if (dialog.open) submitButton.disabled = false;
    }
  });

  dialog.addEventListener('close', () => {
    submitButton.disabled = false;
    submitButton.textContent = mode === 'create' ? '作成する' : '参加する';
    dialog.querySelector('.room-entry-cancel').textContent = '戻る';
  });

  return { open, close: () => dialog.close() };
}
