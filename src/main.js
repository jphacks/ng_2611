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
import { setupPlayModeUi } from './ui/play-mode-ui.js';
import { setupRoomUi } from './rooms/room-ui.js';
import { setupRoomLobbyUi } from './rooms/room-lobby-ui.js';
import { getCurrentRoom, getRoom, leaveRoom, subscribeToRoom } from './rooms/room-service.js';

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
let activeRoomCode = null;
let startingGame = false;
let roomMonitorGeneration = 0;
let roomMonitorUnsubscribe = null;
let roomMonitorTimer = null;

let saveChain = Promise.resolve();
let pendingProgress = null;
let playModeUi = null;

const roomLobbyUi = setupRoomLobbyUi({
  onClose: ({ roomDeleted = false } = {}) => {
    activeRoomCode = null;
    playModeUi.show(currentUser);
    if (roomDeleted) playModeUi.setMessage('ホストがルームを終了しました。', 'info');
  },
  onStart: ({ roomCode, stageId }) => {
    startGame({ roomCode, stageId });
  },
});
const roomUi = setupRoomUi({
  onSuccess: ({ room }) => {
    activeRoomCode = room.room_code;
    playModeUi.hide();
    roomLobbyUi.open(room.room_code, {
      currentUserId: currentUser?.id,
      stageOptions: readStageMeta(),
    });
  },
});

const home = setupHome({
  onGuest: handleGuest,
  onGoogle: handleGoogle,
  onStart: () => startGame({ resume: false }),
  onResume: () => startGame({ resume: true }),
  onSignOut: handleSignOut,
});

const gameUi = setupGameUi({
  onBack: () => {
    if (!activeRoomCode) {
      stopGame();
      return;
    }

    const roomCode = activeRoomCode;
    stopRoomMonitor();
    stopGame({ showHome: false });
    roomLobbyUi.open(roomCode, { currentUserId: currentUser?.id, stageOptions: readStageMeta() });
  },
  onHelp: () => home.openHelp(),
});

playModeUi = setupPlayModeUi({
  onSolo: () => startGame({ resume: false }),
  onCreateRoom: () => roomUi.open('create'),
  onJoinRoom: () => roomUi.open('join'),
  onBack: () => {
    if (activeRoomCode) {
      roomLobbyUi.open(activeRoomCode, {
        currentUserId: currentUser?.id,
        stageOptions: readStageMeta(),
      });
      return;
    }
    playModeUi.hide();
    home.show();
    renderHome();
  },
  onSignOut: handleSignOut,
});

