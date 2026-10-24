export default class StageManager {
  constructor(stages) {
    if (!Array.isArray(stages) || stages.length === 0) {
      throw new TypeError('StageManagerには1つ以上のステージが必要です。');
    }
    this.stages = stages;
    this.index = 0;
  }

  get current() {
    return this.stages[this.index];
  }

  get total() {
    return this.stages.length;
  }

  advance() {
    if (this.index >= this.stages.length - 1) return null;
    this.index += 1;
    return this.current;
  }

  reset() {
    this.index = 0;
    return this.current;
  }
}