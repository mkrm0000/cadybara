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