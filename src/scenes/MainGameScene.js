import { audio } from '../core/AudioManager.js';
import InputHandler from '../core/InputHandler.js';
import StageManager from '../core/StageManager.js';
import STAGES from '../data/stages.js';
import {
  UI_COLORS,
  drawDivider,
  drawEnergyGem,  drawKeycap,
  drawPanel,
  drawPotion,
  drawVignette,
  roundedRectPath,
  shadeColor,
  truncateText,
} from '../ui/canvas-ui.js';

const COLORS = {
  background: '#0c1822',
  floor: '#1c303a',
  floorAlt: 'rgba(230, 255, 248, 0.026)',
  grid: 'rgba(150, 205, 198, 0.1)',
  wall: '#35515b',
  wallDark: '#243c46',
  wallTop: '#7d9ea3',
  player: '#70e1c1',
  playerOutline: '#d9fff4',
  accent: '#f3c969',
  skillPotion: '#4aa8ff',
  locked: '#db7d59',
  unlocked: '#70e1c1',
  laser: '#ff5e68',
  laserGlow: 'rgba(255, 94, 104, 0.42)',
  water: '#247eaa',
  waterGlow: 'rgba(73, 190, 232, 0.42)',
  text: '#f2fffb',
  muted: '#bfd8d2',
};


/** 1画面のCanvasダンジョンとプレイヤー操作を管理します。 */
export default class MainGameScene {
  constructor(canvas, {
    initialProgress,
    stageIds,
    roomMode = false,
    onProgress,
    onStageChange,
    onPauseChange,
  } = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new TypeError('MainGameSceneにはCanvas要素を指定してください。');
    }

    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    if (!this.context) throw new Error('Canvas 2Dコンテキストを取得できません。');

    this.width = canvas.width;
    this.height = canvas.height;
    this.tileSize = 40;
    this.elapsed = 0;
    const selectedStages = Array.isArray(stageIds) && stageIds.length
      ? stageIds.map((id) => STAGES.find((stage) => stage.id === id)).filter(Boolean)
      : STAGES;
    if (selectedStages.length === 0 || (Array.isArray(stageIds) && selectedStages.length !== stageIds.length)) {
      throw new TypeError('プレイするステージの指定が正しくありません。');
    }
    this.stageIds = selectedStages.map((stage) => stage.id);
    this.roomMode = Boolean(roomMode);
    this.stageManager = new StageManager(selectedStages);
    this.completedStageIds = new Set(initialProgress?.completedStageIds ?? []);
    this.onProgress = onProgress;
    this.onStageChange = onStageChange;
    this.onPauseChange = onPauseChange;
    this.paused = false;

    const savedStageIndex = selectedStages.findIndex((stage) => stage.id === initialProgress?.currentStageId);
    if (savedStageIndex >= 0) this.stageManager.index = savedStageIndex;
    else {
      const nextStageIndex = selectedStages.findIndex((stage) => !this.completedStageIds.has(stage.id));
      if (nextStageIndex >= 0) this.stageManager.index = nextStageIndex;
    }

    this.stage = this.stageManager.current;
    this.player = {
      x: (this.stage.start.x + 0.5) * this.tileSize,
      y: (this.stage.start.y + 0.5) * this.tileSize,
      radius: 13,
      facing: this.stage.start.facing,
      skillEnergy: 1,
    };
    this.inventory = { skillPotion: 0 };
    this.loadStage(this.stage);
    this.onStageChange?.(this.stage);
    this.lastShortcutMessage = '矢印キー / WASD で1マスずつ移動';

