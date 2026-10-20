# 🦫 Extending cadybara — Adding New Commands

A practical guide to adding new drawing primitives to cadybara. Follow these steps in order and you'll have a working command in under 5 minutes.

---

## 📋 Overview

Adding a new command touches **three files**:

| File | What to do |
|------|-----------|
| `cad.js` | Add a drawing method + a `case` in the `execute()` switch |
| `syn.json` | Add a JSON entry so it appears in help + intellisense |
| `parser.js` | Add the keyword to `isStatementStart` and (if needed) a statement branch |

Optionally, `script.js` can be extended if the command needs UI behavior.

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

Still in `cad.js`. Inside `execute()`, find the `switch (st.type)` block. Add a new case:

```javascript
case 'prim': {
  const args = st.args.map(a => P.evalExpr(a, vars));
  this.addShape({ type: st.name, args, color: this.currentColor });
  break;
}
```

Wait — that's the generic branch. **The primitives are already handled generically** via `addShape` + `drawShape`. So for a new primitive, the steps are actually:

**a)** Add the keyword to the parser's primitive list in `parser.js` (see step 3).

**b)** Add a `case` in `drawShape()` in `cad.js`:

```javascript
case 'polyline': {
  if (s.args.length < 4) break;
  ctx.beginPath();
  ctx.moveTo(s.args[0], s.args[1]);
  for (let i = 2; i < s.args.length; i += 2) ctx.lineTo(s.args[i], s.args[i + 1]);
  ctx.stroke();
  break;
}
```

**c)** Add a bounds case in `computeBounds()` in `cad.js`:

```javascript
case 'polyline':
  for (let i = 0; i < s.args.length; i += 2) add(s.args[i], s.args[i + 1]);
  break;
```

### Rules for the case block

- **`s.args`** is already evaluated — it's an array of numbers.
- **`s.color`** is already resolved via `normalizeColor`.
- **Don't forget `break`** — without it, execution falls through.
- **`computeBounds()` matters** — the `⊡ fit` button uses it.

---

## 3️⃣ Register the keyword in `parser.js`

Open `parser.js`. Two places:

**a)** Add it to the primitive list in `parseProgram()`:

```javascript
if (['line', 'circle', 'rect', 'arc', 'polyline', 'fillcircle'].includes(kw)) {
  state.i++;
  const args = [];
  while (tokens[state.i].type !== 'eof' &&
         !(tokens[state.i].type === 'ident' && isStatementStart(tokens[state.i].value))) {
    args.push(parseExpr(tokens, state));
  }
  stmts.push({ type: 'prim', name: kw, args, line: t.line, col: t.col });
  continue;
}
```

**b)** Add it to `isStatementStart()` so the parser knows where a statement ends:

```javascript
function isStatementStart(word) {
  const kw = word.toLowerCase();
  return ['let', 'layer', 'group', 'endgroup', 'hide', 'show', 'grid', 'clear',
          'color', 'text', 'line', 'circle', 'rect', 'arc', 'polyline', 'fillcircle'].includes(kw);
}
```

> ⚠️ **If you skip this step**, the parser will happily consume the next line's `line` / `circle` / etc. as a bare argument and error out with `unexpected token`.

---

## 4️⃣ Add the entry to `syn.json`

Open `syn.json`. Add a new object to the `commands` array:

```json
{
  "name": "polyline",
  "signature": "polyline x1 y1 x2 y2 x3 y3 ...",
  "description": "Draw a connected chain of line segments through the given points. Requires an even number of coordinates (at least 4).",
  "example": "polyline 100 100 200 150 300 100 400 200"
}
```

### Field reference

| Field | Required | Purpose |
|-------|----------|---------|
| `name` | ✅ | Command keyword. **Must match** the `case` label / parser keyword exactly (lowercase). |
| `signature` | ✅ | Shown in intellisense and help table. Use placeholder names. |
| `description` | ⬜ | Plain-English explanation shown in the help modal. |
| `example` | ⬜ | One-liner example shown in help. Prefix `→` is added automatically. |

**That's it.** Reload the page and:

- The help modal (`? help` button) shows the new command.
- Intellisense starts suggesting `polyline` as you type `poly…`.

No `script.js` changes needed — help + intellisense read from `SYNTAX.commands`, which is `syn.json`.

---

## 5️⃣ Test it

Paste this into the editor:

```
color blue
polyline 100 100 200 200 300 100 400 200 500 100
```

You should see a zig-zag. Now try a bad input:

```
polyline 1 2 3
```

Status bar should show `⚠ line 1, col ...: polyline needs at least x1 y1 x2 y2` (or similar — the parser catches arity errors from your `throw`).

---

## 🧩 More examples

### Example A — `fillcircle` (filled primitive)

**`parser.js`** — add `'fillcircle'` to the primitive list:

```javascript
if (['line', 'circle', 'rect', 'arc', 'polyline', 'fillcircle'].includes(kw)) {
```

**`cad.js`** — add to `drawShape()`:

