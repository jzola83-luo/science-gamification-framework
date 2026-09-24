import HanziWriter, { type CharacterJson, type StrokeData } from 'hanzi-writer';

export interface WritingCharacter {
  glyph: string;
  pinyin: string;
  meaning: string;
  data: CharacterJson;
}

export interface WritingResult {
  character: string;
  totalMistakes: number;
  hintsUsed: number;
}

export interface WritingSequenceResult {
  characters: WritingResult[];
  word: string;
}

type CharacterPhase = 'writing' | 'ready' | 'extra';

/** A mountable, offline stroke practice activity for a sequence of up to two characters. */
export class HanziWritingChallenge {
  private readonly root: HTMLElement;
  private readonly surfaces: HTMLElement[] = [];
  private readonly writerTargets: HTMLElement[] = [];
  private readonly writers: HanziWriter[] = [];
  private readonly characterPhases: CharacterPhase[] = [];
  private readonly acceptedStrokes: number[] = [];
  private readonly totalMistakes: number[] = [];
  private readonly hintsUsed: number[] = [];
  private readonly extraPointers: ({ id: number; x: number; y: number } | null)[] = [];
  private readonly resizeObserver: ResizeObserver;
  private readonly status: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly finishButton: HTMLButtonElement;
  private readonly demoButton: HTMLButtonElement;
  private readonly restartButton: HTMLButtonElement;
  private demonstrating = false;
  private finished = false;

  private readonly characters: readonly WritingCharacter[];

  constructor(private readonly host: HTMLElement, characters: WritingCharacter | readonly WritingCharacter[]) {
    this.characters = Array.isArray(characters) ? characters : [characters as WritingCharacter];
    if (this.characters.length < 1 || this.characters.length > 2) {
      throw new Error('The writing challenge supports one or two characters.');
    }

    this.root = document.createElement('section');
    this.root.className = 'writing-challenge';
    this.root.innerHTML = `
      <div class="challenge-heading">
        <div>
          <p class="eyebrow">Character Quest · Writing practice</p>
          <h1>Write ${this.characters.length === 2 ? 'the word ' : 'the character '}${this.characters.map((item) => item.glyph).join('')}</h1>
          <p class="intro">Draw each character in its own grid. Follow the correct stroke order and position.</p>
        </div>
      </div>
      <div class="practice-layout">
        <div class="practice-column">
          <div class="character-grids"></div>
          <div class="controls">
            <button class="button button--secondary demo-button" type="button">Show stroke order</button>
            <button class="button button--plain restart-button" type="button">Try again</button>
          </div>
        </div>
        <aside class="feedback-panel" aria-label="Writing feedback">
          <p class="panel-label">Your progress</p>
          <div class="progress-dots" aria-hidden="true"></div>
          <p class="progress-text"></p>
          <div class="status-card" role="status" aria-live="polite"></div>
          <button class="button button--primary finish-button" type="button" disabled>Finish ${this.characters.length === 2 ? 'word' : 'character'}</button>
          <p class="panel-note">Every stroke must match the expected order, shape, and position. Extra strokes are rejected.</p>
        </aside>
      </div>`;
    this.host.append(this.root);

    this.status = this.require<HTMLElement>('.status-card');
    this.progress = this.require<HTMLElement>('.progress-dots');
    this.finishButton = this.require<HTMLButtonElement>('.finish-button');
    this.demoButton = this.require<HTMLButtonElement>('.demo-button');
    this.restartButton = this.require<HTMLButtonElement>('.restart-button');

    const gridHost = this.require<HTMLElement>('.character-grids');
    this.characters.forEach((character, index) => {
      const tile = document.createElement('section');
      tile.className = 'character-tile';
      tile.innerHTML = `
        <div class="character-tile__heading">
          <span class="character-tile__glyph"></span>
          <span class="character-tile__details"><strong class="character-tile__pinyin"></strong><span class="character-tile__meaning"></span></span>
          <button class="button button--secondary hint-button" type="button">Hint</button>
        </div>
        <div class="grid-frame">
          <div class="writing-surface" aria-label="Writing grid for ${character.glyph}">
            <svg class="grid-guides" viewBox="0 0 100 100" aria-hidden="true">
              <path d="M50 0V100 M0 50H100 M0 0L100 100 M100 0L0 100" />
            </svg>
            <div class="writer-target"></div>
          </div>
        </div>
        <p class="character-tile__progress"></p>`;
      const glyph = tile.querySelector<HTMLElement>('.character-tile__glyph')!;
      const pinyin = tile.querySelector<HTMLElement>('.character-tile__pinyin')!;
      const meaning = tile.querySelector<HTMLElement>('.character-tile__meaning')!;
      const surface = tile.querySelector<HTMLElement>('.writing-surface')!;
      const target = tile.querySelector<HTMLElement>('.writer-target')!;
      glyph.textContent = character.glyph;
      pinyin.textContent = character.pinyin;
      meaning.textContent = character.meaning;
      gridHost.append(tile);

      this.surfaces.push(surface);
      this.writerTargets.push(target);
      this.characterPhases.push('writing');
      this.acceptedStrokes.push(0);
      this.totalMistakes.push(0);
      this.hintsUsed.push(0);
      this.extraPointers.push(null);
      this.writers.push(this.createWriter(index));

      tile.querySelector<HTMLButtonElement>('.hint-button')!.addEventListener('click', () => void this.hint(index));
      surface.addEventListener('pointerdown', (event) => this.onPointerDown(index, event), true);
      surface.addEventListener('pointermove', (event) => this.onPointerMove(index, event), true);
      surface.addEventListener('pointerup', () => { this.extraPointers[index] = null; }, true);
      surface.addEventListener('pointercancel', () => { this.extraPointers[index] = null; }, true);
    });

    this.resizeObserver = new ResizeObserver(() => this.updateWriterDimensions());
    this.surfaces.forEach((surface) => this.resizeObserver.observe(surface));
    this.demoButton.addEventListener('click', () => void this.demonstrate());
    this.restartButton.addEventListener('click', () => void this.restart());
    this.finishButton.addEventListener('click', () => this.finish());

    this.renderProgress();
    this.characters.forEach((_, index) => void this.startQuiz(index));
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.writers.forEach((writer) => writer.cancelQuiz());
    this.root.remove();
  }

