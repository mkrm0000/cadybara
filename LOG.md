# 🦫 cadybara — devlog

A running log of what cadybara is, how it's built, what works, what doesn't, and what's next. Kept short and factual so both **humans** and **AI collaborators** (hi DeepSeek) can pick up context quickly without re-reading the whole codebase.

---

## 📌 What is cadybara?

A tiny **live pseudo-CAD** that runs entirely in the browser. You write a small pseudo-language in a textarea, and a canvas updates in real time to show the geometry. No build step, no framework, no backend. Just HTML + CSS + vanilla JS.

Think: *"a REPL for 2D drawings"* — closer to Logo/Turtle than to AutoCAD.

**Goals**

- **Tiny** — total code under ~1500 lines.
- **Readable** — every file has one job; no abstraction leakage.
- **Extensible** — adding a command touches 2–3 files, never more.
- **Instant** — every keystroke re-renders (debounced 120ms).
- **Self-documenting** — help modal + intellisense are generated from a single `syn.json`.

**Non-goals**

- Not a real CAD. No constraints, no parametrics, no DXF, no 3D.
- Not trying to replace Figma, Excalidraw, or Tinkercad.
- Not a general-purpose language. Only enough expressions to make drawings parametric.

---

## 🏗️ Architecture

Seven files, each with a single responsibility:

| File | Role | Rough size |
|------|------|------------|
| `index.html` | DOM shell — editor pane, canvas pane, help modal | ~80 lines |
| `style.css` | Dark UI, flex layout, popup + modal styles | ~300 lines |
| `parser.js` | Tokenizer + Pratt expression parser + statement parser + evaluator | ~400 lines |
| `cad.js` | Scene graph, renderer, pan/zoom transform, PICO-8 palette | ~450 lines |
| `export.js` | SVG serialization + PNG rasterization | ~150 lines |
| `storage.js` | localStorage save/load | ~30 lines |
| `script.js` | UI glue — live render, intellisense, help, pan/zoom binding | ~450 lines |
| `logoPopup.js` | "About" popup with smooth open/close animation | ~80 lines |
| `syn.json` | Single source of truth for command metadata (help + intellisense) | ~20 entries |

**Load order** in `index.html` (matters — each file only assumes the ones above it exist):

```
parser.js → cad.js → export.js → storage.js → script.js → logoPopup.js
```

Every module exposes itself on `window`:

- `window.CadybaraParser` — `{ tokenize, parseProgram, evalExpr, FUNCS, CONSTS }`
- `window.CadybaraEngine` — the `CadybaraEngine` class
- `window.CadybaraExport` — `{ exportSVG, exportPNG, downloadSVG, downloadPNG }`
- `window.CadybaraStorage` — `{ save, load, clear }`
- `window.PICO8` — palette map
- `window.normalizeColor` — name → hex resolver

### Data flow

```
textarea value
    ↓
script.js (debounced 120ms, skipped if auto-render is off)
    ↓
engine.execute(code)
    ↓
parser.parseProgram(code)          → list of statements
    ↓
for each statement: eval expressions with `vars` dict
    ↓
engine.addShape({type, args, color, layer, groupPath})
    ↓
engine.redraw()  →  canvas 2D context, with view transform applied
```

Errors flow back up as `{ line, col, message }` and get formatted by `formatError()` into `"line L, col C: msg"` shown in the status bar.

---

## 🧠 The language

### Statements

| Command | Form | Notes |
|---|---|---|
| `let` | `let name = expr` | Bind a numeric variable |
| `line` | `line x1 y1 x2 y2` | |
| `circle` | `circle cx cy r` | Outline |
| `fillcircle` | `fillcircle cx cy r` | Filled |
| `rect` | `rect x y w h` | Outline |
| `arc` | `arc cx cy r startDeg endDeg` | Angles in **degrees** |
| `polyline` | `polyline x1 y1 x2 y2 ...` | Even coordinate count |
| `text` | `text x y "content" [size]` | Quoted string required |
| `color` | `color name` | PICO-8 names, or `"#hex"` quoted |
| `layer` | `layer name [color name]` | Starts a new layer |
| `hide` / `show` | `hide name` | Per-layer visibility |
| `group` / `endgroup` | `group name` | Nestable; recorded but not yet transformed |
| `grid` | `grid on\|off` | |
| `clear` | `clear` | Wipes shapes; layers persist |

### Expressions

- **Operators:** `+ - * / % ^` and `== != <= >=` (last four return `0`/`1`)
- **Constants:** `pi`, `tau`, `e`
- **Functions:** `sin cos tan asin acos atan sqrt abs min max floor ceil round pow`
- **Angles** for trig are in **degrees** (CAD-friendly), not radians
- **Precedence**: standard Pratt parser, `^` is right-associative

