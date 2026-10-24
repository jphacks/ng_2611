/**
 * Googleログイン後のプレイ方法選択画面。
 * ルーム作成・参加はコールバック境界を用意し、実処理を別モジュールから接続します。
 */
function byId(id) {
  return document.getElementById(id);
}

export function setupPlayModeUi({
  onSolo,
  onCreateRoom,
  onJoinRoom,
  onBack,
  onSignOut,
} = {}) {
  const screen = byId('play-mode-screen');
  const userBadge = byId('mode-user-badge');
  const message = byId('play-mode-message');
  const backButton = byId('mode-back-button');
  const signOutButton = byId('mode-sign-out-button');
  const soloButton = byId('solo-play-button');
  const createRoomButton = byId('create-room-button');
  const joinRoomButton = byId('join-room-button');

  if (!screen || !soloButton || !createRoomButton || !joinRoomButton) {
    throw new Error('プレイ方法選択画面の要素が見つかりません。');
  }

  function show(user) {
    if (userBadge) {
      userBadge.textContent = user?.displayName || user?.email || 'ログイン中';
    }
    screen.hidden = false;
    screen.focus?.({ preventScroll: true });
  }

  function hide() {
    screen.hidden = true;
  }

  function setMessage(text = '', tone = 'info') {
    if (!message) return;
    message.textContent = text;
    message.dataset.tone = text ? tone : '';
  }

  soloButton.addEventListener('click', () => onSolo?.());
  createRoomButton.addEventListener('click', () => onCreateRoom?.());
  joinRoomButton.addEventListener('click', () => onJoinRoom?.());
  backButton?.addEventListener('click', () => onBack?.());
  signOutButton?.addEventListener('click', () => onSignOut?.());

  return { show, hide, setMessage };
}
