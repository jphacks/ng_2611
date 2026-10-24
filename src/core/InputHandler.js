const SHORTCUT_ACTIONS = {
  c: 'copy',
  v: 'paste',
  x: 'cut',
  z: 'undo',
  y: 'redo',
  a: 'selectAll',
  s: 'save',
  p: 'print',
};

const MOVEMENT_KEYS = {
  ArrowUp: 'up',
  w: 'up',
  ArrowDown: 'down',
  s: 'down',
  ArrowLeft: 'left',
  a: 'left',
  ArrowRight: 'right',
  d: 'right',
};

/**
 * ゲーム用のキーボード入力をまとめて処理します。
 * 認識したショートカットだけブラウザの既定動作を抑止します。
 */
export default class InputHandler {
  constructor({
    onShortcut = () => {},
    onMove = () => {},
    platform = InputHandler.getPlatform(),
    shortcuts = SHORTCUT_ACTIONS,
  } = {}) {
    this.onShortcut = onShortcut;
    this.onMove = onMove;
    this.platform = platform;
    this.shortcuts = { ...shortcuts };
    this.enabled = true;
    this.pressedKeys = new Set();
    this.target = null;

    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
  }

  static getPlatform() {
    return /Mac|iPhone|iPad|iPod/i.test(globalThis.navigator?.platform ?? '')
      ? 'mac'
      : 'windows';
  }

  /** 指定したイベントターゲットへの入力監視を開始します。 */
  attach(target = globalThis.window) {
    if (!target || this.target === target) return;
    this.detach();
    this.target = target;
    target.addEventListener('keydown', this.handleKeyDown);
    target.addEventListener('keyup', this.handleKeyUp);
    target.addEventListener('blur', this.handleBlur);
  }

  /** 入力監視を解除します。 */
  detach() {
    if (!this.target) return;
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.target.removeEventListener('blur', this.handleBlur);
    this.target = null;
    this.handleBlur();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.handleBlur();
  }

  handleKeyDown(event) {
    if (!this.enabled) return;

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const modifierPressed = event.ctrlKey || event.metaKey || event.altKey;
    const direction = modifierPressed ? undefined : MOVEMENT_KEYS[key];

    if (direction) {
      const isNewPress = !this.pressedKeys.has(key);
      this.pressedKeys.add(key);
      if (key.startsWith('Arrow')) event.preventDefault();
      const directionAlreadyPressed = [...this.pressedKeys].some((pressedKey) => (
        pressedKey !== key && MOVEMENT_KEYS[pressedKey] === direction
      ));
      if (isNewPress && !directionAlreadyPressed && !event.repeat) {
        this.onMove(direction, true, event);
      }
    }

    const shortcutModifierPressed = this.platform === 'mac' ? event.metaKey : event.ctrlKey;
    const action = this.shortcuts[key];
    if (!shortcutModifierPressed || !action || event.altKey) return;

    // Shift は redo (Ctrl/Cmd+Shift+Z) の場合だけ許可します。
    if (event.shiftKey && !(key === 'z' && action === 'undo')) return;

    event.preventDefault();
    if (event.repeat) return;
    this.onShortcut(
      {
        action: event.shiftKey ? 'redo' : action,
        key,
        modifier: this.platform === 'mac' ? 'Meta' : 'Control',
      },
      event,
    );
  }

  handleKeyUp(event) {
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!this.pressedKeys.delete(key)) return;

    const direction = MOVEMENT_KEYS[key];
    if (direction) {
      const directionStillPressed = [...this.pressedKeys].some((pressedKey) => (
        MOVEMENT_KEYS[pressedKey] === direction
      ));
      if (!directionStillPressed) this.onMove(direction, false, event);
    }
  }

  /** ウィンドウが非アクティブになった際、押下状態を解除します。 */
  handleBlur() {
    for (const key of this.pressedKeys) {
      const direction = MOVEMENT_KEYS[key];
      if (direction) this.onMove(direction, false);
    }
    this.pressedKeys.clear();
  }
}