```
let w = 200
let a = 45
rect 0 0 w (w * 0.5)
line 200 200 (200 + 100 * cos(a)) (200 + 100 * sin(a))
```

### Comments

- `//` to end of line
- `#` at the start of a line (but **not** mid-line, since `#` in `color "#ff0000"` is inside a string)

---

## 🎨 Color system

Named colors only, from the **PICO-8 palette** (16 colors):

```
black darkblue darkpurple darkgreen brown darkgray lightgray white
red orange yellow green blue lavender pink peach
```

Aliases: `grey`/`gray` → `darkgray`, `purple` → `darkpurple`, `cyan` → `blue`, `magenta` → `pink`, `lime` → `green`, `navy` → `darkblue`.

Quoted hex (`color "#ff004d"`) also works if someone needs a specific tone, but the docs steer toward named colors.

**Design reason:** named colors are faster to type, match each other visually (the palette is designed to), and avoid the `#`-as-comment tokenizer ambiguity entirely.

---

## 🖼️ Rendering

**Canvas 2D** is used, not SVG (SVG is only for export). Reasons:

- Faster for many small shapes.
- Trivial to implement pan/zoom with `ctx.translate()` / `ctx.scale()`.
- Grid + axes adapt to zoom level automatically.

### View transform

World → screen:

```
screenX = worldX * zoom + panX
screenY = worldY * zoom + panY
```

Inverse (`screenToWorld`) is used for zoom-at-cursor math. `zoomAt()` is verified algebraically — the world point under the cursor stays under the cursor after zoom.

### Grid

Step adapts: base 40 world units, multiplied by 4 if on-screen step drops below 20px, halved if above 120px. This keeps the grid density visually consistent across zoom levels.

### Axes (added recently)

Two lines at world `y = 0` (X axis) and `x = 0` (Y axis), plus a small dot at the origin. Colored `#4a4b52` (brighter than grid `#2e2f33`). Stroke width divided by `zoom` so it stays pixel-constant on screen.

---

## 🎨 PICO-8 palette (canonical)

```
black      #000000    darkblue   #1d2b53
darkpurple #7e2553    darkgreen  #008751
brown      #ab5236    darkgray   #5f574f
lightgray  #c2c3c7    white      #fff1e8
red        #ff004d    orange     #ffa300
yellow     #ffec27    green      #00e436
blue       #29adff    lavender   #83769c
pink       #ff77a8    peach      #ffccaa
```

Default `currentColor` is `white` (`#fff1e8`). Layer color, if set, overrides shape color at render time.

---

## 🧩 Layers & groups

**Layers** — each shape belongs to exactly one layer. Layers carry `{name, visible, color}`. Visibility is respected in both `redraw()` and `computeBounds()`. A `hide`/`show` only flips the boolean; shapes are never deleted.

**Groups** — a nested path is recorded on each shape (`shape.groupPath`). Groups are **not yet used** for any rendering or transform — they're stored so a future `group rotate` / `group translate` / `hide group` can be added without a scene-graph migration.

---

## 📤 Export

- **SVG** — serializes each shape to an `<svg>` element. Uses the current scene bounds + 20px padding as `viewBox`. Layer visibility respected. Layer color respected.
- **PNG** — renders to an offscreen canvas at 2× scale. Same bounds logic. Same visibility rules.

Neither export includes the grid or axes — the idea is that exports are *clean output*, not screenshots of the editor.

---

## 💾 Persistence

`localStorage` key: `cadybara.project.v1`. Saved shape:

```json
{
  "code": "...full editor contents...",
  "view": { "panX": 0, "panY": 0, "zoom": 1 },
  "autoRender": true
}
```

Saved 400ms after the last edit (debounced), and after every pan/zoom. Restored on page load if present. **Reset** button clears storage and reloads the default example.

**Why versioned key:** future schema changes (e.g. adding `version` field, migrating old view format) can bump the key without breaking old saves.

---

## 🎮 Editor UX

- **Live render** — 120ms debounce on `input`. Can be frozen via the `🟢 auto` / `🔴 auto` toggle (useful for big drawings or mid-edit flicker).
- **Ctrl+Enter** — force render even when frozen.
- **Tab** — inserts two spaces (not focus change).
- **Intellisense** — triggered on `input` and `click`, filters `syn.json` commands by prefix, navigates with ↑/↓, accepts with Enter/Tab, dismisses with Esc or blur.
- **Help modal** — `? help` button, renders `syn.json` commands + a PICO-8 swatch table + expression / viewport reference.
- **About popup** — clicking the small logo opens a centered "about" modal with smooth scale-in and scale-out. Close button, backdrop click, and Esc all close it.

