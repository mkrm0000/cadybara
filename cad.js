// cad.js — scene graph, renderer, pan/zoom view transform

// ----- PICO-8 palette -----
const PICO8 = {
  black:      '#000000',
  darkblue:   '#1d2b53',
  darkpurple: '#7e2553',
  darkgreen:  '#008751',
  brown:      '#ab5236',
  darkgray:   '#5f574f',
  lightgray:  '#c2c3c7',
  white:      '#fff1e8',
  red:        '#ff004d',
  orange:     '#ffa300',
  yellow:     '#ffec27',
  green:      '#00e436',
  blue:       '#29adff',
  lavender:   '#83769c',
  pink:       '#ff77a8',
  peach:      '#ffccaa',
};

const COLOR_ALIASES = {
  grey: 'darkgray',
  gray: 'darkgray',
  purple: 'darkpurple',
  cyan: 'blue',
  magenta: 'pink',
  lime: 'green',
  navy: 'darkblue',
};

function normalizeColor(v) {
  if (typeof v !== 'string') return PICO8.white;
  const s = v.trim().toLowerCase();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) return s;
  const name = COLOR_ALIASES[s] || s;
  if (PICO8[name]) return PICO8[name];
  return PICO8.white;
}

window.PICO8 = PICO8;
window.normalizeColor = normalizeColor;

class CadybaraEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;

    // view transform (screen <-> world)
    this.view = { panX: 0, panY: 0, zoom: 1 };

    // scene state
    this.layers = [];            // [{name, visible, color}]
    this.shapes = [];            // [{type, args, color, layer, groupPath}]
    this.currentLayer = 'default';
    this.currentGroupPath = [];
    this.currentColor = PICO8.white;
    this.showGrid = true;

    this.ensureLayer('default');
    this.resetView();
  }

  // ----- view -----
  resetView() {
    this.view = { panX: 0, panY: 0, zoom: 1 };
    this.redraw();
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.view.panX) / this.view.zoom,
      y: (sy - this.view.panY) / this.view.zoom,
    };
  }

  panBy(dx, dy) {
    this.view.panX += dx;
    this.view.panY += dy;
    this.redraw();
  }

  zoomAt(sx, sy, factor) {
    const before = this.screenToWorld(sx, sy);
    this.view.zoom = Math.max(0.1, Math.min(20, this.view.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.view.panX += (after.x - before.x) * this.view.zoom;
    this.view.panY += (after.y - before.y) * this.view.zoom;
    this.redraw();
  }

  fit() {
    const b = this.computeBounds();
    if (!b) { this.resetView(); return; }
    const pad = 40;
    const w = b.maxX - b.minX + pad * 2;
    const h = b.maxY - b.minY + pad * 2;
    const zoom = Math.min(this.width / w, this.height / h, 5);
    this.view.zoom = zoom;
    this.view.panX = (this.width / zoom - (b.minX + b.maxX)) / 2 * zoom;
    this.view.panY = (this.height / zoom - (b.minY + b.maxY)) / 2 * zoom;
    this.redraw();
  }

  computeBounds() {
    if (!this.shapes.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const add = (x, y) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    };
    for (const s of this.shapes) {
      if (!this.isVisible(s)) continue;
      switch (s.type) {
        case 'line':
          add(s.args[0], s.args[1]); add(s.args[2], s.args[3]); break;
        case 'circle':
        case 'fillcircle':
          add(s.args[0] - s.args[2], s.args[1] - s.args[2]);
          add(s.args[0] + s.args[2], s.args[1] + s.args[2]); break;
        case 'rect':
          add(s.args[0], s.args[1]);
          add(s.args[0] + s.args[2], s.args[1] + s.args[3]); break;
        case 'arc':
          add(s.args[0] - s.args[2], s.args[1] - s.args[2]);
          add(s.args[0] + s.args[2], s.args[1] + s.args[2]); break;
        case 'polyline':
          for (let i = 0; i < s.args.length; i += 2) add(s.args[i], s.args[i + 1]);
          break;
        case 'text':
          add(s.x, s.y); add(s.x + 50, s.y + (s.size || 16)); break;
      }
    }
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
  }

  // ----- layers & groups -----
  ensureLayer(name) {
    if (!this.layers.find(l => l.name === name)) {
      this.layers.push({ name, visible: true, color: null });
    }
    return this.layers.find(l => l.name === name);
  }

  setLayer(name) {
    this.ensureLayer(name);
    this.currentLayer = name;
  }

  setLayerVisible(name, visible) {
    const l = this.ensureLayer(name);
    l.visible = visible;
  }

  setLayerColor(name, color) {
    const l = this.ensureLayer(name);
    l.color = color;
  }

  isVisible(shape) {
    const l = this.layers.find(x => x.name === shape.layer);
    return l ? l.visible : true;
  }

  shapeColor(shape) {
    const l = this.layers.find(x => x.name === shape.layer);
    if (l && l.color) return l.color;
    return shape.color || PICO8.white;
  }

  // ----- draw primitives (recorded, not drawn directly) -----
  addShape(shape) {
    shape.layer = this.currentLayer;
    shape.groupPath = [...this.currentGroupPath];
    this.shapes.push(shape);
  }

  // ----- clear / reset -----
  clear() {
    this.shapes = [];
    this.layers = [];
    this.ensureLayer('default');
    this.currentLayer = 'default';
    this.currentGroupPath = [];
    this.currentColor = PICO8.white;
    this.showGrid = true;
  }

  // ----- execute program -----
  execute(code) {
    this.clear();
    let stmts;
    try {
      stmts = window.CadybaraParser.parseProgram(code);
    } catch (err) {
      this.redraw();
      return formatError(err);
    }

    const vars = {};
    const P = window.CadybaraParser;

    for (const st of stmts) {
      try {
        switch (st.type) {
          case 'let': {
            vars[st.name.toLowerCase()] = P.evalExpr(st.expr, vars);
            break;
          }
          case 'layer': {
            this.setLayer(st.name);
            if (st.color) this.setLayerColor(st.name, normalizeColor(st.color));
            break;
          }
          case 'group':
            this.currentGroupPath.push(st.name);
            break;
          case 'endgroup':
            this.currentGroupPath.pop();
            break;
          case 'hide':
            this.setLayerVisible(st.name, false);
            break;
          case 'show':
            this.setLayerVisible(st.name, true);
            break;
          case 'grid':
            this.showGrid = st.value === 'on';
            break;
          case 'clear':
            this.shapes = [];
            break;
          case 'color':
            this.currentColor = normalizeColor(st.value);
            break;
          case 'prim': {
            const args = st.args.map(a => P.evalExpr(a, vars));
            this.addShape({ type: st.name, args, color: this.currentColor });
            break;
          }
          case 'text': {
            const x = P.evalExpr(st.x, vars);
            const y = P.evalExpr(st.y, vars);
            const size = st.size ? P.evalExpr(st.size, vars) : 16;
            this.addShape({ type: 'text', x, y, content: st.content, size, color: this.currentColor });
            break;
          }
        }
      } catch (err) {
        this.redraw();
        return formatError(err);
      }
    }

    this.redraw();
    return null;
  }

  // ----- render -----
  redraw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1a1b1e';
    ctx.fillRect(0, 0, this.width, this.height);

    // apply view transform
    ctx.translate(this.view.panX, this.view.panY);
    ctx.scale(this.view.zoom, this.view.zoom);

    if (this.showGrid) this.drawGrid();

    for (const s of this.shapes) {
      if (!this.isVisible(s)) continue;
      this.drawShape(s);
    }

    ctx.restore();
  }

  drawGrid() {
    const ctx = this.ctx;
    const worldLeft = -this.view.panX / this.view.zoom;
    const worldTop = -this.view.panY / this.view.zoom;
    const worldRight = worldLeft + this.width / this.view.zoom;
    const worldBottom = worldTop + this.height / this.view.zoom;

    let step = 40;
    const screenStep = step * this.view.zoom;
    if (screenStep < 20) step *= 4;
    else if (screenStep > 120) step /= 2;

    ctx.strokeStyle = '#2e2f33';
    ctx.lineWidth = 0.6 / this.view.zoom;
    ctx.beginPath();
    const sx = Math.floor(worldLeft / step) * step;
    for (let x = sx; x <= worldRight; x += step) {
      ctx.moveTo(x, worldTop);
      ctx.lineTo(x, worldBottom);
    }
    const sy = Math.floor(worldTop / step) * step;
    for (let y = sy; y <= worldBottom; y += step) {
      ctx.moveTo(worldLeft, y);
      ctx.lineTo(worldRight, y);
    }
    ctx.stroke();
  }

  drawShape(s) {
    const ctx = this.ctx;
    ctx.strokeStyle = this.shapeColor(s);
    ctx.fillStyle = this.shapeColor(s);
    ctx.lineWidth = 2.2 / this.view.zoom;

    switch (s.type) {
      case 'line': {
        const [x1, y1, x2, y2] = s.args;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        break;
      }
      case 'circle': {
        const [cx, cy, r] = s.args;
        ctx.beginPath(); ctx.arc(cx, cy, Math.abs(r), 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case 'fillcircle': {
        const [cx, cy, r] = s.args;
        ctx.beginPath(); ctx.arc(cx, cy, Math.abs(r), 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'rect': {
        const [x, y, w, h] = s.args;
        ctx.beginPath(); ctx.rect(x, y, w, h); ctx.stroke();
        break;
      }
      case 'arc': {
        const [cx, cy, r, a1, a2] = s.args;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.abs(r), a1 * Math.PI / 180, a2 * Math.PI / 180);
        ctx.stroke();
        break;
      }
      case 'polyline': {
        if (s.args.length < 4) break;
        ctx.beginPath();
        ctx.moveTo(s.args[0], s.args[1]);
        for (let i = 2; i < s.args.length; i += 2) ctx.lineTo(s.args[i], s.args[i + 1]);
        ctx.stroke();
        break;
      }
      case 'text': {
        ctx.font = `${s.size}px 'Fira Code', monospace`;
        ctx.textBaseline = 'top';
        ctx.fillText(s.content, s.x, s.y);
        break;
      }
    }
  }

  // ----- for export -----
  getVisibleShapes() {
    return this.shapes.filter(s => this.isVisible(s));
  }
}

function formatError(err) {
  if (!err) return null;
  return `line ${err.line}, col ${err.col}: ${err.message}`;
}

window.CadybaraEngine = CadybaraEngine;
window.formatError = formatError;