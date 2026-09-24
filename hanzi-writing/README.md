# Chinese character writing challenge

A reusable iPad-friendly writing module, configured for **小马 (xiǎo mǎ, little horse)**. Learners write each character in its own side-by-side grid, and the activity supports one or two characters. Each grid checks finger-drawn strokes against that character's expected stroke order, direction, shape, and approximate position. The word can be finished after both grids are complete; an additional stroke in a completed grid invalidates the attempt.

## Run

```sh
pnpm install --ignore-workspace
pnpm dev
pnpm build
```

Open the local URL on a desktop browser, or the network URL on an iPad on the same Wi-Fi. A touch-friendly grid, hints, an order demonstration, retry, and progress feedback are included. Character stroke data is bundled locally; the activity does not need an AI API or a character-data CDN during play.

## Reuse

Import `HanziWritingChallenge` from `src/HanziWritingChallenge.ts` and mount it in an HTML element. Pass either one character definition or an array of one or two definitions, each with a glyph, pinyin, meaning, and [Hanzi Writer character data](https://hanziwriter.org/docs.html#loading-character-data). For two characters, both writing grids appear side by side and can be completed in either order. The final `hanzi:complete` event contains the word and per-character results. The host also receives `hanzi:progress`, `hanzi:mistake`, `hanzi:extra-stroke`, and `hanzi:reset` events. The module's `destroy()` method removes its UI and observers.

This first version checks against a fixed stroke template. It is designed for learning stroke order and approximate placement, not for assigning a handwriting neatness grade or recognizing an arbitrary handwritten character. Its acceptance threshold is a starting point; it should be calibrated with primary school students writing on actual iPads. A host game can follow `hanzi:complete` with a short reflection or a new quest.

The module uses [Hanzi Writer](https://github.com/chanind/hanzi-writer) ([MIT license](public/licenses/HANZI_WRITER_MIT.txt)). The bundled `小` and `马` data comes from [Hanzi Writer Data](https://github.com/chanind/hanzi-writer-data), derived from Make Me a Hanzi / Arphic font data; its [Arphic Public License](public/licenses/ARPHICPL.TXT) and [credits](public/licenses/CREDITS.md) are included in the site build.
