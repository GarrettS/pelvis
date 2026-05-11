export class LevelQuiz {
  #levels;
  #idx = 0;
  #revealed = false;

  constructor(levels) {
    this.#levels = levels;
  }

  current() { return this.#levels[this.#idx]; }
  position() { return this.#idx + 1; }
  count() { return this.#levels.length; }
  isLast() { return this.#idx === this.#levels.length - 1; }
  isRevealed() { return this.#revealed; }

  reveal() {
    this.#revealed = true;
  }

  advance() {
    this.#idx = (this.#idx + 1) % this.#levels.length;
    this.#revealed = false;
  }
}