---

## 🔍 Parser details (in case you need to touch it)

### Tokenizer

Hand-rolled. Emits `{type, value, line, col}`. Types: `number`, `string`, `ident`, `op`, `eof`. Every token carries its source position.

**`#` handling:** only treated as a comment when it's the first non-whitespace on a line (tracked via an `atLineStart` flag). This was a bug — early versions treated *every* `#` as a comment, which silently ate `color #6c9eff` and merged lines. Fixed by tracking line start.

### Pratt parser

Precedence table:

```
+ -       1
* / %     2
^         3 (right-associative)
== != <= >=  0
```

Unary `-`/`+` parsed before binary. Function calls (`foo(...)`) and parenthesized expressions handled in `parsePrimary`.

### Statement parser

Scans tokens sequentially. Each keyword has its own branch in `parseProgram()`:

- **Simple statements** (`clear`, `grid`) — 0 or 1 argument.
- **Parameterized statements** (`layer`, `hide`, `color`) — 1 or 2 tokens.
- **`let`** — requires `ident = expr`.
- **`text`** — `expr expr "string" [expr]` (own branch, because content is a string not a number).
- **Primitives** (`line`, `circle`, `rect`, `arc`, `polyline`, `fillcircle`) — one generic branch consuming arguments until a known statement keyword (`isStatementStart`) or EOF.

### Error format

All parser errors throw `{ line, col, message }`. `formatError()` in `cad.js` turns it into `"line L, col C: message"`.

`execute()` catches both parse errors and per-statement eval errors, stops at the first, and returns the formatted string (or `null` on success). `script.js` displays it in the status bar.

### Known parser limitations

- **No string variables.** `let s = "hello"` works in the tokenizer but `text x y s` doesn't — `text` requires a literal string token, not a variable holding a string.
- **No arrays / loops / conditionals.** Kept minimal on purpose.
- **No function definitions.** Only the built-in `FUNCS` table is callable.
- **Single-pass evaluation.** Statements execute in order; variables must be declared before use.

---

## 🐛 Known issues & rough edges

- **`#` unquoted hex not supported.** `color #ff0000` fails; must use `color "#ff0000"` or a named color. Design choice — avoids ambiguity with the `#` comment marker.
- **Layer color silently overrides shape color.** If you set `layer x color blue` and then `color red`, shapes in that layer still render blue. Intentional but surprising; documented in help.
- **`group`/`endgroup` are recorded but not used.** No transform, no visibility toggle. Placeholder for future work.
- **No undo/redo.** Ctrl+Z reverts raw textarea edits via the browser, but not scene state.
- **No selection or direct manipulation.** Everything is code-driven.
- **PNG export at 2× only.** No DPI setting.
- **`prefers-reduced-motion`** not respected for the popup animations (small polish item).
- **No autocomplete for variable names.** Intellisense only suggests commands, not user-defined vars.

---

## 🚀 Roadmap (ordered by impact)

### High-value, small scope

1. **Undo/redo** — snapshot `{code, cursor}` to an array on `input`; `Ctrl+Z`/`Ctrl+Shift+Z` walk it.
2. **Variable autocomplete** — parse `let name =` lines live, suggest names after `line` / `circle` / etc.
3. **Error underline** — a `<pre>` overlay behind the textarea, colored span on the failing line.
4. **`prefers-reduced-motion`** — 1-line CSS media query for popup animations.
5. **Axis tick labels** — small numbers at `(0,0)` and along the axes so "origin" is unambiguous.

### Medium scope

6. **Loops** — `for i = 0 to 10 step 2 { ... }` or a `repeat N { ... }` block. Probably the biggest feature that makes cadybara feel like a real language.
7. **Groups as transform containers** — `group box rotate 45 around 200 200` — the `groupPath` plumbing is already there.
8. **Shape selection** — click-to-select hit testing, show bounding box, drag to move. Big change: editor is code-first, so selection must either write back to code (hard) or introduce a non-code source of truth (breaks the design).
9. **`let` with string values** — `let msg = "hello"` then `text 100 100 msg`.
10. **PNG export DPI** — a small dropdown or `exportPng(engine, scale)` argument.

### Long shot / fun

11. **DXF export** — surprising amount of work but very "CAD".
12. **Snap-to-grid for pointer** — irrelevant until pointer-driven shapes exist.
13. **Theme switcher** — dark is fine; light could exist.
14. **`.cadybara` file format** — a plain-text file with `code` + `view`; openable via file input.

---

## 📜 Design decisions (and why)

