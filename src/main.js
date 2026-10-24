/**
 * アプリの統合点。
 * - ホーム画面とゲーム画面の表示切り替え
 * - 認証・保存モジュール（白石）の公開API呼び出し
 * - ゲームシーン（末田）の生成・破棄
 *
 * 担当モジュールがまだ無い間もホーム画面が動くよう、
 * import.meta.glob で存在するモジュールだけを読み込みます。
 */
import { setupHome } from './ui/home-ui.js';
import { setupGameUi } from './ui/game-ui.js';

const STAGE_TOTAL_FALLBACK = 5;

const optionalModules = {
  auth: import.meta.glob('./auth/auth.js'),
  save: import.meta.glob('./data/save/save-repository.js'),
  scene: import.meta.glob('./scenes/MainGameScene.js'),
  loop: import.meta.glob('./core/GameLoop.js'),
  stages: import.meta.glob('./data/stages/*.json', { eager: true, import: 'default' }),
};

async function loadOptional(moduleMap) {
  const [key] = Object.keys(moduleMap);
  if (!key) return null;

  try {
    return await moduleMap[key]();
  } catch (error) {
    console.error('[module] failed to load', key, error);
    return null;
  }
}

function createEmptyProgress() {
  return {
    completedStageIds: [],
    currentStageId: null,
    bossCleared: false,
    updatedAt: null,
  };
}

function mergeProgressFallback(base, incoming) {
  const completed = new Set([
    ...(base?.completedStageIds ?? []),
    ...(incoming?.completedStageIds ?? []),
  ]);

  return {
    completedStageIds: [...completed],
    currentStageId:
      incoming && 'currentStageId' in incoming ? incoming.currentStageId : base?.currentStageId ?? null,
    bossCleared: Boolean(base?.bossCleared || incoming?.bossCleared),
    updatedAt: new Date().toISOString(),
  };
}

function readStageMeta() {
  return Object.values(optionalModules.stages ?? {})
    .filter((stage) => stage && typeof stage === 'object' && stage.id)
    .map((stage, index) => ({
      id: String(stage.id),
      number: Number(stage.number) || index + 1,
      title: String(stage.name || stage.id).toUpperCase(),
    }))
    .sort((a, b) => a.number - b.number)
    .map((stage, index) => ({ ...stage, number: index + 1 }));
}

let currentUser = null;
let progress = createEmptyProgress();
let services = { auth: null, save: null };

let scene = null;
let gameLoop = null;
let gameModules = { scene: null, loop: null };

let saveChain = Promise.resolve();
let pendingProgress = null;

const home = setupHome({
  onGuest: handleGuest,
  onGoogle: handleGoogle,
  onStart: () => startGame({ resume: false }),
  onResume: () => startGame({ resume: true }),
  onSignOut: handleSignOut,
});

const gameUi = setupGameUi({
  onBack: () => stopGame(),
  onHelp: () => home.openHelp(),
});

function authReason(auth, configured) {
  if (!auth) {
    return '認証モジュール（src/auth）はまだ接続されていません。ゲストで遊べます。';
  }
  if (!configured) {
    return 'Supabase の環境変数が未設定です。ゲストで遊べます。';
  }
  return '';
}

function renderHome(extra = {}) {
  const stages = readStageMeta();
  home.render({
    user: currentUser,
    progress,
    stages,
    totalStages: stages.length || STAGE_TOTAL_FALLBACK,
    ...extra,
  });
}

async function boot() {
  // Paint the home screen immediately. A slow auth/session lookup should not
  // cover the public landing page with a blocking boot overlay.
  renderHome({ loading: false });

  const [auth, save] = await Promise.all([
    loadOptional(optionalModules.auth),
    loadOptional(optionalModules.save),
  ]);
  services = { auth, save };

  const configured = Boolean(auth?.isAuthConfigured?.());

  try {
    if (auth && save) {
      currentUser = await auth.getCurrentUser();

      if (currentUser?.type === 'user') {
        progress = await save.claimGuestSave(currentUser);
      } else if (currentUser) {
        progress = await save.loadSave(currentUser);
      } else {
        progress = save.createEmptyProgress();
      }
    } else {
      currentUser = null;
      progress = createEmptyProgress();
    }
  } catch (error) {
    console.error('[boot]', error);
    currentUser = null;
    progress = createEmptyProgress();
    home.setMessage('進捗を読み込めませんでした。ゲストで遊べます。', 'error');
  }

  renderHome({
    authConfigured: configured,
    authReason: authReason(auth, configured),
    loading: false,
  });
}

async function handleGuest() {
  home.setBusy(true);
  home.setMessage('');

  try {
    if (services.auth?.signInAsGuest) {
      currentUser = await services.auth.signInAsGuest();
      if (services.save) progress = await services.save.loadSave(currentUser);
    } else {
      // 認証モジュールが入るまでの仮セッション（`src/auth` 接続後は使われない）
      currentUser = { type: 'guest', id: 'guest' };
    }

    renderHome();
    home.setMessage('ゲストセッションを開始しました。', 'info');
  } catch (error) {
    console.error('[guest]', error);
    home.setMessage('ゲストを開始できませんでした。もう一度お試しください。', 'error');
  } finally {
    home.setBusy(false);
  }
}

