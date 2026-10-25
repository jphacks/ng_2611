import { audio } from '../core/AudioManager.js';

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

export function setupGameUi({ onBack, onHelp, onResume, onQuit } = {}) {
  const screen = byId('game-screen');
  const backButton = byId('back-home-button');
  const helpButton = byId('game-help-button');
  const userBadge = byId('game-user-badge');
  const saveStatus = byId('save-status');
  const stageLabel = byId('game-stage-label');
  const pauseOverlay = byId('pause-overlay');
  const pauseBgmVolume = byId('pause-bgm-volume');
  const pauseSeVolume = byId('pause-se-volume');
  const pauseBgmValue = byId('pause-bgm-volume-value');
  const pauseSeValue = byId('pause-se-volume-value');
  const pauseResumeButton = byId('pause-resume-button');
  const pauseQuitButton = byId('pause-quit-button');

  if (!screen) throw new Error('ゲーム画面の要素が見つかりません。');

  function setUser(user) {
    if (!userBadge) return;

    if (user?.type === 'user') {
      userBadge.textContent = user.displayName || user.email || 'ログイン中';
      userBadge.dataset.tone = 'user';
      return;
    }

    if (user?.type === 'guest') {
      userBadge.textContent = 'ゲスト';
      userBadge.dataset.tone = 'guest';
      return;
    }

    userBadge.textContent = '未ログイン';
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
      saveStatus.textContent = message || `保存済み ${formatTime(at)}`;
      return;
    }

    if (state === 'error') {
      saveStatus.textContent = message || '保存できません';
      return;
    }

    saveStatus.textContent = message || '保存済み --:--';
  }

  function setStageLabel(label) {
    if (stageLabel) stageLabel.textContent = label || '準備完了';
  }

  function setBackDisabled(disabled, label = disabled ? 'プレイ中' : 'ホーム') {
    if (!backButton) return;
    backButton.disabled = Boolean(disabled);
    backButton.title = disabled ? 'ルーム参加中はプレイを続けてください。' : '';
    const labelNode = [...backButton.childNodes].find(
      (node) => node.nodeType === 3 && node.textContent.trim(),
    );
    if (labelNode) labelNode.textContent = ` ${label}`;
  }

  function show({ user, stageLabel: label, backDisabled = false } = {}) {
    screen.hidden = false;
    setUser(user);
    if (label) setStageLabel(label);
    setBackDisabled(backDisabled, backDisabled ? 'プレイ中' : 'ホーム');
    if (pauseBgmVolume) pauseBgmVolume.value = String(audio.getBgmVolume());
    if (pauseSeVolume) pauseSeVolume.value = String(audio.getSeVolume());
    if (pauseBgmValue) pauseBgmValue.value = `${Math.round(audio.getBgmVolume() * 100)}%`;
    if (pauseSeValue) pauseSeValue.value = `${Math.round(audio.getSeVolume() * 100)}%`;
    if (pauseQuitButton) pauseQuitButton.hidden = backDisabled;
    if (pauseOverlay) pauseOverlay.hidden = true;
  }

  function setPaused(paused) {
    if (pauseOverlay) pauseOverlay.hidden = !paused;
    if (paused) pauseResumeButton?.focus();
  }

  function hide() {
    screen.hidden = true;
  }

  backButton?.addEventListener('click', () => onBack?.());
  helpButton?.addEventListener('click', () => onHelp?.());
  pauseBgmVolume?.addEventListener('input', () => {
    const value = audio.setBgmVolume(pauseBgmVolume.value);
    if (pauseBgmValue) pauseBgmValue.value = `${Math.round(value * 100)}%`;
  });
  pauseSeVolume?.addEventListener('input', () => {
    const value = audio.setSeVolume(pauseSeVolume.value);
    if (pauseSeValue) pauseSeValue.value = `${Math.round(value * 100)}%`;
  });
  pauseResumeButton?.addEventListener('click', () => onResume?.());
  pauseQuitButton?.addEventListener('click', () => onQuit?.());

  return {
    show,
    hide,
    setUser,
    setSaveStatus,
    setStageLabel,
    setBackDisabled,
    setPaused,
  };
}
