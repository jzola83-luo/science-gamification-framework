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

type Phase = 'writing' | 'demonstrating' | 'ready' | 'extra' | 'finished';

/** A mountable, offline stroke practice activity for one Chinese character. */
export class HanziWritingChallenge {
  private readonly root: HTMLElement;
  private readonly surface: HTMLElement;
  private readonly writerTarget: HTMLElement;
  private readonly status: HTMLElement;
  private readonly progress: HTMLElement;
  private readonly finishButton: HTMLButtonElement;
  private readonly demoButton: HTMLButtonElement;
  private readonly hintButton: HTMLButtonElement;
  private readonly restartButton: HTMLButtonElement;
  private readonly writer: HanziWriter;
  private readonly resizeObserver: ResizeObserver;
  private phase: Phase = 'writing';
  private acceptedStrokes = 0;
  private totalMistakes = 0;
  private hintsUsed = 0;
  private extraPointer: { id: number; x: number; y: number } | null = null;

  constructor(private readonly host: HTMLElement, private readonly character: WritingCharacter) {
    this.root = document.createElement('section');
    this.root.className = 'writing-challenge';
    this.root.innerHTML = `
      <div class="challenge-heading">
        <div>
          <p class="eyebrow">Character Quest · Writing practice</p>
          <h1>Write the character</h1>
          <p class="intro">Draw each stroke with your finger. Follow the correct order and position.</p>
        </div>
        <div class="character-card" aria-label="Character to write">
          <span class="character-card__glyph"></span>
          <span class="character-card__details"><strong class="character-card__pinyin"></strong><span class="character-card__meaning"></span></span>
        </div>
      </div>
      <div class="practice-layout">
        <div class="practice-column">
          <div class="grid-frame">
            <div class="writing-surface" aria-label="Character writing grid">
              <svg class="grid-guides" viewBox="0 0 100 100" aria-hidden="true">
                <path d="M50 0V100 M0 50H100 M0 0L100 100 M100 0L0 100" />
              </svg>
              <div class="writer-target"></div>
            </div>
          </div>
          <div class="controls">
            <button class="button button--secondary demo-button" type="button">Show stroke order</button>
            <button class="button button--secondary hint-button" type="button">Hint</button>
            <button class="button button--plain restart-button" type="button">Try again</button>
          </div>
        </div>
        <aside class="feedback-panel" aria-label="Writing feedback">
          <p class="panel-label">Your progress</p>
          <div class="progress-dots" aria-hidden="true"></div>
          <p class="progress-text"></p>
          <div class="status-card" role="status" aria-live="polite"></div>
          <button class="button button--primary finish-button" type="button" disabled>Finish character</button>
          <p class="panel-note">Each stroke must match the next expected stroke. Extra strokes are rejected.</p>
        </aside>
      </div>`;
    this.host.append(this.root);

    this.surface = this.require<HTMLElement>('.writing-surface');
    this.writerTarget = this.require<HTMLElement>('.writer-target');
    this.status = this.require<HTMLElement>('.status-card');
    this.progress = this.require<HTMLElement>('.progress-dots');
    this.finishButton = this.require<HTMLButtonElement>('.finish-button');
    this.demoButton = this.require<HTMLButtonElement>('.demo-button');
    this.hintButton = this.require<HTMLButtonElement>('.hint-button');
    this.restartButton = this.require<HTMLButtonElement>('.restart-button');

    this.require<HTMLElement>('.character-card__glyph').textContent = character.glyph;
    this.require<HTMLElement>('.character-card__pinyin').textContent = character.pinyin;
    this.require<HTMLElement>('.character-card__meaning').textContent = character.meaning;

    const size = this.surface.clientWidth;
    this.writer = HanziWriter.create(this.writerTarget, character.glyph, {
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

    this.resizeObserver = new ResizeObserver(() => {
      const nextSize = this.surface.clientWidth;
      this.writer.updateDimensions({
        width: nextSize,
        height: nextSize,
        padding: Math.max(20, Math.round(nextSize * 0.075)),
      });
    });
    this.resizeObserver.observe(this.surface);

    this.demoButton.addEventListener('click', () => void this.demonstrate());
    this.hintButton.addEventListener('click', () => void this.hint());
    this.restartButton.addEventListener('click', () => void this.restart());
    this.finishButton.addEventListener('click', () => this.finish());
    this.surface.addEventListener('pointerdown', this.onPointerDown, true);
    this.surface.addEventListener('pointermove', this.onPointerMove, true);
    this.surface.addEventListener('pointerup', this.onPointerEnd, true);
    this.surface.addEventListener('pointercancel', this.onPointerCancel, true);

    this.renderProgress();
    void this.startQuiz();
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.writer.cancelQuiz();
    this.root.remove();
  }

  private require<T extends Element>(selector: string): T {
    const found = this.root.querySelector<T>(selector);
    if (!found) throw new Error(`Writing challenge element missing: ${selector}`);
    return found;
  }

  private setStatus(message: string, kind: 'neutral' | 'success' | 'error' = 'neutral'): void {
    this.status.textContent = message;
    this.status.dataset.kind = kind;
  }

  private renderProgress(): void {
    this.progress.replaceChildren();
    for (let index = 0; index < this.character.data.strokes.length; index += 1) {
      const dot = document.createElement('span');
      dot.className = index < this.acceptedStrokes ? 'progress-dot progress-dot--done' : 'progress-dot';
      this.progress.append(dot);
    }
    this.require<HTMLElement>('.progress-text').textContent =
      `${this.acceptedStrokes} of ${this.character.data.strokes.length} strokes matched`;
    this.finishButton.disabled = this.phase !== 'ready';
    this.demoButton.disabled = this.phase === 'demonstrating';
    this.hintButton.disabled = this.phase !== 'writing';
    this.restartButton.disabled = this.phase === 'demonstrating';
    this.surface.dataset.phase = this.phase;
  }

  private async startQuiz(): Promise<void> {
    this.phase = 'writing';
    this.acceptedStrokes = 0;
    this.totalMistakes = 0;
    this.hintsUsed = 0;
    this.extraPointer = null;
    this.renderProgress();
    this.setStatus(`Start with stroke 1. There are ${this.character.data.strokes.length} strokes.`);
    await this.writer.quiz({
      onCorrectStroke: (stroke: StrokeData) => {
        if (this.phase !== 'writing') return;
        this.acceptedStrokes = stroke.strokeNum + 1;
        this.renderProgress();
        this.setStatus(`Good! Stroke ${this.acceptedStrokes} matched.`, 'success');
        this.emit('hanzi:progress', { acceptedStrokes: this.acceptedStrokes });
      },
      onMistake: (stroke: StrokeData) => {
        if (this.phase !== 'writing') return;
        this.totalMistakes = stroke.totalMistakes;
        if (stroke.mistakesOnStroke === 2) this.hintsUsed += 1;
        const reason = stroke.isBackwards
          ? 'The direction is reversed. Try this stroke again.'
          : `Try stroke ${stroke.strokeNum + 1} again. Check its order, shape, and position.`;
        this.setStatus(reason, 'error');
        this.emit('hanzi:mistake', { stroke: stroke.strokeNum + 1, totalMistakes: this.totalMistakes });
      },
      onComplete: () => {
        if (this.phase !== 'writing') return;
        this.phase = 'ready';
        this.acceptedStrokes = this.character.data.strokes.length;
        this.renderProgress();
        this.setStatus('All strokes matched. Tap “Finish character” to complete.', 'success');
      },
    });
  }

  private async restart(): Promise<void> {
    if (this.phase === 'demonstrating') return;
    this.writer.cancelQuiz();
    await this.writer.hideCharacter({ duration: 0 });
    await this.startQuiz();
    this.emit('hanzi:reset', { character: this.character.glyph });
  }

  private async demonstrate(): Promise<void> {
    if (this.phase === 'demonstrating') return;
    this.phase = 'demonstrating';
    this.renderProgress();
    this.setStatus('Watch the order of the strokes, then try writing.');
    this.writer.cancelQuiz();
    await this.writer.animateCharacter();
    await this.writer.hideCharacter({ duration: 0 });
    await this.startQuiz();
    this.emit('hanzi:reset', { character: this.character.glyph });
  }

  private async hint(): Promise<void> {
    if (this.phase !== 'writing') return;
    this.hintsUsed += 1;
    this.setStatus(`Watch stroke ${this.acceptedStrokes + 1}, then try it yourself.`);
    await this.writer.highlightStroke(this.acceptedStrokes);
  }

  private finish(): void {
    if (this.phase !== 'ready') return;
    this.phase = 'finished';
    this.renderProgress();
    this.setStatus(`You wrote ${this.character.glyph} with every stroke in order. Well done!`, 'success');
    const result: WritingResult = {
      character: this.character.glyph,
      totalMistakes: this.totalMistakes,
      hintsUsed: this.hintsUsed,
    };
    this.emit('hanzi:complete', result);
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.phase !== 'ready') return;
    this.extraPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.surface.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.phase !== 'ready' || this.extraPointer?.id !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - this.extraPointer.x, event.clientY - this.extraPointer.y);
    if (distance < 14) return;
    this.extraPointer = null;
    this.phase = 'extra';
    this.renderProgress();
    this.setStatus('That is an extra stroke. This character needs no more strokes. Tap “Try again”.', 'error');
    this.emit('hanzi:extra-stroke', { character: this.character.glyph });
  };

  private onPointerEnd = (): void => { this.extraPointer = null; };
  private onPointerCancel = (): void => { this.extraPointer = null; };

  private emit(name: string, detail: object): void {
    this.host.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
  }
}
