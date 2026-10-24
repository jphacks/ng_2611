/**
 * ゲーム画面のDOM（ヘッダー・保存状態・ユーザー表示）だけを扱います。
 * Canvasの描画は `src/ui/canvas-ui.js` と `MainGameScene` の担当です。
 */

function byId(id) {
  return document.getElementById(id);
}

function formatTime(at) {
  const date = at instanceof Date ? at : at ? new Date(at) : new Date();
  if (Number.isNaN(date.getTime())) return '--:--';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function setupGameUi({ onBack, onHelp } = {}) {
  const screen = byId('game-screen');
  const backButton = byId('back-home-button');
  const helpButton = byId('game-help-button');
  const userBadge = byId('game-user-badge');
  const saveStatus = byId('save-status');
  const stageLabel = byId('game-stage-label');

  if (!screen) throw new Error('ゲーム画面の要素が見つかりません。');

  function setUser(user) {
    if (!userBadge) return;

    if (user?.type === 'user') {
      userBadge.textContent = user.displayName || user.email || 'SIGNED IN';
      userBadge.dataset.tone = 'user';
      return;
    }

    if (user?.type === 'guest') {
      userBadge.textContent = 'GUEST SESSION';
      userBadge.dataset.tone = 'guest';
      return;
    }

    userBadge.textContent = 'NO SESSION';
    userBadge.dataset.tone = 'none';
  }

  function setSaveStatus({ state = 'idle', at, message } = {}) {
    if (!saveStatus) return;

    saveStatus.dataset.state = state;

    if (state === 'saving') {
      saveStatus.textContent = '保存中…';
      return;
    }

    if (state === 'saved') {
      saveStatus.textContent = `SAVED ${formatTime(at)}`;
      return;
    }

    if (state === 'error') {
      saveStatus.textContent = message || '保存できません';
      return;
    }

    saveStatus.textContent = message || 'SAVED --:--';
  }

  function setStageLabel(label) {
    if (stageLabel) stageLabel.textContent = label || 'ready';
  }

  function show({ user, stageLabel: label } = {}) {
    screen.hidden = false;
    setUser(user);
    if (label) setStageLabel(label);
  }

  function hide() {
    screen.hidden = true;
  }

  backButton?.addEventListener('click', () => onBack?.());
  helpButton?.addEventListener('click', () => onHelp?.());

  return {
    show,
    hide,
    setUser,
    setSaveStatus,
    setStageLabel,
  };
}
