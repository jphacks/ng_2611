/** requestAnimationFrame を使った固定シーン向けのゲームループです。 */
export default class GameLoop {
  constructor({ update, render, maxDelta = 0.05 }) {
    if (typeof update !== 'function' || typeof render !== 'function') {
      throw new TypeError('GameLoopにはupdate関数とrender関数が必要です。');
    }

    this.update = update;
    this.render = render;
    this.maxDelta = maxDelta;
    this.running = false;
    this.frameId = null;
    this.previousTime = null;
    this.tick = this.tick.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.previousTime = null;
    this.frameId = globalThis.requestAnimationFrame(this.tick);
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.frameId !== null) {
      globalThis.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.previousTime = null;
  }

  tick(timestamp) {
    if (!this.running) return;

    const deltaTime = this.previousTime === null
      ? 0
      : Math.min((timestamp - this.previousTime) / 1000, this.maxDelta);
    this.previousTime = timestamp;

    this.update(deltaTime);
    this.render();

    if (this.running) {
      this.frameId = globalThis.requestAnimationFrame(this.tick);
    }
  }
}