  private require<T extends Element>(selector: string): T {
    const found = this.root.querySelector<T>(selector);
    if (!found) throw new Error(`Writing challenge element missing: ${selector}`);
    return found;
  }

  private createWriter(index: number): HanziWriter {
    const character = this.characters[index];
    const size = this.surfaces[index].clientWidth;
    return HanziWriter.create(this.writerTargets[index], character.glyph, {
      width: size,
      height: size,
      padding: Math.max(20, Math.round(size * 0.075)),
      showCharacter: false,
      showOutline: false,
      strokeColor: '#174b4c',
      drawingColor: '#174b4c',
      highlightColor: '#e8a14a',
      highlightCompleteColor: '#42a78b',
      drawingWidth: 5,
      leniency: 0.9,
      acceptBackwardsStrokes: false,
      markStrokeCorrectAfterMisses: false,
      showHintAfterMisses: 2,
      charDataLoader: () => character.data,
    });
  }

  private updateWriterDimensions(): void {
    this.writers.forEach((writer, index) => {
      const size = this.surfaces[index].clientWidth;
      writer.updateDimensions({ width: size, height: size, padding: Math.max(20, Math.round(size * 0.075)) });
    });
  }

  private setStatus(message: string, kind: 'neutral' | 'success' | 'error' = 'neutral'): void {
    this.status.textContent = message;
    this.status.dataset.kind = kind;
  }

  private renderProgress(): void {
    this.progress.replaceChildren();
    let matched = 0;
    let total = 0;
    this.characters.forEach((character, characterIndex) => {
      character.data.strokes.forEach((_, strokeIndex) => {
        const dot = document.createElement('span');
        const done = strokeIndex < this.acceptedStrokes[characterIndex];
        dot.className = done ? 'progress-dot progress-dot--done' : 'progress-dot';
        this.progress.append(dot);
        if (done) matched += 1;
        total += 1;
      });
      const tile = this.root.querySelectorAll<HTMLElement>('.character-tile')[characterIndex];
      tile.querySelector<HTMLElement>('.character-tile__progress')!.textContent =
        `${this.acceptedStrokes[characterIndex]} of ${character.data.strokes.length} strokes`;
      tile.querySelector<HTMLButtonElement>('.hint-button')!.disabled =
        this.demonstrating || this.finished || this.characterPhases[characterIndex] !== 'writing';
      this.surfaces[characterIndex].dataset.phase = this.demonstrating ? 'demonstrating' : this.finished ? 'finished' : this.characterPhases[characterIndex];
    });
    this.require<HTMLElement>('.progress-text').textContent = `${matched} of ${total} strokes matched`;
    this.finishButton.disabled = this.demonstrating || this.finished || this.characterPhases.some((phase) => phase !== 'ready');
    this.demoButton.disabled = this.demonstrating || this.finished;
    this.restartButton.disabled = this.demonstrating;
  }