async function handleGoogle() {
  if (!services.auth?.signInWithGoogle) {
    home.setMessage('Google ログインはまだ接続されていません。ゲストで遊べます。', 'warn');
    return;
  }

  home.setBusy(true);
  home.setMessage('');

  try {
    await services.auth.signInWithGoogle();
  } catch (error) {
    console.error('[google]', error);
    home.setMessage('ログインを開始できませんでした。ゲストで遊べます。', 'error');
  } finally {
    home.setBusy(false);
  }
}

async function handleSignOut() {
  home.setBusy(true);

  try {
    await services.auth?.signOut?.();
    currentUser = null;
    progress = createEmptyProgress();
    renderHome();
    home.setMessage('ログアウトしました。', 'info');
  } catch (error) {
    console.error('[signout]', error);
    home.setMessage('ログアウトできませんでした。', 'error');
  } finally {
    home.setBusy(false);
  }
}

async function loadGameModules() {
  if (gameModules.scene && gameModules.loop) return gameModules;

  const [sceneModule, loopModule] = await Promise.all([
    gameModules.scene ?? loadOptional(optionalModules.scene),
    gameModules.loop ?? loadOptional(optionalModules.loop),
  ]);

  gameModules = { scene: sceneModule, loop: loopModule };
  return gameModules;
}

function getGameConstructors(modules) {
  return {
    MainGameScene: modules.scene?.default ?? modules.scene?.MainGameScene,
    GameLoop: modules.loop?.default ?? modules.loop?.GameLoop,
  };
}

async function startGame({ resume = false } = {}) {
  if (scene) return;

  const modules = await loadGameModules();
  const { MainGameScene, GameLoop } = getGameConstructors(modules);

  if (!MainGameScene || !GameLoop) {
    home.setMessage('ゲーム本体はまだ接続されていません。ホーム画面のみ表示中です。', 'warn');
    return;
  }

  const canvas = document.getElementById('game-canvas');
  if (!canvas) return;

  home.setBusy(true);

  try {
    const initialProgress = resume ? progress : createEmptyProgress();

    scene = new MainGameScene(canvas, {
      initialProgress,
      onProgress: handleProgress,
      onStageChange: (stage) => gameUi.setStageLabel(`stage ${String(stage.number).padStart(2, '0')}`),
      onGameOver: ({ reason, stageId } = {}) => {
        console.info('[gameover]', reason, stageId);
      },
    });

    gameLoop = new GameLoop({
      update: (dt) => scene.update(dt),
      render: () => scene.render(),
    });

    home.hide();
    gameUi.show({ user: currentUser });
    gameUi.setStageLabel(`stage ${String(scene.stage.number).padStart(2, '0')}`);
    canvas.focus({ preventScroll: true });
    scene.render();
    gameLoop.start();
  } catch (error) {
    console.error('[start]', error);
    gameLoop?.stop();
    gameLoop = null;
    scene?.dispose?.();
    scene = null;
    gameUi.hide();
    home.show();
    home.setMessage('ゲームを開始できませんでした。もう一度お試しください。', 'error');
  } finally {
    home.setBusy(false);
  }
}

function stopGame({ showHome = true } = {}) {
  gameLoop?.stop();
  gameLoop = null;

  scene?.dispose?.();
  scene = null;

  gameUi.hide();

  if (showHome) {
    home.show();
    renderHome();
    home.focusPrimary();
  }
}

function handleProgress(next) {
  progress = services.save?.mergeProgress
    ? services.save.mergeProgress(progress, next)
    : mergeProgressFallback(progress, next);

  scheduleSave();
}

function scheduleSave() {
  if (!services.save || !currentUser) {
    gameUi.setSaveStatus({ state: 'idle', message: '保存できません（未ログイン）' });
    return;
  }

  pendingProgress = progress;

  saveChain = saveChain.then(async () => {
    if (!pendingProgress) return;

    const payload = pendingProgress;
    pendingProgress = null;

    gameUi.setSaveStatus({ state: 'saving' });

    try {
      progress = await services.save.saveProgress(currentUser, payload);
      gameUi.setSaveStatus({ state: 'saved', at: new Date(), message: 'セーブ完了' });
    } catch (error) {
      console.error('[save]', error);
      gameUi.setSaveStatus({ state: 'error', message: '保存できません（通信）' });
    }
  });
}

window.addEventListener('pagehide', () => {
  if (scene) stopGame({ showHome: false });
});

boot().catch((error) => {
  console.error('[boot]', error);
  home.setLoading(false);
  home.setMessage('起動に失敗しました。ページを再読み込みしてください。', 'error');
});
