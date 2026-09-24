import type { CharacterJson } from 'hanzi-writer';
import maData from './data/ma.json';
import xiaoData from './data/xiao.json';
import { HanziWritingChallenge } from './HanziWritingChallenge';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('App mount not found');

app.innerHTML = `
  <div class="app-shell">
    <header class="site-header">
      <div class="brand"><span class="brand-mark" aria-hidden="true">字</span><span>Character Quest</span></div>
      <span class="header-pill" id="quest-status">Practice · 2 characters</span>
    </header>
    <main>
      <section class="quest-intro">
        <div class="quest-intro__copy">
          <p class="eyebrow eyebrow--light">The meadow quest</p>
          <h2>Help the little horse find its name.</h2>
          <p>Write 小马 (“little horse”) one character at a time. Each correct stroke brings you closer to completing the quest.</p>
        </div>
        <div class="quest-intro__art" aria-hidden="true"><span>🐎</span></div>
      </section>
      <div id="writing-module"></div>
    </main>
    <footer class="site-footer">Practice carefully. Every mistake is a chance to learn.</footer>
  </div>`;

const moduleHost = document.querySelector<HTMLElement>('#writing-module');
const statusPill = document.querySelector<HTMLElement>('#quest-status');
if (!moduleHost || !statusPill) throw new Error('Writing module host not found');

new HanziWritingChallenge(moduleHost, [
  { glyph: '小', pinyin: 'xiǎo', meaning: 'little', data: xiaoData as CharacterJson },
  { glyph: '马', pinyin: 'mǎ', meaning: 'horse', data: maData as CharacterJson },
]);

moduleHost.addEventListener('hanzi:complete', () => {
  statusPill.textContent = 'Quest complete';
  statusPill.classList.add('header-pill--complete');
});
moduleHost.addEventListener('hanzi:progress', () => {
  statusPill.textContent = 'Practice · 2 characters';
  statusPill.classList.remove('header-pill--complete');
});
moduleHost.addEventListener('hanzi:reset', () => {
  statusPill.textContent = 'Practice · 2 characters';
  statusPill.classList.remove('header-pill--complete');
});
