# 🦫 Extending cadybara — Adding New Commands

A practical guide to adding new drawing primitives to cadybara. Follow these steps in order and you'll have a working command in under 5 minutes.

---

## 📋 Overview

Adding a new command touches **three files**:

| File | What to do |
|------|-----------|
| `cad.js` | Add a drawing method + a `case` in the `execute()` switch |
| `syn.json` | Add a JSON entry so it appears in help + intellisense |
| `script.js` | (optional) nothing — auto-picks up from `syn.json` |
| `index.html` | (optional) add to the quick-reference bar |

We'll use a real example: a **`polyline`** command that draws a chain of connected segments.

```
polyline x1 y1 x2 y2 x3 y3 ...
```

---

## 1️⃣ Add the drawing primitive in `cad.js`

Open `cad.js`. Find the `CadybaraEngine` class. Add a new method alongside `drawLine`, `drawCircle`, etc.

```javascript
// inside class CadybaraEngine

drawPolyline(points) {
  if (points.length < 4) return; // need at least 2 points (x,y pairs)
  const ctx = this.ctx;
  ctx.beginPath();
  ctx.strokeStyle = this.currentColor;
  ctx.lineWidth = 2.2;
  ctx.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) {
    ctx.lineTo(points[i], points[i + 1]);
  }
  ctx.stroke();
}
```

### Conventions to follow

- **Name it `drawXxx`** — keeps methods grouped.
- **Set `ctx.strokeStyle = this.currentColor`** — every primitive respects the active color.
- **`lineWidth = 2.2`** — matches existing strokes (change globally if you want).
- **Use `beginPath()` / `stroke()`** — never reuse a path across primitives.
- **Validate inputs early** — return silently or throw; `execute()` catches errors.
- **Accept raw numbers**, not strings — the parser already converts.

---

## 2️⃣ Add a `case` in the `execute()` switch

Still in `cad.js`. Inside `execute()`, find the `switch (cmd)` block. Add a new case:

```javascript
case 'polyline': {
  const pts = parts.slice(1).map(Number);
  if (pts.length < 4) throw new Error('polyline needs at least x1 y1 x2 y2');
  if (pts.length % 2 !== 0) throw new Error('polyline needs an even number of coordinates');
  if (pts.some(isNaN)) throw new Error('polyline coordinates must be numbers');
  this.drawPolyline(pts);
  break;
}
```

### Rules for the case block

- **`cmd`** is already lowercased — match it in lowercase.
- **`parts`** is the raw split line (`['polyline', '10', '10', ...]`).
- **`args`** is `parts.slice(1).map(Number)` — handy for fixed-arity commands, but for variable-arity commands like `polyline` use `parts.slice(1)` directly so you can check length.
- **`throw new Error('message')`** on bad input — the engine catches it and reports `line N: message` in the status bar.
- **Don't forget `break`** — without it, execution falls through.

---

## 3️⃣ Add the entry to `syn.json`

Open `syn.json`. Add a new object to the `commands` array:

```json
{
  "name": "polyline",
  "signature": "polyline x1 y1 x2 y2 x3 y3 ...",
  "args": ["x1", "y1", "x2", "y2", "..."],
  "description": "Draw a connected chain of line segments through the given points. Requires an even number of coordinates (at least 4).",
  "example": "polyline 100 100 200 150 300 100 400 200"
}
```

### Field reference

| Field | Required | Purpose |
|-------|----------|---------|
| `name` | ✅ | Command keyword. **Must match** the `case` label in `cad.js` exactly (lowercase). |
| `signature` | ✅ | Shown in intellisense and help table. Use placeholder names. |
| `args` | ⬜ | Array of argument names — informational only. |
| `description` | ⬜ | Plain-English explanation shown in the help modal. |
| `example` | ⬜ | One-liner example shown in help. Prefix `→` is added automatically. |

**That's it.** Reload the page and:
- The help modal (`? help` button) shows the new command.
- Intellisense starts suggesting `polyline` as you type `poly…`.

No changes to `script.js` are needed — everything reads from `SYNTAX.commands`.

---

## 4️⃣ (Optional) Add to the quick-reference bar

`index.html` has a footer strip showing commands. To include the new one:

```html
<div class="quick-ref">
  <span>commands:</span>
  <code>line x1 y1 x2 y2</code>
  <code>circle cx cy r</code>
  <code>rect x y w h</code>
  <code>arc cx cy r start end</code>
  <code>polyline x1 y1 x2 y2 ...</code>   <!-- 👈 new -->
  <code>color #hex</code>
  <code>clear</code>
  <code>grid on/off</code>
</div>
```

