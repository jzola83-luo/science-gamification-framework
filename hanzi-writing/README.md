# Chinese character writing challenge

A reusable iPad-friendly writing module, initially configured for **马 (mǎ, horse)**. It checks each finger-drawn stroke against the next expected stroke. A stroke that does not match the expected order, direction, shape, or approximate position is rejected. The completion button stays locked until all expected strokes match; an additional drawn stroke before finishing invalidates the attempt.

## Run

```sh
pnpm install --ignore-workspace
pnpm dev
pnpm build
```

Open the local URL on a desktop browser, or the network URL on an iPad on the same Wi-Fi. A touch-friendly grid, hints, an order demonstration, retry, and progress feedback are included. Character stroke data is bundled locally; the activity does not need an AI API or a character-data CDN during play.

## Reuse

Import `HanziWritingChallenge` from `src/HanziWritingChallenge.ts` and mount it in an HTML element. Pass a glyph, pinyin, meaning, and [Hanzi Writer character data](https://hanziwriter.org/docs.html#loading-character-data). The host receives `hanzi:progress`, `hanzi:mistake`, `hanzi:extra-stroke`, `hanzi:reset`, and `hanzi:complete` events. The module's `destroy()` method removes its UI and observers.

This first version checks against a fixed stroke template. It is designed for learning stroke order and approximate placement, not for assigning a handwriting neatness grade or recognizing an arbitrary handwritten character. Its acceptance threshold is a starting point; it should be calibrated with primary school students writing on actual iPads. A host game can follow `hanzi:complete` with a short reflection or a new quest.

The module uses [Hanzi Writer](https://github.com/chanind/hanzi-writer) ([MIT license](public/licenses/HANZI_WRITER_MIT.txt)). The bundled `马` data comes from [Hanzi Writer Data](https://github.com/chanind/hanzi-writer-data), derived from Make Me a Hanzi / Arphic font data; its [Arphic Public License](public/licenses/ARPHICPL.TXT) and [credits](public/licenses/CREDITS.md) are included in the site build.
