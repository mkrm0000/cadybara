<div align="center">

<img src="icon-transparent.png" alt="cadybara" width="120" />

# cadybara

₍ᐢ-(ｪ)-ᐢ₎

**A tiny CAD type pseudo language on the web**

Write code. See shapes. Pan, zoom, export.

No build step. No framework. Just HTML, CSS, and vanilla JS.

[**🚀 Live version**](https://mkrm0000.github.io/cadybara) · [devlog](DEVLOG.md) · [contributing](CONTRIBUTING.md) · [license](LICENSE)

</div>

---

## ✨ What is it?

cadybara is a **live pseudo-CAD** — a text editor on the left, a canvas on the right. Every keystroke re-renders the drawing. You write a tiny pseudo-language, and geometry appears instantly.

Think of it as *a REPL for 2D drawings* — closer to Logo/Turtle than to AutoCAD.

```
color blue
rect 100 100 200 200

color red
circle 200 200 60

let a = 45
line 200 200 (200 + 100 * cos(a)) (200 + 100 * sin(a))
```

---

## 🚀 Quick start

Open the [**live version**](https://mkrm0000.github.io/cadybara) — that's the fastest way.

To run locally, serve the folder over HTTP (needed so `syn.json` loads):

```bash
python3 -m http.server
```

Then visit `http://localhost:8000`.

> Opening `index.html` directly via `file://` works, but the help modal and intellisense fall back to a hardcoded command list instead of reading `syn.json`.

---

## 🧠 The language

**Primitives**

```
line x1 y1 x2 y2
circle cx cy r
fillcircle cx cy r
rect x y w h
arc cx cy r startDeg endDeg
polyline x1 y1 x2 y2 ...
text x y "content" [size]
```

**State**

```
color blue              // PICO-8 named colors
layer walls color blue  // new layer with optional default color
hide walls              // toggle layer visibility
show walls
grid on
clear
```

**Variables & expressions**

```
let w = 200
let a = 45
rect 0 0 w (w * 0.5)
line 200 200 (200 + 100 * cos(a)) (200 + 100 * sin(a))
```

- Operators: `+ - * / % ^`
- Constants: `pi`, `tau`, `e`
- Functions: `sin cos tan sqrt abs min max floor ceil round pow`
- **Angles are in degrees** (CAD-friendly)

**Groups**

```
group house
  rect 100 100 200 200
  polyline 100 100 200 40 300 100
endgroup
```

---

## 🎨 Colors

Uses the **PICO-8 palette** with named colors:

`black` · `darkblue` · `darkpurple` · `darkgreen` · `brown` · `darkgray` · `lightgray` · `white` · `red` · `orange` · `yellow` · `green` · `blue` · `lavender` · `pink` · `peach`

Quoted hex also works: `color "#ff004d"`

---

## 🖱️ Controls

| Action | Effect |
|---|---|
| Type in editor | Live re-render (120ms debounce) |
| **Drag** on canvas | Pan |
| **Scroll wheel** | Zoom at cursor |
| **⊡ fit** button | Fit all shapes to view |
| **Ctrl+0** | Reset view |
| **Ctrl+Enter** | Force render (works when frozen) |
| **↑ / ↓** in intellisense | Navigate suggestions |
| **Tab** | Insert 2 spaces |

---

## 🧰 Features

- 🎨 **Live rendering** — every keystroke updates the canvas
- 🧮 **Variables & expressions** — parametric drawings
- 🗂️ **Layers & groups** — organize complex drawings
- 🔍 **Pan & zoom** — drag, scroll, fit
- 💾 **Auto-save** — code + view persisted to `localStorage`
- 📤 **Export** — one-click SVG and PNG
- 💡 **Intellisense** — command suggestions as you type
- 📖 **Help modal** — full syntax reference, generated from `syn.json`
- 🧭 **X/Y axes + origin marker** — always know where `(0, 0)` is


<details>
<summary><strong>📜 Full-feature showcase</strong> (click to expand — every command, color, layer, group)</summary>

```cady
// ─────────────────────────────────────────────────────────────
// cadybara · full-feature showcase
// every command, every palette color, variables, layers, groups
// ─────────────────────────────────────────────────────────────

// ── variables & expressions ──────────────────────────────────
let cx = 400              // center x
let cy = 400              // center y
let r  = 250              // base radius
let a  = 45               // angle in degrees
let tau2 = tau / 2        // half turn

// ── grid ─────────────────────────────────────────────────────
grid on

// ═════════════════════════════════════════════════════════════
// LAYER 1 · background ring using all 16 palette colors
// ═════════════════════════════════════════════════════════════
layer palette

color black
arc cx cy r 180 360

color darkblue
arc cx cy r-20 180 360

color darkpurple
arc cx cy r-40 180 360

color darkgreen
arc cx cy r-60 180 360

color brown
arc cx cy r-80 180 360

color darkgray
arc cx cy r-100 180 360

color lightgray
arc cx cy r-120 180 360

color white
arc cx cy r-140 180 360

color red
arc cx cy r-160 180 360

color orange
arc cx cy r-180 180 360

color yellow
arc cx cy r-200 180 360

color green
arc cx cy r-220 180 360

color blue
arc cx cy r-240 180 360

color lavender
arc cx cy r-260 180 360

color pink
arc cx cy r-280 180 360

color peach
arc cx cy r-300 180 360

// ═════════════════════════════════════════════════════════════
// LAYER 2 · geometric primitives inside a group
// ═════════════════════════════════════════════════════════════
layer shapes color blue

group frame
  color blue
  rect 200 200 400 400

  color red
  circle cx cy 150

  color green
  fillcircle cx cy 40

  color yellow
  line 200 200 600 600
  line 600 200 200 600

  color lavender
  polyline 200 400 300 300 400 400 500 300 600 400

  color pink
  text 290 180 "cadybara" 28

  color orange
  text 330 460 "full showcase" 14
endgroup

// ═════════════════════════════════════════════════════════════
// LAYER 3 · parametric spirograph using trig + expressions
// ═════════════════════════════════════════════════════════════
layer trig color peach

let i1 = 0
let i2 = 30
let i3 = 60
let i4 = 90
let i5 = 120
let i6 = 150
let i7 = 180
let i8 = 210
let i9 = 240
let i10 = 270
let i11 = 300
let i12 = 330

line cx cy cx + 200 * cos(i1)  cy + 200 * sin(i1)
line cx cy cx + 200 * cos(i2)  cy + 200 * sin(i2)
line cx cy cx + 200 * cos(i3)  cy + 200 * sin(i3)
line cx cy cx + 200 * cos(i4)  cy + 200 * sin(i4)
line cx cy cx + 200 * cos(i5)  cy + 200 * sin(i5)
line cx cy cx + 200 * cos(i6)  cy + 200 * sin(i6)
line cx cy cx + 200 * cos(i7)  cy + 200 * sin(i7)
line cx cy cx + 200 * cos(i8)  cy + 200 * sin(i8)
line cx cy cx + 200 * cos(i9)  cy + 200 * sin(i9)
line cx cy cx + 200 * cos(i10) cy + 200 * sin(i10)
line cx cy cx + 200 * cos(i11) cy + 200 * sin(i11)
line cx cy cx + 200 * cos(i12) cy + 200 * sin(i12)

// ═════════════════════════════════════════════════════════════
// LAYER 4 · math functions demo
// ═════════════════════════════════════════════════════════════
layer math color lightgray

let s1 = cy + 40 * sin(0)
let s2 = cy + 40 * sin(60)
let s3 = cy + 40 * sin(120)
let s4 = cy + 40 * sin(180)
let s5 = cy + 40 * sin(240)
let s6 = cy + 40 * sin(300)
let s7 = cy + 40 * sin(360)

polyline 220 s1 260 s2 300 s3 340 s4 380 s5 420 s6 460 s7

circle 200 + 50 * sqrt(4) 700 - 100 * abs(-1) 8
circle 300 + 50 * round(1.4) 700 - 100 * ceil(1.1) 8
circle 400 + 50 * floor(2.9) 700 - 100 * max(2, 5) 8
circle 500 + 50 * min(3, 7) 700 - 100 * pow(2, 2) 8



// ═════════════════════════════════════════════════════════════
// LAYER 5 · the one that gets hidden (toggle demo)
// ═════════════════════════════════════════════════════════════
layer ephemeral color white

text 180 80 "this layer can be hidden" 14
text 180 100 "change 'hide ephemeral' below" 12

// ── try changing this to `show ephemeral` ────────────────────
hide ephemeral

// ═════════════════════════════════════════════════════════════
// comments
// ─────────────────────────────────────────────────────────────
// this is a full-line comment
// and this one uses the '#' marker at the start of a line:
# this line is also a comment

// clear (commented out — uncomment to wipe everything except layers)
// clear
```

</details>


---

## 🏗️ Architecture

Nine files, each with one job:

| File | Role |
|------|------|
| `index.html` | DOM shell |
| `style.css` | Dark UI + layout |
| `parser.js` | Tokenizer + expression parser + statement parser |
| `cad.js` | Scene graph, renderer, pan/zoom, PICO-8 palette |
| `export.js` | SVG + PNG export |
| `storage.js` | localStorage save/load |
| `script.js` | UI glue — live render, intellisense, help, controls |
| `logoPopup.js` | About popup |
| `syn.json` | Command metadata (help + intellisense source) |

Data flow:

```
textarea → script.js (debounced) → engine.execute() → parser.parseProgram()
        → eval expressions → addShape() → redraw() → canvas
```

---

## 🤝 Contributing

Adding a new command touches **three files**:

1. **`parser.js`** — register the keyword in the primitive list and `isStatementStart()`
2. **`cad.js`** — add a `case` in `drawShape()` and `computeBounds()`
3. **`syn.json`** — add the command entry (picks up in help + intellisense automatically)

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full walkthrough with examples.

**Guiding principles:**

- Keep it small. The whole point is *zero setup*.
- No build step. No ES modules. No frameworks.
- One file, one job.
- Every command respects `currentColor` and `view` transform.

---

## 🐛 Known limitations

- No undo/redo (yet)
- No selection or direct shape manipulation — everything is code-driven
- Groups are recorded but not yet used for transforms
- `#` is a comment marker; hex colors must be quoted (`color "#ff0000"`)
- PNG export at 2× only

See [`DEVLOG.md`](DEVLOG.md) for the full roadmap and design decisions.

---

## 📜 License

MIT — see [`LICENSE`](LICENSE).

---

<div align="center">

Made with 🦫 by **mkrm0000** and **deepseek**

₍ᐢ-(ｪ)-ᐢ₎

[**live**](https://mkrm0000.github.io/cadybara) · [devlog](DEVLOG.md) · [contributing](CONTRIBUTING.md) · [license](LICENSE)

</div>