/**
 * ホーム画面のDOMだけを扱います。
 * 認証・保存・ゲームの呼び出しは `src/main.js` が担当し、ここではコールバックを呼ぶだけです。
 */

const STAGE_TOTAL_FALLBACK = 5;

function byId(id) {
  return document.getElementById(id);
}

function pad(number) {
  return String(number).padStart(2, '0');
}

function formatStageName(id) {
  return String(id ?? '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .toUpperCase();
}

function buildStageItems(stages, total) {
  if (Array.isArray(stages) && stages.length > 0) {
    return stages.map((stage, index) => ({
      id: String(stage.id ?? `stage-${index + 1}`),
      number: Number(stage.number) || index + 1,
      title: stage.title || stage.name || formatStageName(stage.id),
    }));
  }

  return Array.from({ length: total || STAGE_TOTAL_FALLBACK }, (_, index) => ({
    id: `stage-${index + 1}`,
    number: index + 1,
    title: `STAGE ${pad(index + 1)}`,
  }));
}

export function setupHome({
  onGuest,
  onGoogle,
  onStart,
  onResume,
  onSignOut,
} = {}) {
  const shell = byId('home-screen');
  const loadingOverlay = byId('auth-loading');
  const googleButton = byId('google-login-button');
  const googleNote = byId('google-note');
  const guestButton = byId('guest-play-button');
  const startButton = byId('start-game-button');
  const resumeButton = byId('resume-game-button');
  const signOutButton = byId('sign-out-button');
  const userBadge = byId('user-badge');
  const progressSummary = byId('progress-summary');
  const stageList = byId('stage-progress');
  const bossBadge = byId('boss-badge');
  const selectionStatus = byId('selection-status');
  const message = byId('home-message');
  const helpButton = byId('help-button');
  const helpDialog = byId('help-dialog');
  const helpCloseButton = byId('help-close-button');

  if (!shell || !googleButton || !guestButton || !startButton) {
    throw new Error('ホーム画面の要素が見つかりません。');
  }

  const googleState = googleButton.querySelector('.choice-state');
  const guestState = guestButton.querySelector('.choice-state');

  const state = {
    user: null,
    progress: null,
    authConfigured: false,
    authReason: '',
    loading: true,
    busy: false,
    stages: [],
    totalStages: STAGE_TOTAL_FALLBACK,
    messageTone: '',
  };

  function renderStages() {
    if (!stageList) return;

    const items = buildStageItems(state.stages, state.totalStages);
    const cleared = new Set(state.progress?.completedStageIds ?? []);
    const currentId = state.progress?.currentStageId ?? null;

    stageList.replaceChildren(
      ...items.map((stage) => {
        const isCleared = cleared.has(stage.id);
        const isCurrent = !isCleared && stage.id === currentId;
        const row = document.createElement('li');
        row.dataset.state = isCleared ? 'cleared' : isCurrent ? 'current' : 'locked';

        const index = document.createElement('span');
        index.className = 'stage-index';
        index.textContent = pad(stage.number);

        const name = document.createElement('span');
        name.className = 'stage-name';
        name.textContent = stage.title;

        const mark = document.createElement('span');
        mark.className = 'stage-mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = isCleared ? '✓' : isCurrent ? '▸' : '·';

        row.append(index, name, mark);
        return row;
      }),
    );
  }

  function renderProgress() {
    const items = buildStageItems(state.stages, state.totalStages);
    const cleared = new Set(state.progress?.completedStageIds ?? []);
    const clearedCount = items.filter((stage) => cleared.has(stage.id)).length;

    if (progressSummary) {
      progressSummary.replaceChildren();
      progressSummary.append('CLEARED ');
      const done = document.createElement('span');
      done.className = 'sum-done';
      done.textContent = String(clearedCount);
      progressSummary.append(done, ` / ${items.length}`);
    }

    if (bossBadge) bossBadge.hidden = !state.progress?.bossCleared;
    renderStages();
  }

  function renderUserBadge() {
    if (!userBadge) return;

    const user = state.user;
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

  function renderGoogle() {
    const isUser = state.user?.type === 'user';
    const locked = state.loading || state.busy;

    googleButton.disabled = !state.authConfigured || locked || isUser;

    if (!state.authConfigured) {
      if (googleState) {
        googleState.textContent = 'OFFLINE';
        googleState.dataset.tone = 'off';
      }
      if (googleNote) {
        googleNote.textContent =
          state.authReason ||
          'Supabase が未設定のため、現在 Google ログインは利用できません。ゲストで遊べます。';
      }
      return;
    }

    if (isUser) {
      if (googleState) {
        googleState.textContent = 'SIGNED IN';
        googleState.dataset.tone = 'active';
      }
      if (googleNote) googleNote.textContent = 'ログイン済みです。進捗はクラウドに保存されます。';
      return;
    }

    if (googleState) {
      googleState.textContent = 'AVAILABLE';
      googleState.dataset.tone = 'active';
    }
    if (googleNote) {
      googleNote.textContent = 'Google アカウントでログインすると、進捗をクラウドに保存できます。';
    }
  }

  function renderGuest() {
    const selected = Boolean(state.user);
    guestButton.setAttribute('aria-pressed', String(state.user?.type === 'guest'));
    guestButton.classList.toggle('is-selected', state.user?.type === 'guest');

    if (guestState) {
      const active = state.user?.type === 'guest';
      guestState.textContent = active ? 'ACTIVE' : 'STANDBY';
      guestState.dataset.tone = active ? 'active' : 'none';
    }

    const isUser = state.user?.type === 'user';
    startButton.disabled = !selected || state.loading || state.busy;

    if (resumeButton) {
      resumeButton.hidden = !state.user || !state.progress?.currentStageId;
      resumeButton.disabled = state.busy;
    }

    if (signOutButton) {
      signOutButton.hidden = !isUser;
      signOutButton.disabled = state.busy;
    }
  }

  function renderStatus() {
    if (!selectionStatus) return;

    if (state.loading) {
      selectionStatus.textContent = 'セッションを確認しています…';
      return;
    }

    if (state.user?.type === 'user') {
      selectionStatus.textContent = 'ログイン中です。GAME START で開始できます。';
      return;
    }

    if (state.user?.type === 'guest') {
      selectionStatus.textContent = 'ゲストでプレイします。GAME START で開始できます。';
      return;
    }

    selectionStatus.textContent = 'セッションを選択してください。';
  }

  function paint() {
    if (loadingOverlay) loadingOverlay.hidden = !state.loading;
    if (message) message.setAttribute('data-tone', state.messageTone);

    renderUserBadge();
    renderGoogle();
    renderGuest();
    renderStatus();
    renderProgress();
  }

  function render(next = {}) {
    Object.assign(state, next);
    paint();
  }

  function show() {
    shell.hidden = false;
  }

  function hide() {
    shell.hidden = true;
  }

  function setBusy(busy) {
    state.busy = Boolean(busy);
    shell.setAttribute('aria-busy', String(state.busy));
    renderGoogle();
    renderGuest();
    if (startButton) startButton.disabled = !state.user || state.loading || state.busy;
  }

  function setLoading(loading) {
    state.loading = Boolean(loading);
    paint();
  }

  function setMessage(text = '', tone = 'info') {
    state.messageTone = text ? tone : '';
    if (!message) return;
    message.textContent = text;
    message.setAttribute('data-tone', state.messageTone);
  }

  function focusPrimary() {
    if (!startButton.disabled) {
      startButton.focus();
      return;
    }
    guestButton.focus();
  }

  function openHelp() {
    if (helpDialog && !helpDialog.open) helpDialog.showModal();
  }

  function closeHelp() {
    if (helpDialog?.open) helpDialog.close();
  }

  googleButton.addEventListener('click', () => {
    if (!googleButton.disabled) onGoogle?.();
  });

  guestButton.addEventListener('click', () => {
    if (state.busy) return;
    onGuest?.();
  });

  startButton.addEventListener('click', () => {
    if (startButton.disabled) return;
    onStart?.({ resume: false });
  });

  resumeButton?.addEventListener('click', () => {
    if (resumeButton.disabled) return;
    onResume?.();
  });

  signOutButton?.addEventListener('click', () => {
    if (signOutButton.disabled) return;
    onSignOut?.();
  });

  helpButton?.addEventListener('click', openHelp);
  helpCloseButton?.addEventListener('click', closeHelp);

  helpDialog?.addEventListener('click', (event) => {
    if (event.target === helpDialog) closeHelp();
  });

  paint();

  return {
    show,
    hide,
    render,
    setBusy,
    setLoading,
    setMessage,
    focusPrimary,
    openHelp,
    closeHelp,
  };
}