    this.input = new InputHandler({
      onMove: (direction, pressed) => this.handleMove(direction, pressed),
      onShortcut: (shortcut) => this.handleShortcut(shortcut),
      onEscape: () => this.togglePause(),
    });
    this.input.attach(canvas);
    this.gameOver = false;
    this.runCleared = false;
    this.gameOverReason = '';
    this.canvas.addEventListener('click', this.focusCanvas);
    audio.startBgm();
  }

  togglePause() {
    if (this.gameOver || this.runCleared) return;
    this.paused = !this.paused;
    this.input.setEnabled(!this.paused);
    this.onPauseChange?.(this.paused);
  }

  handleRetryKeyDown = (event) => {
    if (!this.gameOver && !this.runCleared) return;
    if (event.key !== 'Enter' && event.key.toLowerCase() !== 'r') return;
    event.preventDefault();
    event.stopPropagation();
    if (this.runCleared) this.resetRun();
    else this.retryStage();
  };

  focusCanvas = () => {
    this.canvas.focus({ preventScroll: true });
  };

  handleMove(direction, pressed) {
    if (!pressed || this.gameOver || this.runCleared) return;

    const offsets = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const offset = offsets[direction];
    if (!offset) return;

    this.player.facing = direction;
    const tile = this.getPlayerTile();
    const nextX = tile.x + offset.x;
    const nextY = tile.y + offset.y;
    if (!this.canOccupy(nextX, nextY)) {
      this.lastShortcutMessage = 'そのマスには進めません';
      audio.playSe('error');
      return;
    }

    this.recordUndo();
    this.player.x = (nextX + 0.5) * this.tileSize;
    this.player.y = (nextY + 0.5) * this.tileSize;
    audio.playSe('move');
    this.collectNearbyItems();
    if (this.applyHazards(nextX, nextY)) return;
    this.checkGoal();
  }

  applyHazards(tileX, tileY) {
    if (!this.laserBeamTiles.has(`${tileX},${tileY}`)) return false;
    this.triggerGameOver('レーザーに触れてしまった！');
    return true;
  }

  checkPlayerLaserCollision() {
    if (this.gameOver || this.runCleared) return false;
    const tile = this.getPlayerTile();
    return this.applyHazards(tile.x, tile.y);
  }

  isWaterTile(tileX, tileY) {
    return this.water.some((tile) => tile.x === tileX && tile.y === tileY);
  }

  triggerGameOver(reason) {
    if (this.gameOver || this.runCleared) return;
    this.gameOver = true;
    this.gameOverReason = reason;
    this.lastShortcutMessage = `${reason} R / Enter でこのステージに再挑戦`;
    audio.playSe('error');
    this.input.setEnabled(false);
    window.addEventListener('keydown', this.handleRetryKeyDown);
  }

  retryStage() {
    window.removeEventListener('keydown', this.handleRetryKeyDown);
    this.gameOver = false;
    this.gameOverReason = '';
    this.loadStage(this.stage);
    this.lastShortcutMessage = `STAGE ${this.stage.number} に再挑戦！`;
    this.input.setEnabled(true);
    this.canvas.focus({ preventScroll: true });
  }

  handleShortcut({ action, modifier }) {
    if (action === 'undo') {
      this.undo();
      return;
    }
    if (action === 'redo') {
      this.redo();
      return;
    }
    if (action === 'selectAll') {
      const selectableBlocks = this.getSelectableBlocks();
      this.selectedBlockIds = new Set(selectableBlocks.map((block) => block.id));
      this.lastShortcutMessage = selectableBlocks.length > 0
        ? `操作可能な木箱を${selectableBlocks.length}個選択しました`
        : '選択できる木箱がありません';
      if (selectableBlocks.length > 0) this.playShortcutSound(action);
      else audio.playSe('error');
      return;
    }

    const target = this.getTargetTile();
    const block = this.blocks.find((candidate) => candidate.x === target.x && candidate.y === target.y);
    const modifierLabel = modifier === 'Meta' ? 'Cmd' : 'Ctrl';

    if (action === 'copy' || action === 'cut') {
      const selectedBlocks = this.getSelectedBlocks();
      const hasSelection = selectedBlocks.length > 0;
      if (hasSelection && !selectedBlocks.some((selected) => selected.id === block?.id)) {
        this.lastShortcutMessage = `${modifierLabel}+${action === 'copy' ? 'C' : 'X'}: 前方カーソルを選択中の木箱に合わせてください`;
        audio.playSe('error');
        return;
      }
      const operationBlocks = hasSelection ? selectedBlocks : (block ? [block] : []);
      if (operationBlocks.length === 0) {
        this.lastShortcutMessage = `${modifierLabel}+${action === 'copy' ? 'C' : 'X'}: 前方に操作可能なブロックがありません`;
        audio.playSe('error');
        return;
      }
      if (operationBlocks.some((candidate) => candidate.waterFilled)) {
        this.lastShortcutMessage = '水に置いた木箱は動かせません';
        audio.playSe('error');
        return;
      }

      this.recordUndo();
      const anchor = block;
      this.clipboard = {
        anchor: { x: anchor.x, y: anchor.y },
        copyFacing: this.player.facing,
        blocks: operationBlocks.map((candidate) => ({
          ...candidate,
          offsetX: candidate.x - anchor.x,
          offsetY: candidate.y - anchor.y,
        })),
      };
      if (action === 'cut') {
        const removedIds = new Set(operationBlocks.map((candidate) => candidate.id));
        this.blocks = this.blocks.filter((candidate) => !removedIds.has(candidate.id));
        this.selectedBlockIds = new Set([...this.selectedBlockIds].filter((id) => !removedIds.has(id)));
        this.openColors = this.computeOpenColors();
        this.rebuildLaserBeams();
        if (this.checkPlayerLaserCollision()) return;
      }
      if (action === 'copy' && this.stage.shortcutGate) this.shortcutGateOpen = true;
      const countLabel = operationBlocks.length > 1
        ? `${operationBlocks.length}個の木箱`
        : block.kind === 'colored'
          ? `色つき木箱「${block.name}」`
          : `「${block.name}」`;
      this.lastShortcutMessage = action === 'copy'
        ? `${countLabel}をコピーしました${this.shortcutGateOpen ? '。裏道ゲートが開きました' : ''}`
        : `${countLabel}を切り取りました`;
      this.playShortcutSound(action);
      return;
    }

    if (action === 'paste') {
      const clipboard = this.cloneClipboard(this.clipboard);
      if (!clipboard || clipboard.blocks.length === 0) {
        this.lastShortcutMessage = 'クリップボードにブロックがありません';
        audio.playSe('error');
        return;
      }
      if (this.player.skillEnergy <= 0) {
        this.lastShortcutMessage = 'スキルエナジーが不足しています。青いポーションを集めよう';
        audio.playSe('error');
        return;
      }

      const placements = clipboard.blocks.map((entry) => {
        const offset = this.rotateOffset(
          entry.offsetX,
          entry.offsetY,
          clipboard.copyFacing,
          this.player.facing,
        );
        return {
          entry,
          x: target.x + offset.x,
          y: target.y + offset.y,
        };
      });
      const occupied = new Set();
      for (const placement of placements) {
        const key = `${placement.x},${placement.y}`;
        if (this.isWallTile(placement.x, placement.y)) {
          this.lastShortcutMessage = '貼り付け先に壁ブロックが重なるため、貼り付けできません';
          audio.playSe('error');
          return;
        }
        if (!this.isInsideBoard(placement.x, placement.y) || this.isFixedObstacle(placement.x, placement.y)) {
          this.lastShortcutMessage = '貼り付ける範囲に通れない障害物があるため、貼り付けできません';
          audio.playSe('error');
          return;
        }
        if (occupied.has(key) || this.blocks.some((candidate) => candidate.x === placement.x && candidate.y === placement.y)) {
          this.lastShortcutMessage = '貼り付ける範囲に別の木箱があるため、貼り付けできません';
          audio.playSe('error');
          return;
        }
        const playerTile = this.getPlayerTile();
        if (placement.x === playerTile.x && placement.y === playerTile.y) {
          this.lastShortcutMessage = 'プレイヤーのいるマスには貼り付けできません';
          audio.playSe('error');
          return;
        }
        if (this.isWaterTile(placement.x, placement.y) && placement.entry.kind !== 'normal') {
          this.lastShortcutMessage = '水場にはノーマル木箱だけ置けます';
          audio.playSe('error');
          return;
        }
        occupied.add(key);
      }

      this.recordUndo();
      this.player.skillEnergy -= 1;
      for (const placement of placements) {
        const { offsetX, offsetY, ...blockData } = placement.entry;
        const fillsWater = this.isWaterTile(placement.x, placement.y);
        this.blockIdSequence += 1;
        this.blocks.push({
          ...blockData,
          id: `block-${this.blockIdSequence}`,
          x: placement.x,
          y: placement.y,
          waterFilled: fillsWater,
        });
      }
      this.openColors = this.computeOpenColors();
      this.rebuildLaserBeams();
      if (this.checkPlayerLaserCollision()) return;

      const placedCount = placements.length;
      const switchesUnderPaste = placements.map((placement) => ({
        placement,
        switchTile: this.colorSwitches.find((candidate) => (
          candidate.x === placement.x && candidate.y === placement.y
        )),
      })).filter(({ switchTile }) => switchTile);
      const matchingSwitch = switchesUnderPaste.some(({ placement, switchTile }) => (
        placement.entry.kind === 'colored'
        && placement.entry.color?.toLowerCase() === switchTile.color.toLowerCase()
      ));
      if (matchingSwitch) {
        this.lastShortcutMessage = `${placedCount}個の木箱を配置し、同色のスイッチでカラー壁が開きました！`;
      } else if (placedCount === 1 && switchesUnderPaste.length > 0) {
        const { placement, switchTile } = switchesUnderPaste[0];
        if (placement.entry.kind === 'colored') {
          this.lastShortcutMessage = `スイッチの色と木箱の色が違うため反応しません（${switchTile.color} / ${placement.entry.color}）`;
        } else {
          this.lastShortcutMessage = 'ノーマル木箱ではカラースイッチは反応しません';
        }
      } else {
        this.lastShortcutMessage = placedCount === 1
          ? `${placements[0].entry.name}を前方に配置しました`
          : `${placedCount}個の木箱を前方に配置しました`;
      }
      this.playShortcutSound('paste');
      return;
    }

    audio.playSe('error');
    this.lastShortcutMessage = `${modifierLabel}+${action.toUpperCase()} はブロック操作ではありません`;
  }

  playShortcutSound(action) {
    const sounds = {
      copy: 'ctrlC',
      cut: 'ctrlX',
      paste: 'ctrlV',
      undo: 'ctrlZ',
      redo: 'ctrlY',
      selectAll: 'ctrlA',
    };
    const sound = sounds[action];
    if (sound) audio.playSe(sound);
  }

  getSelectableBlocks() {
    return this.blocks.filter((block) => !block.waterFilled);
  }

  getSelectedBlocks() {
    const selectableIds = new Set(this.getSelectableBlocks().map((block) => block.id));
    this.selectedBlockIds = new Set([...this.selectedBlockIds].filter((id) => selectableIds.has(id)));
    return this.blocks.filter((block) => this.selectedBlockIds.has(block.id));
  }

  cloneClipboard(clipboard) {
    if (!clipboard) return null;
    if (Array.isArray(clipboard.blocks)) {
      return {
        anchor: { ...clipboard.anchor },
        copyFacing: clipboard.copyFacing ?? 'right',
        blocks: clipboard.blocks.map((block) => ({ ...block })),
      };
    }
    return {
      anchor: { x: clipboard.x, y: clipboard.y },
      copyFacing: this.player?.facing ?? 'right',
      blocks: [{ ...clipboard, offsetX: 0, offsetY: 0 }],
    };
  }

  rotateOffset(offsetX, offsetY, sourceFacing, targetFacing) {
    const facings = ['up', 'right', 'down', 'left'];
    const sourceIndex = facings.indexOf(sourceFacing);
    const targetIndex = facings.indexOf(targetFacing);
    if (sourceIndex === -1 || targetIndex === -1) return { x: offsetX, y: offsetY };

    let x = offsetX;
    let y = offsetY;
    const quarterTurns = (targetIndex - sourceIndex + facings.length) % facings.length;
    for (let turn = 0; turn < quarterTurns; turn += 1) {
      [x, y] = [-y, x];
    }
    return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y };
  }

  isInsideBoard(tileX, tileY) {
    const columns = this.width / this.tileSize;
    const rows = this.height / this.tileSize;
    return tileX > 0 && tileY > 0 && tileX < columns - 1 && tileY < rows - 1;
  }

  isWallTile(tileX, tileY) {
    return this.obstacles.some((obstacle) => (
      tileX >= obstacle.x
      && tileX < obstacle.x + obstacle.width
      && tileY >= obstacle.y
      && tileY < obstacle.y + obstacle.height
    ));
  }

  getPlayerTile() {
    return {
      x: Math.floor(this.player.x / this.tileSize),
      y: Math.floor(this.player.y / this.tileSize),
    };
  }

  loadStage(stage) {
    this.stage = stage;
    this.obstacles = stage.obstacles.map((obstacle) => ({ ...obstacle }));
    this.items = stage.items.map((item) => ({ ...item, collected: false }));
    this.water = stage.water.map((tile) => ({ ...tile }));
    this.blocks = stage.blocks.map((block) => ({
      ...block, kind: block.kind ?? 'normal',
      waterFilled: (block.kind ?? 'normal') === 'normal' && this.isWaterTile(block.x, block.y),
    }));
    this.initialBlocks = this.blocks.map((block) => ({ ...block }));
    this.colorSwitches = stage.colorSwitches.map((colorSwitch) => ({ ...colorSwitch }));
    this.colorWalls = stage.colorWalls.map((wall) => ({ ...wall }));
    this.lasers = stage.lasers.map((laser) => ({ ...laser }));
    this.openColors = this.computeOpenColors();
    this.blockIdSequence = this.blocks.length;
    this.goal = { ...stage.goal, radius: 19 };
    this.shortcutGateOpen = false;
    this.clipboard = null;
    this.selectedBlockIds = new Set();
    this.undoStack = [];
    this.redoStack = [];
    this.laserBeamTiles = new Set();
    this.laserVisuals = [];
    this.gameOver = false;
    this.runCleared = false;
    this.gameOverReason = '';
    this.rebuildLaserBeams();
    this.player.x = (stage.start.x + 0.5) * this.tileSize;
    this.player.y = (stage.start.y + 0.5) * this.tileSize;
    this.player.facing = stage.start.facing;
    const initialPotions = Number.isInteger(stage.initialSkillPotions) ? stage.initialSkillPotions : 0;
    this.inventory.skillPotion = initialPotions;
    this.player.skillEnergy = 1 + initialPotions * 2;
  }

  getTargetTile() {
    const tile = this.getPlayerTile();
    const offsets = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const offset = offsets[this.player.facing];
    return { x: tile.x + offset.x, y: tile.y + offset.y };
  }

  isFixedObstacle(tileX, tileY) {
    const isWall = this.obstacles.some((obstacle) => (
      tileX >= obstacle.x
      && tileX < obstacle.x + obstacle.width
      && tileY >= obstacle.y
      && tileY < obstacle.y + obstacle.height
    ));
    const gate = this.stage.shortcutGate;
    const isClosedGate = gate && !this.shortcutGateOpen && tileX === gate.x && tileY === gate.y;
    const isClosedColorWall = this.colorWalls.some((wall) => (
      !this.openColors.has(wall.color.toLowerCase())
      && tileX >= wall.x
      && tileX < wall.x + wall.width
      && tileY >= wall.y
      && tileY < wall.y + wall.height
    ));
    const isLaserEmitter = this.lasers.some((laser) => laser.x === tileX && laser.y === tileY);
    return isWall || isClosedGate || isClosedColorWall || isLaserEmitter;
  }

  isEmptyFloor(tileX, tileY) {
    const columns = this.width / this.tileSize;
    const rows = this.height / this.tileSize;
    if (tileX <= 0 || tileY <= 0 || tileX >= columns - 1 || tileY >= rows - 1) return false;
    if (this.isFixedObstacle(tileX, tileY)) return false;
    return !this.blocks.some((block) => block.x === tileX && block.y === tileY);
  }

  captureState() {
    return {
      x: this.player.x,
      y: this.player.y,
      facing: this.player.facing,
      blocks: this.blocks.map((block) => ({ ...block })),
      clipboard: this.cloneClipboard(this.clipboard),
      selectedBlockIds: [...this.selectedBlockIds],
      shortcutGateOpen: this.shortcutGateOpen,
      openColors: [...this.openColors],
      skillEnergy: this.player.skillEnergy,
    };
  }

  restoreState(state) {
    this.player.x = state.x;
    this.player.y = state.y;
    this.player.facing = state.facing;
    const restoredBlocks = state.blocks.map((block) => ({ ...block }));
    for (const bridge of this.blocks.filter((block) => block.waterFilled)) {
      const index = restoredBlocks.findIndex((block) => block.id === bridge.id);
      if (index >= 0) restoredBlocks[index] = { ...bridge }; else restoredBlocks.push({ ...bridge });
    }
    this.blocks = restoredBlocks;
    this.clipboard = this.cloneClipboard(state.clipboard);
    const selectableIds = new Set(restoredBlocks.filter((block) => !block.waterFilled).map((block) => block.id));
    this.selectedBlockIds = new Set((state.selectedBlockIds ?? []).filter((id) => selectableIds.has(id)));
    this.shortcutGateOpen = state.shortcutGateOpen;
    this.openColors = new Set(state.openColors);
    this.player.skillEnergy = state.skillEnergy;
    this.rebuildLaserBeams();
    this.checkPlayerLaserCollision();
  }

  recordUndo() {
    this.undoStack.push(this.captureState());
    this.redoStack.length = 0;
  }

  undo() {
    if (this.undoStack.length === 0) {
      this.lastShortcutMessage = '取り消せる操作がありません';
      audio.playSe('error');
      return;
    }
    this.redoStack.push(this.captureState());
    this.restoreState(this.undoStack.pop());
    this.openColors = this.computeOpenColors();
    this.lastShortcutMessage = '直前の操作を取り消しました';
    this.playShortcutSound('undo');
  }

  redo() {
    if (this.redoStack.length === 0) {
      this.lastShortcutMessage = 'やり直せる操作がありません';
      audio.playSe('error');
      return;
    }
    this.undoStack.push(this.captureState());
    this.restoreState(this.redoStack.pop());
    this.openColors = this.computeOpenColors();
    this.lastShortcutMessage = '操作をやり直しました';
    this.playShortcutSound('redo');
  }

  computeOpenColors() {
    const open = new Set();
    for (const switchTile of this.colorSwitches) {
      const blocksOnSwitch = this.blocks.filter(
        (block) =>
          block.kind === 'colored' &&
          block.x === switchTile.x &&
          block.y === switchTile.y,
      );
      if (blocksOnSwitch.length > 0) {
        for (const block of blocksOnSwitch) {
          if (
            block.color &&
            block.color.toLowerCase() === switchTile.color.toLowerCase()
          ) {
            open.add(switchTile.color.toLowerCase());
          }
        }
      }
    }
    return open;
  }

  rebuildLaserBeams() {
    const offsets = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
    const beamTiles = new Set();
    const visuals = [];
    const emitterTiles = new Set(this.lasers.map((laser) => `${laser.x},${laser.y}`));
    for (const laser of this.lasers) {
      const offset = offsets[laser.direction];
      if (!offset) continue;
      const cells = [];
      for (let step = 1; step <= laser.length; step += 1) {
        const tileX = laser.x + offset.x * step;
        const tileY = laser.y + offset.y * step;
        if (tileX <= 0 || tileY <= 0 || tileX >= this.width / this.tileSize - 1 || tileY >= this.height / this.tileSize - 1) break;
        if (this.isFixedObstacle(tileX, tileY) || emitterTiles.has(`${tileX},${tileY}`)) break;
        const block = this.blocks.find((candidate) => candidate.x === tileX && candidate.y === tileY);
        if (block && block.kind !== 'colored') break;
        cells.push({ x: tileX, y: tileY });
        beamTiles.add(`${tileX},${tileY}`);
      }
      visuals.push({ laser, cells });
    }
    this.laserBeamTiles = beamTiles;
    this.laserVisuals = visuals;
  }

  update(deltaTime = 0) {
    this.elapsed += deltaTime;
    if (this.gameOver || this.runCleared) return;
    if (this.checkPlayerLaserCollision()) return;
    this.collectNearbyItems();
  }

  collectNearbyItems() {
    for (const item of this.items) {
      if (item.collected || item.type !== 'skillPotion') continue;
      const itemX = (item.x + 0.5) * this.tileSize;
      const itemY = (item.y + 0.5) * this.tileSize;
      if (Math.hypot(this.player.x - itemX, this.player.y - itemY) > this.player.radius + 12) continue;
      item.collected = true;
      this.inventory.skillPotion += 1;
      this.player.skillEnergy += 2;
      this.lastShortcutMessage = '青いスキルポーションを入手！エナジー +2';
    }
  }

  checkGoal() {
    const tile = this.getPlayerTile();
    if (tile.x !== this.goal.x || tile.y !== this.goal.y) return;

    this.completedStageIds.add(this.stage.id);
    const nextStage = this.stageManager.advance();
    if (nextStage) {
      this.loadStage(nextStage);
      this.onProgress?.({
        completedStageIds: [...this.completedStageIds],
        currentStageId: nextStage.id,
      });
      this.onStageChange?.(nextStage);
      this.lastShortcutMessage = `STAGE ${nextStage.number}開始: ${nextStage.name}`;
      return;
    }

    this.runCleared = true;
    this.onProgress?.({
      completedStageIds: [...this.completedStageIds],
      currentStageId: null,
    });
    this.lastShortcutMessage = this.roomMode
      ? '選択したステージをすべてクリア！待機画面に戻っています…'
      : '全ステージクリア！ R / Enter で最初から';
    this.input.setEnabled(false);
    if (!this.roomMode) window.addEventListener('keydown', this.handleRetryKeyDown);
  }

  resetRun() {
    window.removeEventListener('keydown', this.handleRetryKeyDown);
    this.stage = this.stageManager.reset();
    this.loadStage(this.stage);
    this.lastShortcutMessage = 'ダンジョンに再挑戦！青いポーションを回収しよう';
    this.input.setEnabled(true);
    this.canvas.focus({ preventScroll: true });
  }

  canOccupy(tileX, tileY) {
    const columns = this.width / this.tileSize;
    const rows = this.height / this.tileSize;
    if (tileX <= 0 || tileY <= 0 || tileX >= columns - 1 || tileY >= rows - 1) return false;
    if (this.isFixedObstacle(tileX, tileY)) return false;

    const block = this.blocks.find((candidate) => candidate.x === tileX && candidate.y === tileY);
    if (this.isWaterTile(tileX, tileY)) return block?.kind === 'normal';
    if (block) return false;
    return true;
  }

  render() {
    const { context: ctx, width, height } = this;
    ctx.clearRect(0, 0, width, height);

    this.drawBackground(ctx);
    this.drawFloor(ctx);
    this.drawWater(ctx);
    this.drawGoal(ctx);
    this.drawShortcutGate(ctx);
    this.drawColorWalls(ctx);
    this.drawObstacles(ctx);
    this.drawColorSwitches(ctx);
    this.drawLasers(ctx);
    this.drawBlocks(ctx);
    this.drawItems(ctx);
    this.drawTargetCursor(ctx);
    this.drawPlayer(ctx);
    drawVignette(ctx, width, height);
    this.drawHud(ctx);
    this.drawRunClear(ctx);
    this.drawGameOver(ctx);
  }

  drawRunClear(ctx) {
    if (!this.runCleared) return;
    const { width, height } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(4, 12, 17, 0.68)';
    ctx.fillRect(0, 0, width, height);
    const panelWidth = 420;
    const panelHeight = 170;
    const panelX = (width - panelWidth) / 2;
    const panelY = (height - panelHeight) / 2;
    drawPanel(ctx, { x: panelX, y: panelY, width: panelWidth, height: panelHeight, radius: 18,
      fill: 'rgba(24, 49, 60, 0.97)', stroke: 'rgba(112, 225, 193, 0.65)', lineWidth: 1.5,
      shadowBlur: 26, shadowColor: 'rgba(112, 225, 193, 0.24)' });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.unlocked;
    ctx.font = '800 13px system-ui, sans-serif';
    ctx.fillText(this.roomMode ? 'ROOM MISSION COMPLETE' : 'DUNGEON COMPLETE', width / 2, panelY + 42);
    ctx.fillStyle = COLORS.text;
    ctx.font = '800 24px system-ui, sans-serif';
    ctx.fillText(this.roomMode ? '選択ステージをすべてクリア！' : '全ステージクリア！', width / 2, panelY + 82);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.fillText(this.roomMode ? '待機画面に戻っています…' : 'R / Enter で最初から遊ぶ', width / 2, panelY + 126);
    ctx.restore();
  }
  drawGameOver(ctx) {
    if (!this.gameOver) return;
    const { width, height } = this;
    ctx.save();
    ctx.fillStyle = 'rgba(4, 12, 17, 0.66)';
    ctx.fillRect(0, 0, width, height);

    const panelWidth = 380;
    const panelHeight = 150;
    const panelX = (width - panelWidth) / 2;
    const panelY = (height - panelHeight) / 2;
    drawPanel(ctx, {
      x: panelX,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
      radius: 18,
      fill: 'rgba(24, 49, 60, 0.97)',
      stroke: 'rgba(255, 94, 104, 0.6)',
      lineWidth: 1.5,
      shadowBlur: 26,
      shadowColor: 'rgba(255, 94, 104, 0.28)',
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.laser;
    ctx.font = '800 24px "Cascadia Code", Consolas, monospace';
    ctx.fillText('GAME OVER', width / 2, panelY + 42);
    ctx.fillStyle = COLORS.text;
    ctx.font = '13px "Yu Gothic UI", sans-serif';
    ctx.fillText(truncateText(ctx, this.gameOverReason, panelWidth - 40), width / 2, panelY + 76);

    drawKeycap(ctx, width / 2 - 68, panelY + 100, 48, 20, 'R');
    drawKeycap(ctx, width / 2 - 12, panelY + 100, 64, 20, 'Enter');
    ctx.fillStyle = COLORS.muted;
    ctx.font = '11px "Yu Gothic UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('でこのステージに再挑戦', width / 2 + 60, panelY + 110);
    ctx.restore();
  }

  drawBackground(ctx) {
    const { width, height } = this;
    const background = ctx.createLinearGradient(0, 0, 0, height);
    background.addColorStop(0, '#0e1e29');
    background.addColorStop(0.55, COLORS.background);
    background.addColorStop(1, '#102430');
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width / 2, height * 0.44, 0, width / 2, height * 0.44, width * 0.55);
    glow.addColorStop(0, 'rgba(96, 180, 168, 0.2)');
    glow.addColorStop(0.6, 'rgba(40, 100, 98, 0.07)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  drawGoal(ctx) {
    const x = (this.goal.x + 0.5) * this.tileSize;
    const y = (this.goal.y + 0.5) * this.tileSize;
    const color = COLORS.unlocked;
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 2.6);

    ctx.save();
    const halo = ctx.createRadialGradient(x, y, 2, x, y, 30);
    halo.addColorStop(0, 'rgba(112, 225, 193, 0.34)');
    halo.addColorStop(0.55, 'rgba(112, 225, 193, 0.12)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(x - 34, y - 34, 68, 68);

    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(112, 225, 193, 0.16)';
    ctx.fill();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 + pulse * 8;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.translate(x, y);
    ctx.rotate(this.elapsed * 0.35);
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0.15, Math.PI * 0.85);
    ctx.arc(0, 0, 21, Math.PI + 0.15, Math.PI * 1.85);
    ctx.strokeStyle = 'rgba(213, 255, 242, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(-this.elapsed * 0.35);

    ctx.beginPath();
    const sparkle = 4.5 + pulse * 1.5;
    ctx.moveTo(0, -sparkle);
    ctx.lineTo(sparkle * 0.65, 0);
    ctx.lineTo(0, sparkle);
    ctx.lineTo(-sparkle * 0.65, 0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    ctx.fillStyle = color;
    ctx.font = '800 8px "Cascadia Code", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GOAL', 0, 12);
    ctx.restore();
  }

  drawShortcutGate(ctx) {
    const gate = this.stage.shortcutGate;
    if (!gate) return;
    const x = gate.x * this.tileSize;
    const y = gate.y * this.tileSize;
    const open = this.shortcutGateOpen;
    const color = open ? COLORS.unlocked : COLORS.locked;

    drawPanel(ctx, {
      x: x + 3,
      y: y + 3,
      width: this.tileSize - 6,
      height: this.tileSize - 6,
      radius: 7,
      fill: open ? 'rgba(112, 225, 193, 0.13)' : 'rgba(219, 125, 89, 0.18)',
      stroke: color,
      lineWidth: 1.5,
      shadowBlur: open ? 12 : 0,
      shadowColor: 'rgba(112, 225, 193, 0.45)',
    });

    if (!open) {
      ctx.save();
      roundedRectPath(ctx, x + 4, y + 4, this.tileSize - 8, this.tileSize - 8, 6);
      ctx.clip();
      ctx.strokeStyle = 'rgba(219, 125, 89, 0.18)';
      ctx.lineWidth = 1;
      for (let offset = -this.tileSize; offset < this.tileSize; offset += 7) {
        ctx.beginPath();
        ctx.moveTo(x + offset, y + this.tileSize);
        ctx.lineTo(x + offset + this.tileSize, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.5;
    if (open) {
      ctx.font = '800 15px "Cascadia Code", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('»', x + this.tileSize / 2, y + 14);
    } else {
      ctx.strokeRect(x + 16, y + 9, 8, 6);
      ctx.beginPath();
      ctx.arc(x + 20, y + 9, 3, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    ctx.font = '800 7.5px "Cascadia Code", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? 'OPEN' : 'COPY', x + this.tileSize / 2, y + 27);
    ctx.restore();
  }

  drawFloor(ctx) {
    const { width, height, tileSize } = this;
    const columns = width / tileSize;
    const rows = height / tileSize;
    const floorGradient = ctx.createLinearGradient(0, tileSize, 0, height - tileSize);
    floorGradient.addColorStop(0, '#223a45');
    floorGradient.addColorStop(0.5, COLORS.floor);
    floorGradient.addColorStop(1, '#172831');
    ctx.fillStyle = floorGradient;
    ctx.fillRect(tileSize, tileSize, width - tileSize * 2, height - tileSize * 2);

    for (let row = 1; row < rows - 1; row += 1) {
      for (let column = 1; column < columns - 1; column += 1) {
        if ((row + column) % 2 === 0) continue;
        ctx.fillStyle = COLORS.floorAlt;
        ctx.fillRect(column * tileSize, row * tileSize, tileSize, tileSize);
      }
    }

    ctx.beginPath();
    for (let x = tileSize; x <= width - tileSize; x += tileSize) {
      ctx.moveTo(x, tileSize);
      ctx.lineTo(x, height - tileSize);
    }
    for (let y = tileSize; y <= height - tileSize; y += tileSize) {
      ctx.moveTo(tileSize, y);
      ctx.lineTo(width - tileSize, y);
    }
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.stroke();

    const wallGradient = ctx.createLinearGradient(0, 0, 0, height);
    wallGradient.addColorStop(0, '#3a5a62');
    wallGradient.addColorStop(0.5, COLORS.wallDark);
    wallGradient.addColorStop(1, '#2b4650');
    ctx.fillStyle = wallGradient;
    ctx.fillRect(0, 0, width, tileSize);
    ctx.fillRect(0, height - tileSize, width, tileSize);
    ctx.fillRect(0, tileSize, tileSize, height - tileSize * 2);
    ctx.fillRect(width - tileSize, tileSize, tileSize, height - tileSize * 2);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.fillRect(0, 1, width, 1);
    ctx.fillRect(0, height - tileSize, width, 1);
    ctx.fillRect(1, 0, 1, height);
    ctx.fillRect(width - 2, 0, 1, height);

    ctx.strokeStyle = 'rgba(112, 225, 193, 0.24)';
    ctx.lineWidth = 1;
    ctx.strokeRect(tileSize - 0.5, tileSize - 0.5, width - tileSize * 2 + 1, height - tileSize * 2 + 1);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.strokeRect(tileSize + 1.5, tileSize + 1.5, width - tileSize * 2 - 3, height - tileSize * 2 - 3);

    const corner = 16;
    const inset = 12;
    ctx.strokeStyle = 'rgba(243, 201, 105, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(inset, inset + corner);
    ctx.lineTo(inset, inset);
    ctx.lineTo(inset + corner, inset);
    ctx.moveTo(width - inset - corner, inset);
    ctx.lineTo(width - inset, inset);
    ctx.lineTo(width - inset, inset + corner);
    ctx.moveTo(inset, height - inset - corner);
    ctx.lineTo(inset, height - inset);
    ctx.lineTo(inset + corner, height - inset);
    ctx.moveTo(width - inset - corner, height - inset);
    ctx.lineTo(width - inset, height - inset);
    ctx.lineTo(width - inset, height - inset - corner);
    ctx.stroke();
  }

  drawObstacles(ctx) {
    for (const obstacle of this.obstacles) {
      const x = obstacle.x * this.tileSize;
      const y = obstacle.y * this.tileSize;
      const width = obstacle.width * this.tileSize;
      const height = obstacle.height * this.tileSize;
      const gradient = ctx.createLinearGradient(0, y, 0, y + height);
      gradient.addColorStop(0, '#4a6a74');
      gradient.addColorStop(0.14, '#3d5864');
      gradient.addColorStop(1, '#263b45');

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 3;
      roundedRectPath(ctx, x + 3, y + 3, width - 6, height - 6, 5);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.strokeStyle = 'rgba(170, 208, 205, 0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.fillRect(x + 7, y + 7, width - 14, 4);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
      ctx.fillRect(x + 7, y + height - 8, width - 14, 2);

      if (width >= this.tileSize && height >= this.tileSize) {
        ctx.fillStyle = 'rgba(157, 190, 196, 0.15)';
        ctx.fillRect(x + 10, y + 16, width - 20, 1);
      }
      ctx.restore();
    }
  }

  drawColorWalls(ctx) {
    for (const wall of this.colorWalls) {
      const open = this.openColors.has(wall.color.toLowerCase());
      for (let tileY = wall.y; tileY < wall.y + wall.height; tileY += 1) {
        for (let tileX = wall.x; tileX < wall.x + wall.width; tileX += 1) {
          const x = tileX * this.tileSize;
          const y = tileY * this.tileSize;
          const baseX = wall.x * this.tileSize;
          const baseY = wall.y * this.tileSize;
          const baseWidth = wall.width * this.tileSize;
          const baseHeight = wall.height * this.tileSize;

          if (open) {
            ctx.save();
            ctx.strokeStyle = wall.color;
            ctx.globalAlpha = 0.28;
            ctx.lineWidth = 1.5;
            roundedRectPath(ctx, x + 6, y + 6, this.tileSize - 12, this.tileSize - 12, 4);
            ctx.stroke();
            ctx.restore();
            continue;
          }

          ctx.save();
          const gradient = ctx.createLinearGradient(0, y, 0, y + this.tileSize);
          gradient.addColorStop(0, shadeColor(wall.color, 26));
          gradient.addColorStop(0.55, wall.color);
          gradient.addColorStop(1, shadeColor(wall.color, -46));
          ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
          ctx.shadowBlur = 6;
          ctx.shadowOffsetY = 2;
          roundedRectPath(ctx, x + 3, y + 3, this.tileSize - 6, this.tileSize - 6, 5);
          ctx.fillStyle = gradient;
          ctx.fill();
          ctx.shadowColor = 'transparent';

          roundedRectPath(ctx, x + 4, y + 4, this.tileSize - 8, this.tileSize - 8, 4);
          ctx.clip();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
          ctx.lineWidth = 1;
          for (let offset = -this.tileSize; offset < this.tileSize; offset += 8) {
            ctx.beginPath();
            ctx.moveTo(x + offset, y + this.tileSize);
            ctx.lineTo(x + offset + this.tileSize, y);
            ctx.stroke();
          }
          ctx.restore();

          if (tileX === wall.x && tileY === wall.y) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.font = '800 7px "Cascadia Code", Consolas, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('COLOR', baseX + baseWidth / 2, baseY + baseHeight / 2);
            ctx.restore();
          }
        }
      }
    }
  }

  drawWater(ctx) {
    for (const tile of this.water) {
      const x = tile.x * this.tileSize;
      const y = tile.y * this.tileSize;
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 2.4 + tile.x * 0.8 + tile.y * 0.5);

      ctx.save();
      const glow = ctx.createRadialGradient(
        x + this.tileSize / 2,
        y + this.tileSize / 2,
        2,
        x + this.tileSize / 2,
        y + this.tileSize / 2,
        this.tileSize * 0.7,
      );
      glow.addColorStop(0, 'rgba(96, 206, 238, 0.36)');
      glow.addColorStop(1, 'rgba(31, 122, 168, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 6, y - 6, this.tileSize + 12, this.tileSize + 12);

      const waterGradient = ctx.createLinearGradient(0, y, 0, y + this.tileSize);
      waterGradient.addColorStop(0, '#75d7ed');
      waterGradient.addColorStop(0.45, COLORS.water);
      waterGradient.addColorStop(1, '#164767');
      ctx.fillStyle = waterGradient;
      ctx.fillRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4);

      ctx.fillStyle = `rgba(187, 245, 255, ${0.3 + pulse * 0.35})`;
      for (let offset = 9; offset < this.tileSize - 4; offset += 9) {
        const bubble = Math.sin(this.elapsed * 2 + offset + tile.x) * 2;
        ctx.beginPath();
        ctx.arc(x + offset, y + this.tileSize - 12 + bubble, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(168, 239, 255, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 2.5, y + 2.5, this.tileSize - 5, this.tileSize - 5);
      ctx.restore();
    }
  }

  drawLasers(ctx) {
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 6);
    const directions = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };

    for (const visual of this.laserVisuals) {
      const direction = directions[visual.laser.direction] ?? directions.right;
      for (const cell of visual.cells) {
        const x = cell.x * this.tileSize;
        const y = cell.y * this.tileSize;
        ctx.save();
        const glow = ctx.createRadialGradient(
          x + this.tileSize / 2,
          y + this.tileSize / 2,
          2,
          x + this.tileSize / 2,
          y + this.tileSize / 2,
          this.tileSize * 0.62,
        );
        glow.addColorStop(0, `rgba(255, 94, 104, ${0.5 + pulse * 0.25})`);
        glow.addColorStop(1, 'rgba(255, 94, 104, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - 4, y - 4, this.tileSize + 8, this.tileSize + 8);

        ctx.strokeStyle = `rgba(255, 148, 156, ${0.55 + pulse * 0.35})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = -this.elapsed * 34;
        ctx.beginPath();
        ctx.moveTo(
          x + this.tileSize / 2 - direction.x * 10,
          y + this.tileSize / 2 - direction.y * 10,
        );
        ctx.lineTo(
          x + this.tileSize / 2 + direction.x * 10,
          y + this.tileSize / 2 + direction.y * 10,
        );
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      this.drawLaserEmitter(ctx, visual.laser, pulse);
    }
  }

  drawLaserEmitter(ctx, laser, pulse) {
    const x = laser.x * this.tileSize;
    const y = laser.y * this.tileSize;
    const centerX = x + this.tileSize / 2;
    const centerY = y + this.tileSize / 2;
    const offsets = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const direction = offsets[laser.direction] ?? offsets.right;

    ctx.save();
    const body = ctx.createLinearGradient(0, y, 0, y + this.tileSize);
    body.addColorStop(0, '#5b3340');
    body.addColorStop(1, '#2a1a22');
    roundedRectPath(ctx, x + 4, y + 4, this.tileSize - 8, this.tileSize - 8, 6);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = COLORS.laser;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.shadowColor = COLORS.laser;
    ctx.shadowBlur = 8 + pulse * 8;
    ctx.fillStyle = '#ff9ba2';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLORS.laser;
    ctx.beginPath();
    ctx.moveTo(centerX + direction.x * 13, centerY + direction.y * 13);
    ctx.lineTo(
      centerX - direction.y * 5 - direction.x * 5,
      centerY + direction.x * 5 - direction.y * 5,
    );
    ctx.lineTo(
      centerX + direction.y * 5 - direction.x * 5,
      centerY - direction.x * 5 - direction.y * 5,
    );
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawColorSwitches(ctx) {
    for (const colorSwitch of this.colorSwitches) {
      const x = (colorSwitch.x + 0.5) * this.tileSize;
      const y = (colorSwitch.y + 0.5) * this.tileSize;
      const open = this.openColors.has(colorSwitch.color.toLowerCase());
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 3.2 + colorSwitch.x);

      ctx.save();
      const halo = ctx.createRadialGradient(x, y, 1, x, y, 22);
      halo.addColorStop(0, `${colorSwitch.color}55`);
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x - 22, y - 22, 44, 44);

      ctx.strokeStyle = colorSwitch.color;
      ctx.shadowColor = colorSwitch.color;
      ctx.shadowBlur = open ? 4 : 8 + pulse * 6;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.beginPath();
      ctx.arc(x, y, open ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = open ? 'rgba(255, 255, 255, 0.85)' : colorSwitch.color;
      ctx.fill();

      ctx.fillStyle = open ? '#d5fff2' : colorSwitch.color;
      ctx.font = '800 7px "Cascadia Code", Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(open ? 'OPEN' : 'COLOR', x, y + 20);
      ctx.restore();
    }
  }

  drawBlocks(ctx) {
    for (const block of this.blocks) {
      const x = block.x * this.tileSize;
      const y = block.y * this.tileSize;
      const colored = block.kind === 'colored';
      const gradient = ctx.createLinearGradient(0, y + 4, 0, y + this.tileSize - 4);
      gradient.addColorStop(0, shadeColor(block.color, 24));
      gradient.addColorStop(0.48, block.color);
      gradient.addColorStop(1, shadeColor(block.color, -38));

      ctx.save();
      if (colored) {
        ctx.shadowColor = block.color;
        ctx.shadowBlur = 12;
      } else {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 8;
      }
      ctx.shadowOffsetY = 4;
      roundedRectPath(ctx, x + 5, y + 4, this.tileSize - 10, this.tileSize - 11, 5);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.strokeStyle = colored ? '#ffffff' : 'rgba(255, 239, 210, 0.55)';
      ctx.lineWidth = colored ? 1.6 : 1.2;
      ctx.stroke();

      if (this.selectedBlockIds.has(block.id)) {
        ctx.save();
        ctx.shadowColor = COLORS.unlocked;
        ctx.shadowBlur = 8;
        ctx.strokeStyle = '#8fffe0';
        ctx.lineWidth = 2.2;
        ctx.setLineDash([4, 2]);
        roundedRectPath(ctx, x + 1.5, y + 1.5, this.tileSize - 3, this.tileSize - 3, 7);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(x + this.tileSize - 7, y + 7, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#8fffe0';
        ctx.fill();
        ctx.strokeStyle = '#09201b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + this.tileSize - 9.5, y + 7);
        ctx.lineTo(x + this.tileSize - 7.5, y + 9);
        ctx.lineTo(x + this.tileSize - 4, y + 4.5);
        ctx.stroke();
        ctx.restore();
      }

      ctx.fillStyle = 'rgba(255, 247, 233, 0.22)';
      ctx.fillRect(x + 9, y + 8, this.tileSize - 18, 3);
      ctx.fillStyle = 'rgba(38, 22, 12, 0.28)';
      ctx.fillRect(x + 8, y + this.tileSize - 12, this.tileSize - 16, 2);

      ctx.fillStyle = '#fff7e9';
      ctx.font = `800 ${block.name.length > 4 ? 8 : 10}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(truncateText(ctx, block.name, this.tileSize - 12), x + this.tileSize / 2, y + this.tileSize / 2 + 1);

      if (colored) {
        ctx.beginPath();
        ctx.arc(x + this.tileSize - 10, y + 10, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(255, 247, 233, 0.55)';
      ctx.beginPath();
      ctx.arc(x + 10, y + this.tileSize - 11, 1.2, 0, Math.PI * 2);
      ctx.arc(x + this.tileSize - 10, y + this.tileSize - 11, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawTargetCursor(ctx) {
    const target = this.getTargetTile();
    const x = target.x * this.tileSize;
    const y = target.y * this.tileSize;
    const pulse = 0.5 + 0.5 * Math.sin(this.elapsed * 4);
    const length = 8;

    ctx.save();
    ctx.fillStyle = `rgba(112, 225, 193, ${0.035 + pulse * 0.035})`;
    ctx.fillRect(x + 2, y + 2, this.tileSize - 4, this.tileSize - 4);
    ctx.strokeStyle = `rgba(172, 255, 226, ${0.55 + pulse * 0.28})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(x + 5, y + 5 + length);
    ctx.lineTo(x + 5, y + 5);
    ctx.lineTo(x + 5 + length, y + 5);
    ctx.moveTo(x + this.tileSize - 5 - length, y + 5);
    ctx.lineTo(x + this.tileSize - 5, y + 5);
    ctx.lineTo(x + this.tileSize - 5, y + 5 + length);
    ctx.moveTo(x + 5, y + this.tileSize - 5 - length);
    ctx.lineTo(x + 5, y + this.tileSize - 5);
    ctx.lineTo(x + 5 + length, y + this.tileSize - 5);
    ctx.moveTo(x + this.tileSize - 5 - length, y + this.tileSize - 5);
    ctx.lineTo(x + this.tileSize - 5, y + this.tileSize - 5);
    ctx.lineTo(x + this.tileSize - 5, y + this.tileSize - 5 - length);
    ctx.stroke();
    ctx.restore();
  }

  drawItems(ctx) {
    for (const item of this.items) {
      if (item.collected) continue;
      const x = (item.x + 0.5) * this.tileSize;
      const y = (item.y + 0.5) * this.tileSize;
      const bob = Math.sin(this.elapsed * 3 + item.x * 0.9 + item.y * 0.7) * 2.4;
      if (item.type !== 'skillPotion') continue;
      const color = COLORS.skillPotion;
      const label = 'S';

      ctx.save();
      const halo = ctx.createRadialGradient(x, y + bob, 1, x, y + bob, 21);
      halo.addColorStop(0, 'rgba(74, 168, 255, 0.28)');
      halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x - 22, y + bob - 22, 44, 44);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
      ctx.beginPath();
      ctx.ellipse(x, y + 13, 8, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      drawPotion(ctx, x, y + bob, 18, color, label);
      ctx.restore();
    }
  }

  drawHud(ctx) {
    ctx.save();
    const panelFill = ctx.createLinearGradient(0, 10, 0, 64);
    panelFill.addColorStop(0, 'rgba(34, 61, 72, 0.95)');
    panelFill.addColorStop(1, 'rgba(15, 33, 43, 0.9)');
    this.drawBrandPanel(ctx, panelFill);
    this.drawStagePanel(ctx, panelFill);
    this.drawStatusPanel(ctx, panelFill);
    this.drawMessageBar(ctx);
    ctx.restore();
  }

  drawBrandPanel(ctx, panelFill) {
    drawPanel(ctx, {
      x: 52,
      y: 10,
      width: 210,
      height: 54,
      radius: 14,
      fill: panelFill,
      shadowBlur: 16,
      shadowOffsetY: 5,
      highlight: true,
    });
    drawPanel(ctx, {
      x: 64,
      y: 23,
      width: 28,
      height: 28,
      radius: 9,
      fill: 'rgba(243, 201, 105, 0.1)',
      stroke: 'rgba(243, 201, 105, 0.5)',
      lineWidth: 1.2,
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.accent;
    ctx.font = '800 14px "Cascadia Code", Consolas, monospace';
    ctx.fillText('K', 78, 38);

    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.text;
    ctx.font = '800 12px Inter, "Yu Gothic UI", sans-serif';
    ctx.fillText('SHORTCUT', 102, 30);
    ctx.fillStyle = COLORS.unlocked;
    ctx.font = '800 12px Inter, "Yu Gothic UI", sans-serif';
    ctx.fillText('DUNGEON', 102, 46);
  }

  drawStagePanel(ctx, panelFill) {
    drawPanel(ctx, {
      x: 274,
      y: 10,
      width: 270,
      height: 54,
      radius: 14,
      fill: panelFill,
      shadowBlur: 16,
      shadowOffsetY: 5,
      highlight: true,
    });

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.muted;
    ctx.font = '700 8px Inter, "Yu Gothic UI", sans-serif';
    ctx.fillText('STAGE', 288, 23);

    ctx.fillStyle = COLORS.accent;
    ctx.font = '800 24px "Cascadia Code", Consolas, monospace';
    ctx.fillText(String(this.stage.number).padStart(2, '0'), 287, 45);

    drawDivider(ctx, 334, 18, 38);

    ctx.fillStyle = COLORS.text;
    ctx.font = '700 13px "Yu Gothic UI", sans-serif';
    ctx.fillText(truncateText(ctx, this.stage.name, 128), 346, 28);

    ctx.fillStyle = COLORS.muted;
    ctx.font = '10px "Yu Gothic UI", sans-serif';
    const hint = this.stage.hint || '自由に探索してゴールを目指そう';
    ctx.fillText(truncateText(ctx, hint, 188), 346, 48);

    const statusColor = COLORS.unlocked;
    drawPanel(ctx, {
      x: 480,
      y: 18,
      width: 52,
      height: 19,
      radius: 9,
      fill: 'rgba(112, 225, 193, 0.12)',
      stroke: 'rgba(112, 225, 193, 0.45)',
      lineWidth: 1,
    });
    ctx.fillStyle = statusColor;
    ctx.shadowColor = statusColor;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(491, 27.5, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = '800 8px "Cascadia Code", Consolas, monospace';
    ctx.fillText('GOAL', 499, 28);
  }

  drawStatusPanel(ctx, panelFill) {
    drawPanel(ctx, {
      x: 556,
      y: 10,
      width: 352,
      height: 54,
      radius: 14,
      fill: panelFill,
      shadowBlur: 16,
      shadowOffsetY: 5,
      highlight: true,
    });

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.muted;
    ctx.font = '700 8px Inter, "Yu Gothic UI", sans-serif';

    ctx.fillText('SKILL', 570, 23);
    drawEnergyGem(ctx, 576, 43, 8, COLORS.skillPotion, this.player.skillEnergy > 0);
    ctx.fillStyle = COLORS.skillPotion;
    ctx.font = '800 11px "Cascadia Code", Consolas, monospace';
    ctx.fillText(`x${this.player.skillEnergy}`, 588, 43);

    drawDivider(ctx, 624, 18, 38);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '700 8px Inter, "Yu Gothic UI", sans-serif';
    ctx.fillText('ITEMS', 636, 23);
    drawPotion(ctx, 643, 43, 13, COLORS.skillPotion, 'S');
    ctx.fillStyle = COLORS.text;
    ctx.font = '800 10px "Cascadia Code", Consolas, monospace';
    ctx.fillText(`x${this.inventory.skillPotion}`, 655, 43);

    drawDivider(ctx, 700, 18, 38);
    ctx.fillStyle = COLORS.muted;
    ctx.font = '700 8px Inter, "Yu Gothic UI", sans-serif';
    ctx.fillText('CLIP', 712, 23);
    drawKeycap(ctx, 712, 33, 17, 17, 'C', { color: COLORS.unlocked });
    ctx.fillStyle = this.clipboard ? COLORS.text : COLORS.muted;
    ctx.font = '700 10.5px "Yu Gothic UI", sans-serif';
    const clipboardCount = this.clipboard?.blocks?.length ?? 0;
    const clipboardBlock = this.clipboard?.blocks?.[0];
    const clipboardLabel = clipboardCount > 1
      ? `${clipboardCount}個の木箱`
      : clipboardBlock
        ? `${clipboardBlock.kind === 'colored' ? '色:' : ''}${clipboardBlock.name}`
        : 'なし';
    ctx.fillText(truncateText(ctx, clipboardLabel, 52), 735, 42);
  }

  drawMessageBar(ctx) {
    drawPanel(ctx, {
      x: 52,
      y: this.height - 39,
      width: this.width - 104,
      height: 30,
      radius: 10,
      fill: 'rgba(18, 38, 48, 0.94)',
      stroke: 'rgba(171, 226, 219, 0.26)',
      shadowBlur: 12,
      shadowOffsetY: 4,
    });

    const pulse = 0.6 + 0.4 * Math.sin(this.elapsed * 2.2);
    ctx.fillStyle = COLORS.unlocked;
    ctx.shadowColor = COLORS.unlocked;
    ctx.shadowBlur = 6 * pulse;
    ctx.beginPath();
    ctx.arc(66, this.height - 24, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.text;
    ctx.font = '11.5px "Yu Gothic UI", sans-serif';
    ctx.fillText(truncateText(ctx, this.lastShortcutMessage, 500), 78, this.height - 23);

    drawKeycap(ctx, 682, this.height - 30, 44, 18, 'Ctrl+Z');
    ctx.fillStyle = COLORS.muted;
    ctx.font = '10px Inter, "Yu Gothic UI", sans-serif';
    ctx.fillText('Undo', 734, this.height - 21);
    drawKeycap(ctx, 786, this.height - 30, 44, 18, 'Ctrl+Y');
    ctx.fillStyle = COLORS.muted;
    ctx.font = '10px Inter, "Yu Gothic UI", sans-serif';
    ctx.fillText('Redo', 838, this.height - 21);
  }

  drawPlayer(ctx) {
    const { x, radius } = this.player;
    const y = this.player.y + Math.sin(this.elapsed * 3.4) * 1.2;
    const directions = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const direction = directions[this.player.facing] ?? directions.right;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.beginPath();
    ctx.ellipse(x, this.player.y + radius + 2, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const glow = ctx.createRadialGradient(x, y, 2, x, y, radius + 16);
    glow.addColorStop(0, 'rgba(112, 225, 193, 0.4)');
    glow.addColorStop(0.55, 'rgba(112, 225, 193, 0.12)');
    glow.addColorStop(1, 'rgba(112, 225, 193, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - radius - 18, y - radius - 18, (radius + 18) * 2, (radius + 18) * 2);

    const body = ctx.createRadialGradient(x - 5, y - 6, 1, x, y, radius);
    body.addColorStop(0, '#d5fff2');
    body.addColorStop(0.35, '#8ff0d6');
    body.addColorStop(1, '#38a98f');
    ctx.shadowColor = 'rgba(112, 225, 193, 0.65)';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COLORS.playerOutline;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x - 3.5, y - 4, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.52)';
    ctx.fill();

    const arrowX = x + direction.x * (radius + 6);
    const arrowY = y + direction.y * (radius + 6);
    ctx.translate(arrowX, arrowY);
    ctx.rotate(Math.atan2(direction.y, direction.x) + Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(4, 3);
    ctx.lineTo(-4, 3);
    ctx.closePath();
    ctx.fillStyle = COLORS.playerOutline;
    ctx.shadowColor = COLORS.unlocked;
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
  }

  dispose() {
    window.removeEventListener('keydown', this.handleRetryKeyDown);
    this.input.detach();
    this.canvas.removeEventListener('click', this.focusCanvas);
    audio.stopBgm();
  }
}