---

## 5️⃣ Test it

Paste this into the editor:

```
color #6c9eff
polyline 100 100 200 200 300 100 400 200 500 100
```

You should see a zig-zag. Now try a bad input:

```
polyline 1 2 3
```

Status bar should show `⚠ line 1: polyline needs an even number of coordinates`.

---

## 🧩 More examples

### Example A — `fillCircle` (adds a new state modifier)

**`cad.js`** — add a method and case:

```javascript
fillCircle(cx, cy, r) {
  this.ctx.beginPath();
  this.ctx.fillStyle = this.currentColor;
  this.ctx.arc(cx, cy, Math.abs(r), 0, Math.PI * 2);
  this.ctx.fill();
}

// in execute():
case 'fillcircle':
  if (args.length < 3) throw new Error('fillCircle needs cx cy r');
  this.fillCircle(args[0], args[1], args[2]);
  break;
```

**`syn.json`**:

```json
{
  "name": "fillcircle",
  "signature": "fillcircle cx cy r",
  "args": ["cx", "cy", "r"],
  "description": "Draw a filled circle using the current color.",
  "example": "fillcircle 250 250 40"
}
```

> 💡 Note: `name` is lowercase (`fillcircle`) to match the `case` label — intellisense is case-insensitive but the parser lowercases input.

---

### Example B — `text` (renders a label)

**`cad.js`**:

```javascript
drawText(x, y, content, size = 16) {
  this.ctx.fillStyle = this.currentColor;
  this.ctx.font = `${size}px 'Fira Code', monospace`;
  this.ctx.textBaseline = 'top';
  this.ctx.fillText(content, x, y);
}

// in execute():
case 'text': {
  // text x y "hello world" [size]
  const m = raw.match(/^text\s+(\S+)\s+(\S+)\s+"([^"]*)"(?:\s+(\S+))?$/i);
  if (!m) throw new Error('text syntax: text x y "content" [size]');
  const [, xs, ys, content, ss] = m;
  this.drawText(Number(xs), Number(ys), content, ss ? Number(ss) : 16);
  break;
}
```

**`syn.json`**:

```json
{
  "name": "text",
  "signature": "text x y \"content\" [size]",
  "args": ["x", "y", "\"content\"", "size?"],
  "description": "Render a text label. Content must be in double quotes. Size defaults to 16.",
  "example": "text 100 100 \"Hello cadybara\" 20"
}
```

> 💡 This shows how to handle **non-numeric arguments** — use a regex on `raw` instead of `parts.map(Number)`.

---

## ⚠️ Gotchas & best practices

1. **`name` in `syn.json` must match the `case` in `cad.js`.** The parser lowercases the command, so `case 'polyline':` ↔ `"name": "polyline"`.

2. **Never reuse `ctx.beginPath()` across draws.** Always call it inside your primitive.

3. **Respect `this.currentColor`** — otherwise `color #ff0000` will silently stop working for your command.

4. **Throw on bad input.** The engine catches it and reports `line N: message` — don't silently ignore.

5. **`grid` is special.** It's re-executed via a second pass. If your command depends on grid state, read `this.showGrid` inside your draw method.

6. **Variable-arity commands** (`polyline`, `text`, etc.) should parse `parts` (or regex `raw`) directly — don't rely on `args` since it may contain `NaN` for non-numeric tokens.

7. **Keep `syn.json` valid JSON.** No trailing commas, no comments. Use `python3 -m json.tool syn.json` to validate.

8. **Serve via HTTP** for `syn.json` to load:
   ```bash
   python3 -m http.server
   ```
   Opening `index.html` via `file://` will trigger the fallback syntax in `script.js`.

---

## ✅ Checklist

Before committing a new command, tick these off:

- [ ] `drawXxx()` method added to `CadybaraEngine` (uses `this.currentColor`)
- [ ] `case 'xxx':` added to `execute()` switch (with `break` and validation)
- [ ] `syn.json` entry added (`name` matches the `case`, signature + description + example)
- [ ] Tested happy path — shape renders correctly
- [ ] Tested error path — bad input shows `⚠ line N: …` in status bar
- [ ] Tested `color #hex` interaction — new primitive respects the active color
- [ ] (optional) Added to `.quick-ref` in `index.html`
- [ ] `syn.json` validates as JSON

Happy extending! 🦫