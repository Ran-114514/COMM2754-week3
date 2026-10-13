# Drumbeat — a sound-reactive p5.js sketch

A single-page creative coding project built for **COMM2754 Creative Coding**.

It starts from the workshop example (one grey circle that grows with the volume of a
drum loop) and pushes it into three reactive visual modes, beat detection, a particle
system and motion trails.

> **Live page:** replace this line with your GitHub Pages URL, e.g.
> `https://<your-username>.github.io/drumbeat/`

## What's in here

| File | Purpose |
|---|---|
| `index.html` | The HTML5 page. Loads p5.js 1.11.0 + p5.sound from the CDN, then `sketch.js`. |
| `sketch.js` | All the creative logic: analysers, drawing, particles, beat detection. |
| `style.css` | Page chrome (dark stage, HUD, typography). The canvas itself is drawn by p5. |
| `beat.mp3` | The drum loop. Downloaded from the workshop repo so the demo is self-contained. |
| `screenshots/` | Still frames of each visual mode, for the journal entry. |

## Running it locally

Because `loadSound()` fetches `beat.mp3`, the page has to be served over HTTP —
opening `index.html` straight from the filesystem will be blocked by CORS in most
browsers.

```bash
# from inside this folder
python3 -m http.server 8000
# then open http://localhost:8000
```

Or in VS Code / Brackets, use Live Preview / Live Server.

## Controls

| Input | Effect |
|---|---|
| Click the canvas | start / pause the loop (browsers block autoplay) |
| `N` | cycle visual mode: `ring` → `grid` → `burst` |
| `Space` | same as clicking the canvas |

## How it works

**Analysis.** Two analysers listen to the same sound at once:

- `p5.Amplitude` gives one number, the root-mean-square loudness. This is the
  workshop's original technique, and it still drives the size of the centre circle.
- `p5.FFT` gives the whole frequency spectrum. Averaging a low slice of that
  spectrum (bins 2–9) gives an energy value that spikes on the kick drum, which is
  how the sketch knows *when* the beat hits rather than just *how loud* it is.

**Beat detection.** A kick is found with *spectral flux*: sum the positive
frame-to-frame changes across the low band (bins 1–7, roughly 43–300 Hz). A drum hit
makes the low end jump sharply for a frame or two, so flux spikes; sustained bass does
not, because only increases count. A hit fires when flux clears both a fixed floor (45)
and 2.5× a rolling flux baseline, with a 10-frame cooldown so one hit is not counted
several times.

> An earlier version compared the band's *level* against a rolling baseline. It did not
> work: this loop is kick-and-bass heavy, so the band sits between 0.65 and 0.98 the
> whole way through and never produces usable contrast. Measuring the change instead of
> the level is what made it work — a good example of why you look at the actual data
> rather than guessing at thresholds.

Each detected kick fires a particle burst and an expanding shockwave ring. BPM is the
median gap between recent hits, which reads a steady **~100** for this 2.4-second,
4-beat loop.

**Drawing.** Trails come from fading the previous frame with a translucent `rect()`
instead of clearing it, and everything glowing is drawn with `blendMode(ADD)`. The
workshop's `erase() / noErase()` trick is kept for the centre core, so it stays a
solid disc inside the trails instead of being painted over.

## Pinned library versions

This project deliberately uses **p5.js 1.11.0**, not 2.x. p5.sound was rewritten for
p5.js 2 and the 1.x analyser API (`new p5.Amplitude()`, `analyzer.setInput()`,
`fft.analyze()`) breaks against the new add-on. The CDN links are pinned in
`index.html` rather than using a floating version.

## Credits

- Workshop handout & original sketch: Chris Birchall, COMM2754 Creative Coding
  (<https://birchallchris.github.io/drumbeat/>)
- [p5.js](https://p5js.org/) and its [examples](https://p5js.org/examples/)