```javascript
case 'fillcircle': {
  const [cx, cy, r] = s.args;
  ctx.beginPath(); ctx.arc(cx, cy, Math.abs(r), 0, Math.PI * 2); ctx.fill();
  break;
}
```

**`cad.js`** — add to `computeBounds()` (same as `circle`):

```javascript
case 'circle':
case 'fillcircle':
  add(s.args[0] - s.args[2], s.args[1] - s.args[2]);
  add(s.args[0] + s.args[2], s.args[1] + s.args[2]);
  break;
```

**`syn.json`**:

```json
{
  "name": "fillcircle",
  "signature": "fillcircle cx cy r",
  "description": "Draw a filled circle using the current color.",
  "example": "fillcircle 200 200 40"
}
```

> 💡 Note: `name` is lowercase (`fillcircle`) to match the parser keyword — intellisense is case-insensitive but the parser lowercases input.

---

### Example B — `text` (renders a label with quotes)

`text` is **already implemented** in the current codebase — but it's a good model for non-numeric commands.

**`parser.js`** — its own statement branch (not the primitive list):

```javascript
if (kw === 'text') {
  state.i++;
  const x = parseExpr(tokens, state);
  const y = parseExpr(tokens, state);
  const contentTok = tokens[state.i];
  if (contentTok.type !== 'string') {
    throw { line: t.line, col: t.col, message: 'text expects a quoted string' };
  }
  state.i++;
  let size = null;
  if (tokens[state.i].type === 'number') {
    size = parseExpr(tokens, state);
  }
  stmts.push({ type: 'text', x, y, content: contentTok.value, size, line: t.line, col: t.col });
  continue;
}
```

**`cad.js`** — `drawShape()` has a `text` case, `computeBounds()` estimates text bounds. `execute()` handles `st.type === 'text'` separately because `content` is a string, not a number.

**`syn.json`**:

```json
{
  "name": "text",
  "signature": "text x y \"content\" [size]",
  "description": "Render a text label. Content must be in double quotes. Size defaults to 16.",
  "example": "text 100 100 \"Hello cadybara\" 20"
}
```

> 💡 Non-numeric commands need their **own parser branch** — they can't use the generic primitive path because `parts.map(Number)` would destroy the string content.

---

### Example C — `pico` (uses the palette)

The palette is exposed as `window.PICO8`. A command that references it might look like:

```javascript
// in cad.js execute(), for a hypothetical 'colorbyname' command
case 'colorbyname':
  this.currentColor = window.normalizeColor(st.value);
  break;
```

…but that's what `color` already does. So palette access is automatic — any new command that sets `this.currentColor` benefits from the PICO-8 names for free.

---

## ⚠️ Gotchas & best practices

1. **`name` in `syn.json` must match the keyword in `parser.js` and `cad.js`.** All three stay in sync. The parser lowercases, so use lowercase everywhere.

2. **Never reuse `ctx.beginPath()` across draws.** Always call it inside your `drawShape` case.

3. **Respect `this.currentColor`** (or use `s.color` — the shape's resolved color) — otherwise `color blue` will silently stop working for your command.

4. **Throw on bad input inside the parser**, not inside `drawShape`. Drawing errors are silent; parser errors show `⚠ line L, col C: ...` in the status bar.

5. **Update `computeBounds()`** — otherwise `⊡ fit` ignores your new shape and the export crop is wrong.

6. **Variable-arity commands** (`polyline`, custom paths) — the generic primitive branch already handles them via the `while` loop; just add the keyword to both `parseProgram`'s list **and** `isStatementStart()`.

7. **Keep `syn.json` valid JSON.** No trailing commas, no comments. Use `python3 -m json.tool syn.json` to validate.

8. **Serve via HTTP** for `syn.json` to load:
   ```bash
   python3 -m http.server
   ```
   Opening `index.html` via `file://` triggers the hardcoded fallback syntax in `script.js`.

9. **`#` is a comment** — hex colors must be quoted: `color "#ff004d"`. Use named colors (`color red`) or the `"#hex"` string form.

10. **Layer colors override shape colors.** If a shape looks wrong, check whether the active layer (`layer walls color blue`) is overriding `color red`.

---

## ✅ Checklist

Before committing a new command, tick these off:

- [ ] **Parser**: keyword added to the primitive list in `parseProgram()` — OR a dedicated statement branch for non-numeric args
- [ ] **Parser**: keyword added to `isStatementStart()` (primitives only)
- [ ] **cad.js**: `case 'xxx':` added to `drawShape()` (with `break`)
- [ ] **cad.js**: `case 'xxx':` added to `computeBounds()` so `⊡ fit` and export work
- [ ] **syn.json**: entry added (`name` matches the parser keyword, signature + description + example)
- [ ] Tested happy path — shape renders correctly
- [ ] Tested error path — bad input shows `⚠ line L, col C: …` in status bar
- [ ] Tested `color blue` interaction — new primitive respects the active color
- [ ] Tested `⊡ fit` — new shape is included in the bounds
- [ ] `syn.json` validates as JSON

Happy extending! 🦫