| Decision | Why |
|---|---|
| **Vanilla JS, no build** | Zero setup. Edit → save → reload. Easier for a small project than Vite/Webpack. |
| **`window` globals, no ES modules** | Works via `file://` if a user just double-clicks `index.html`. `syn.json` needs `http://`, but the rest doesn't. |
| **`syn.json` as the only metadata source** | One place to update when adding a command. Help modal + intellisense auto-pick it up. |
| **PICO-8 palette, named colors** | Fast to type, visually cohesive, no `#hex` ambiguity. |
| **Angles in degrees** | CAD convention; `sin(45)` is more intuitive than `sin(π/4)`. |
| **Canvas 2D, not SVG, for rendering** | Faster for many shapes, simpler transform math. SVG for export only. |
| **First-error-wins evaluation** | Simpler to reason about than collecting all errors. Matches compiler behavior. |
| **Scene graph, not immediate-mode** | `addShape` records + `redraw` renders. Enables layers, groups, export, bounds, future selection. |
| **`groupPath` recorded but unused** | Cheap to record now, cheaper than migrating the scene graph later. |
| **localStorage, versioned key** | Simple persistence without a backend. Version in the key allows schema migration later. |
| **Live render + freeze toggle** | Live-by-default is the whole point. The toggle is an escape hatch for large drawings. |

---

## 📝 Session log

Reverse chronological. One entry per work session, plus a "next" line.

### 2026-10-20 — axes, palette, popup, parser fix

- **Fixed `#` tokenizer bug** — `color #6c9eff` was silently treated as a comment, eating the whole line and the next line's first token. Now `#` is only a comment at line start.
- **Added PICO-8 palette** — 16 named colors + aliases, `normalizeColor()` centralizes resolution, default color is now `white`.
- **Removed unquoted hex** — replaced with named colors; quoted `"#hex"` still works. Simpler grammar, no ambiguity.
- **Added axes + origin** — two lines through `(0,0)` plus a small blue dot, pixel-constant stroke, drawn inside `drawGrid()`.
- **Added About popup** — `logoPopup.js`, click the logo in the header, smooth open/close animations, close via ✕ / backdrop / Esc.
- **Added icon.png + icon-transparent.png** — favicon, header logo, popup close button.
- **Fixed broken scroll in editor** — added `min-height: 0` throughout the flex chain so the textarea scrolls internally instead of growing the whole layout.
- **Extracted quick-ref bar** — removed from UI; help modal covers it.

**Next:** undo/redo, or variable autocomplete. Undo is probably more useful.

### 2026-10-19 — extended language, export, persistence

- **Variables + expressions** — `let`, full Pratt parser, trig in degrees, `pi`/`tau`/`e`, math functions.
- **Layers** — `layer`, `hide`, `show`, per-layer color.
- **Groups** — `group` / `endgroup`, recorded in `shape.groupPath`.
- **Export** — SVG serialization + PNG rasterization at 2×.
- **Pan/zoom** — drag to pan, wheel to zoom at cursor, `⊡ fit`, `Ctrl+0`.
- **localStorage** — code + view + autoRender saved, restored on load.
- **Real parser errors** — `line L, col C: message` throughout.
- **Intellisense + help modal** — from `syn.json`.
- **Auto-render toggle** — `🟢 auto` / `🔴 auto` in the header.

**Next:** axes, palette rework.

### 2026-10-18 — initial scaffold

- **Core engine** — `CadybaraEngine` with `line` / `circle` / `rect` / `arc` / `color` / `clear` / `grid`.
- **Editor + canvas split layout**, live render, status bar.
- **Help modal**, `syn.json` metadata.

**Next:** expressions and variables.

---

## 🧭 How to pick this up

If you're a **human contributor**:

1. Read `parser.js` first — it's the spine.
2. Read `cad.js` next — it's the body.
3. `script.js` is glue, skim it.
4. `export.js` and `storage.js` are small, read them last.
5. To add a command, see **extending.md**.

If you're an **AI collaborator**:

1. The **Data flow** section above shows exactly how a keystroke becomes pixels.
2. **Known issues** and **Roadmap** are where the biggest value is.
3. **Design decisions** explains why things are the way they are — don't "fix" those without a strong argument.
4. When adding a command: `parser.js` (keyword + `isStatementStart`) → `cad.js` (`drawShape` + `computeBounds`) → `syn.json`. **Three files, always.**
5. Don't introduce a build step. Don't introduce ES modules. Don't add a framework. The whole point is *zero setup*.

---

## 🏁 TL;DR

> cadybara is a vanilla-JS live pseudo-CAD. It's a parser, a scene graph, a renderer, and a UI — four responsibilities, cleanly separated. Add a command by touching three files. Don't add a build step. The origin is at `(0, 0)` with a small blue dot. Palette is PICO-8. Angles are degrees. Have fun.
