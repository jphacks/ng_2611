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
    title: 'STAGE',
  }));
}

function setupScrollReveal(shell) {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduceMotion) return;

  const targets = [...shell.querySelectorAll(
    '.landing-hero, .guide-section, .control-card, .play-section',
  )];
  if (!targets.length) return;

  targets.forEach((element) => {
    const siblings = [...element.parentElement.children].filter((child) => (
      child.matches('.control-card, .shortcut-card')
    ));
    const index = siblings.indexOf(element);
    element.style.setProperty('--reveal-delay', `${Math.max(index, 0) * 90}ms`);
    element.classList.add('reveal-item');
  });

  shell.classList.add('has-scroll-reveal');
  const observer = new IntersectionObserver((entries, activeObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      activeObserver.unobserve(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -7% 0px' });

  targets.forEach((element) => observer.observe(element));
}

function setupTitleReveal(shell) {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduceMotion) return;

  const targets = [...shell.querySelectorAll(
    '.wordmark, .section-heading h2, .play-heading h2',
  )];
  if (!targets.length) return;

  targets.forEach((element) => {
    element.classList.add('title-reveal');
    if (element.matches('.section-heading h2, .play-heading h2')) {
      const accent = element.querySelector('span');
      if (accent) accent.classList.add('title-reveal-accent');
    }
  });

  shell.classList.add('has-title-reveal');

  const play = (element, activeObserver) => {
    if (element.classList.contains('is-playing')) return;
    element.classList.add('is-playing');
    activeObserver?.unobserve(element);
  };

  const observer = new IntersectionObserver((entries, activeObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      play(entry.target, activeObserver);
    });
  }, { threshold: 0.3, rootMargin: '0px 0px -10% 0px' });

  const playVisible = () => {
    targets.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const visible = rect.top < window.innerHeight * 0.9 && rect.bottom > 0;
      if (visible) play(element, observer);
    });
  };

  targets.forEach((element) => observer.observe(element));

  if (document.readyState === 'complete') {
    setTimeout(playVisible, 0);
  } else {
    window.addEventListener('load', playVisible, { once: true });
  }
}

function setupAmbientMotion(shell) {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const heroArt = shell.querySelector('.hero-art');
  const header = shell.querySelector('.site-header');
  const shortcutScenes = [...shell.querySelectorAll('.shortcut-scene')];
  const shortcutCards = [...shell.querySelectorAll('.shortcut-grid .shortcut-card')];

  if (!reduceMotion && heroArt) {
    const finePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    if (finePointer) {
      let frame = 0;
      let targetX = 0;
      let targetY = 0;
      let currentX = 0;
      let currentY = 0;

      const paint = () => {
        frame = 0;
        currentX += (targetX - currentX) * 0.14;
        currentY += (targetY - currentY) * 0.14;
        heroArt.style.setProperty('--px', currentX.toFixed(3));
        heroArt.style.setProperty('--py', currentY.toFixed(3));
        if (Math.abs(targetX - currentX) > 0.002 || Math.abs(targetY - currentY) > 0.002) {
          frame = requestAnimationFrame(paint);
        }
      };

      const request = () => {
        if (!frame) frame = requestAnimationFrame(paint);
      };

      heroArt.addEventListener('pointermove', (event) => {
        const rect = heroArt.getBoundingClientRect();
        targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
        request();
      });

      heroArt.addEventListener('pointerleave', () => {
        targetX = 0;
        targetY = 0;
        request();
      });
    }

    shell.querySelectorAll('.control-card, .shortcut-card, .play-section').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--gx', `${event.clientX - rect.left}px`);
        card.style.setProperty('--gy', `${event.clientY - rect.top}px`);
      });
    });
  }

  const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
  const easeOutCubic = (value) => 1 - (1 - value) ** 3;

  let ticking = false;
  const updateScroll = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
    shell.style.setProperty('--scroll', progress.toFixed(4));
    header?.classList.toggle('is-scrolled', window.scrollY > 12);

    const viewport = window.innerHeight;
    const start = viewport * 0.95;
    const span = Math.max(viewport * 0.62, 1);

    shortcutScenes.forEach((scene) => {
      const rect = scene.getBoundingClientRect();
      const anchor = rect.top + rect.height * 0.35;
      const sceneProgress = clamp01((start - anchor) / span);
      const approach = easeOutCubic(clamp01(sceneProgress / 0.62));
      const copy = clamp01((sceneProgress - 0.42) / 0.3);
      const paste = clamp01((sceneProgress - 0.66) / 0.3);

      scene.style.setProperty('--p', sceneProgress.toFixed(3));
      scene.style.setProperty('--approach', approach.toFixed(3));
      scene.style.setProperty('--copy', copy.toFixed(3));
      scene.style.setProperty('--paste', paste.toFixed(3));
    });

    const focusLine = viewport * 0.35;
    const focusRange = Math.max(viewport * 0.52, 1);
    const endFocus = clamp01(1 - (max - window.scrollY) / Math.max(viewport * 0.35, 1));

    shortcutCards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const focus = clamp01(1 - Math.abs(center - focusLine) / focusRange);
      const baseAlpha = 0.24 + focus * 0.76;
      const alpha = index === shortcutCards.length - 1
        ? Math.max(baseAlpha, 0.24 + endFocus * 0.76)
        : baseAlpha;

      card.style.setProperty('--card-alpha', alpha.toFixed(3));
    });
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateScroll);
  };

  updateScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
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

  setupScrollReveal(shell);
  setupTitleReveal(shell);
  setupAmbientMotion(shell);

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
    const hasCloudSave = state.user?.type === 'user';

    if (progressSummary) {
      progressSummary.hidden = !hasCloudSave;
      progressSummary.replaceChildren();
      if (hasCloudSave) {
        progressSummary.append('クリア ');
        const done = document.createElement('span');
        done.className = 'sum-done';
        done.textContent = String(clearedCount);
        progressSummary.append(done, ` / ${items.length}`);
      }
    }

    if (bossBadge) bossBadge.hidden = !hasCloudSave || !state.progress?.bossCleared;
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
      userBadge.textContent = 'ゲスト';
      userBadge.dataset.tone = 'guest';
      return;
    }

    userBadge.textContent = '未ログイン';
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

    selectionStatus.textContent = 'プレイ方法を選択してください。';
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