  private async startQuiz(index: number): Promise<void> {
    const character = this.characters[index];
    await this.writers[index].quiz({
      onCorrectStroke: (stroke: StrokeData) => {
        if (this.demonstrating || this.finished || this.characterPhases[index] !== 'writing') return;
        this.acceptedStrokes[index] = stroke.strokeNum + 1;
        this.renderProgress();
        this.setStatus(`Good! ${character.glyph}: stroke ${this.acceptedStrokes[index]} matched.`, 'success');
        this.emit('hanzi:progress', { characterIndex: index, character: character.glyph, acceptedStrokes: this.acceptedStrokes[index] });
      },
      onMistake: (stroke: StrokeData) => {
        if (this.demonstrating || this.finished || this.characterPhases[index] !== 'writing') return;
        this.totalMistakes[index] = stroke.totalMistakes;
        if (stroke.mistakesOnStroke === 2) this.hintsUsed[index] += 1;
        const reason = stroke.isBackwards
          ? `The direction for ${character.glyph} is reversed. Try again.`
          : `Try ${character.glyph}, stroke ${stroke.strokeNum + 1} again. Check its order, shape, and position.`;
        this.setStatus(reason, 'error');
        this.emit('hanzi:mistake', { characterIndex: index, character: character.glyph, stroke: stroke.strokeNum + 1, totalMistakes: this.totalMistakes[index] });
      },
      onComplete: () => {
        if (this.demonstrating || this.finished || this.characterPhases[index] !== 'writing') return;
        this.characterPhases[index] = 'ready';
        this.acceptedStrokes[index] = character.data.strokes.length;
        this.renderProgress();
        this.setStatus(`${character.glyph} is complete. ${this.characterPhases.every((phase) => phase === 'ready') ? 'Finish when you are ready.' : 'Now complete the other character.'}`, 'success');
      },
    });
  }

  private async restart(): Promise<void> {
    if (this.demonstrating) return;
    this.writers.forEach((writer) => writer.cancelQuiz());
    this.finished = false;
    this.characters.forEach((_, index) => {
      this.characterPhases[index] = 'writing';
      this.acceptedStrokes[index] = 0;
      this.totalMistakes[index] = 0;
      this.hintsUsed[index] = 0;
      this.extraPointers[index] = null;
      this.writerTargets[index].replaceChildren();
      this.writers[index] = this.createWriter(index);
    });
    this.renderProgress();
    this.setStatus('Try both characters again. Start with either grid.');
    this.characters.forEach((_, index) => void this.startQuiz(index));
    this.emit('hanzi:reset', { word: this.word });
  }

  private async demonstrate(): Promise<void> {
    if (this.demonstrating || this.finished) return;
    this.demonstrating = true;
    this.writers.forEach((writer) => writer.cancelQuiz());
    this.renderProgress();
    this.setStatus('Watch the stroke order for each character, then try both grids.');
    await Promise.all(this.writers.map((writer) => writer.animateCharacter()));
    await Promise.all(this.writers.map((writer) => writer.hideCharacter({ duration: 0 })));
    this.demonstrating = false;
    this.finished = false;
    this.characters.forEach((_, index) => {
      this.characterPhases[index] = 'writing';
      this.acceptedStrokes[index] = 0;
      this.totalMistakes[index] = 0;
      this.hintsUsed[index] = 0;
    });
    this.characters.forEach((_, index) => void this.startQuiz(index));
    this.renderProgress();
    this.emit('hanzi:reset', { word: this.word });
  }

  private async hint(index: number): Promise<void> {
    if (this.demonstrating || this.finished || this.characterPhases[index] !== 'writing') return;
    const character = this.characters[index];
    this.hintsUsed[index] += 1;
    this.setStatus(`Watch ${character.glyph}, stroke ${this.acceptedStrokes[index] + 1}, then try it yourself.`);
    await this.writers[index].highlightStroke(this.acceptedStrokes[index]);
  }

  private finish(): void {
    if (this.demonstrating || this.finished || this.characterPhases.some((phase) => phase !== 'ready')) return;
    this.finished = true;
    this.renderProgress();
    this.setStatus(`You wrote ${this.word} with every stroke in order. Well done!`, 'success');
    const result: WritingResult[] = this.characters.map((character, index) => ({
      character: character.glyph,
      totalMistakes: this.totalMistakes[index],
      hintsUsed: this.hintsUsed[index],
    }));
    this.emit('hanzi:complete', this.characters.length === 1 ? result[0] : { word: this.word, characters: result } satisfies WritingSequenceResult);
  }

  private onPointerDown(index: number, event: PointerEvent): void {
    if (this.demonstrating || this.finished || this.characterPhases[index] !== 'ready') return;
    this.extraPointers[index] = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.surfaces[index].setPointerCapture(event.pointerId);
  }

  private onPointerMove(index: number, event: PointerEvent): void {
    const pointer = this.extraPointers[index];
    if (this.demonstrating || this.finished || this.characterPhases[index] !== 'ready' || pointer?.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) < 14) return;
    this.extraPointers[index] = null;
    this.characterPhases[index] = 'extra';
    this.renderProgress();
    const character = this.characters[index];
    this.setStatus(`${character.glyph} has an extra stroke. Tap “Try again” to restart the word.`, 'error');
    this.emit('hanzi:extra-stroke', { character: character.glyph, characterIndex: index });
  }

  private get word(): string { return this.characters.map((item) => item.glyph).join(''); }

  private emit(name: string, detail: object): void {
    this.host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }
}