function showPlayMode() {
  home.hide();
  playModeUi.show(currentUser);
}

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
  let restoredRoom = null;

  try {
    currentUser = auth ? await auth.getCurrentUser() : null;

    if (currentUser && save) {
      if (currentUser.type === 'user') {
        progress = await save.claimGuestSave(currentUser);
      } else {
        progress = await save.loadSave(currentUser);
      }
    } else {
      progress = createEmptyProgress();
    }

    if (currentUser?.type === 'user') {
      try {
        restoredRoom = await getCurrentRoom();
        activeRoomCode = restoredRoom?.room_code ?? null;
      } catch (roomError) {
        console.warn('[boot] active room could not be restored', roomError);
      }
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

  if (restoredRoom) {
    home.hide();
    roomLobbyUi.open(restoredRoom.room_code, {
      currentUserId: currentUser.id,
      stageOptions: readStageMeta(),
    });
  } else if (currentUser?.type === 'user') {
    showPlayMode();
  }
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
    if (activeRoomCode && currentUser?.type === 'user') {
      try {
        // leave_room deletes the room when the signed-in user is its creator.
        await leaveRoom(activeRoomCode);
      } catch (roomError) {
        console.error('[signout] failed to leave active room', roomError);
        const message = `ルームから退出できなかったため、ログアウトしていません。${roomError.message || ''}`;
        playModeUi.setMessage(message, 'error');
        home.setMessage(message, 'error');
        return;
      }

      stopRoomMonitor();
      roomLobbyUi.close();
      activeRoomCode = null;
    }

    await services.auth?.signOut?.();
    currentUser = null;
    progress = createEmptyProgress();
    playModeUi.hide();
    home.show();
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

async function startGame({ resume = false, stageId = null, roomCode = null } = {}) {
  if (scene || startingGame) return;

  if (stageId && !readStageMeta().some((stage) => stage.id === stageId)) {
    home.setMessage(`指定されたステージが見つかりません: ${stageId}`, 'error');
    return;
  }

  startingGame = true;
  const modules = await loadGameModules();
  const { MainGameScene, GameLoop } = getGameConstructors(modules);

  if (!MainGameScene || !GameLoop) {
    if (roomCode) {
      roomLobbyUi.open(roomCode, { currentUserId: currentUser?.id, stageOptions: readStageMeta() });
    } else {
      home.setMessage('ゲーム本体はまだ接続されていません。ホーム画面のみ表示中です。', 'warn');
    }
    startingGame = false;
    return;
  }

  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    startingGame = false;
    return;
  }

  home.setBusy(true);

  try {
    const initialProgress = stageId
      ? { ...createEmptyProgress(), currentStageId: stageId }
      : resume ? progress : createEmptyProgress();

    scene = new MainGameScene(canvas, {
      initialProgress,
      onProgress: handleProgress,
      onStageChange: (stage) => gameUi.setStageLabel(`stage ${String(stage.number).padStart(2, '0')}`),
      onGameOver: ({ reason, stageId } = {}) => {
        console.info('[gameover]', reason, stageId);
      },
    });
    activeRoomCode = roomCode;

    gameLoop = new GameLoop({
      update: (dt) => scene.update(dt),
      render: () => scene.render(),
    });

    home.hide();
    playModeUi.hide();
    roomLobbyUi.close();
    gameUi.show({ user: currentUser });
    gameUi.setStageLabel(`stage ${String(scene.stage.number).padStart(2, '0')}`);
    canvas.focus({ preventScroll: true });
    scene.render();
    gameLoop.start();
    if (roomCode) startRoomMonitor(roomCode);
  } catch (error) {
    console.error('[start]', error);
    gameLoop?.stop();
    gameLoop = null;
    scene?.dispose?.();
    scene = null;
    gameUi.hide();
    activeRoomCode = null;
    if (roomCode) {
      roomLobbyUi.open(roomCode, { currentUserId: currentUser?.id, stageOptions: readStageMeta() });
    } else {
      home.show();
      home.setMessage('ゲームを開始できませんでした。もう一度お試しください。', 'error');
    }
  } finally {
    home.setBusy(false);
    startingGame = false;
  }
}

function stopGame({ showHome = true } = {}) {
  stopRoomMonitor();
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

function stopRoomMonitor() {
  roomMonitorGeneration += 1;
  roomMonitorUnsubscribe?.();
  roomMonitorUnsubscribe = null;
  if (roomMonitorTimer !== null) window.clearInterval(roomMonitorTimer);
  roomMonitorTimer = null;
}

function returnHomeAfterRoomEnd(roomCode, { confirmedDeleted = false } = {}) {
  if (activeRoomCode !== roomCode) return;

  stopRoomMonitor();
  activeRoomCode = null;
  roomLobbyUi.close();
  stopGame({ showHome: false });
  playModeUi.show(currentUser);
  playModeUi.setMessage(
    confirmedDeleted
      ? 'ホストがルームを解散しました。プレイを終了しました。'
      : 'ルームまたは参加状態を確認できなくなったため、プレイを終了しました。',
    'info',
  );
}

async function startRoomMonitor(roomCode) {
  stopRoomMonitor();
  const monitorGeneration = roomMonitorGeneration;

  const checkRoomStillExists = async () => {
    if (monitorGeneration !== roomMonitorGeneration || activeRoomCode !== roomCode) return;
    try {
      await getRoom(roomCode);
    } catch (error) {
      if (error.code === 'ROOM_NOT_FOUND') {
        returnHomeAfterRoomEnd(roomCode);
      } else {
        console.warn('[room monitor] room status check failed', error);
      }
    }
  };

  try {
    const room = await getRoom(roomCode);
    if (monitorGeneration !== roomMonitorGeneration || activeRoomCode !== roomCode) return;
    const unsubscribe = await subscribeToRoom(
      room.id,
      (payload) => {
        if (payload?.table === 'rooms' && payload.eventType === 'DELETE') {
          returnHomeAfterRoomEnd(roomCode, { confirmedDeleted: true });
        } else if (payload?.eventType === 'DELETE') {
          void checkRoomStillExists();
        }
      },
      (status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`[room monitor] Realtime ${status}; periodic checks remain active`);
        }
      },
      'game',
    );

    if (monitorGeneration !== roomMonitorGeneration || activeRoomCode !== roomCode) {
      unsubscribe();
      return;
    }
    roomMonitorUnsubscribe = unsubscribe;
  } catch (error) {
    if (error.code === 'ROOM_NOT_FOUND') {
      returnHomeAfterRoomEnd(roomCode);
      return;
    }
    console.warn('[room monitor] realtime setup failed; periodic checks remain active', error);
  }

  if (monitorGeneration === roomMonitorGeneration && activeRoomCode === roomCode) {
    roomMonitorTimer = window.setInterval(checkRoomStillExists, 3000);
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
