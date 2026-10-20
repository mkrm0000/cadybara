// cad.js – core drawing engine (pseudo‑CAD interpreter + renderer)

class CadybaraEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.reset();
  }

  reset() {
    // default state
    this.commands = [];          // parsed commands (for debugging)
    this.currentColor = '#e0e0e0';
    this.showGrid = true;
    this.clear();
  }

  clear() {
    this.ctx.fillStyle = '#1a1b1e';
    this.ctx.fillRect(0, 0, this.width, this.height);
    if (this.showGrid) this.drawGrid();
  }

  drawGrid() {
    const ctx = this.ctx;
    const step = 40;
    ctx.strokeStyle = '#2e2f33';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let x = 0; x <= this.width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
    }
    for (let y = 0; y <= this.height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
    }
    ctx.stroke();

    // subtle axis
    ctx.strokeStyle = '#3e3f44';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(this.width / 2, 0);
    ctx.lineTo(this.width / 2, this.height);
    ctx.moveTo(0, this.height / 2);
    ctx.lineTo(this.width, this.height / 2);
    ctx.stroke();
  }

  // -- drawing primitives --
  drawLine(x1, y1, x2, y2) {
    this.ctx.beginPath();
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = 2.2;
    this.ctx.moveTo(x1, y1);
    this.ctx.lineTo(x2, y2);
    this.ctx.stroke();
  }

  drawCircle(cx, cy, r) {
    this.ctx.beginPath();
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = 2.2;
    this.ctx.arc(cx, cy, Math.abs(r), 0, Math.PI * 2);
    this.ctx.stroke();
  }

  drawRect(x, y, w, h) {
    this.ctx.beginPath();
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = 2.2;
    this.ctx.strokeRect(x, y, w, h);
  }

  drawArc(cx, cy, r, startDeg, endDeg) {
    const start = (startDeg * Math.PI) / 180;
    const end = (endDeg * Math.PI) / 180;
    this.ctx.beginPath();
    this.ctx.strokeStyle = this.currentColor;
    this.ctx.lineWidth = 2.2;
    this.ctx.arc(cx, cy, Math.abs(r), start, end);
    this.ctx.stroke();
  }

  setColor(hex) {
    // naive validation; if not valid keep previous
    if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) {
      this.currentColor = hex;
    }
  }

  // -- parser & executor --
  execute(code) {
    this.clear();
    this.commands = [];
    const lines = code.split(/\r?\n/);
    let errorMsg = '';

    for (let i = 0; i < lines.length; i++) {
      let raw = lines[i].trim();
      if (!raw || raw.startsWith('//') || raw.startsWith('#')) continue;

      // remove trailing comments
      const commentIdx = raw.indexOf('//');
      if (commentIdx !== -1) raw = raw.slice(0, commentIdx).trim();
      if (!raw) continue;

      const parts = raw.split(/\s+/);
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1).map(Number);

      try {
        switch (cmd) {
          case 'line':
            if (args.length < 4) throw new Error('line needs x1 y1 x2 y2');
            this.drawLine(args[0], args[1], args[2], args[3]);
            break;
          case 'circle':
            if (args.length < 3) throw new Error('circle needs cx cy r');
            this.drawCircle(args[0], args[1], args[2]);
            break;
          case 'rect':
            if (args.length < 4) throw new Error('rect needs x y w h');
            this.drawRect(args[0], args[1], args[2], args[3]);
            break;
          case 'arc':
            if (args.length < 5) throw new Error('arc needs cx cy r start end');
            this.drawArc(args[0], args[1], args[2], args[3], args[4]);
            break;
          case 'color':
            if (parts.length < 2) throw new Error('color needs #hex');
            this.setColor(parts[1]);
            break;
          case 'clear':
            // already cleared at start, but fine
            break;
          case 'grid':
            if (parts[1] === 'on') this.showGrid = true;
            else if (parts[1] === 'off') this.showGrid = false;
            else throw new Error('grid on/off');
            // re-clear with grid setting
            this.clear();
            // re-apply all previous commands? actually we are executing line by line,
            // so we need to re-run from start for grid change to take effect.
            // simpler: we set flag and after parsing we re-run everything.
            // Better: we handle grid specially — we'll just set flag and after loop re-execute.
            // Let's store the flag and re-run after loop if needed.
            // We'll use a flag to re-execute after.
            // But we're already drawing line by line, so grid on/off mid-stream is tricky.
            // For simplicity, we'll just clear and redraw everything after the loop if grid changed.
            // Actually we'll just set showGrid and note that the whole canvas should be redrawn.
            // We'll handle it by re-running after the loop with the final showGrid.
            // But that would also re-run all commands — which is fine but wasteful.
            // To keep it simple, we'll collect commands and execute at the end.
            // BUT we already draw line by line. Let's change approach: we'll just set showGrid
            // and at the end if grid changed, we re-run everything.
            // Actually we'll do a two-pass: first parse and apply, but grid toggle needs full redraw.
            // For simplicity, I'll just set showGrid and after loop, if grid toggled, re-run.
            // We'll use a flag.
            break;
          default:
            throw new Error(`unknown command: ${cmd}`);
        }
        this.commands.push({ line: i + 1, cmd, args, raw });
      } catch (err) {
        errorMsg = `line ${i + 1}: ${err.message}`;
        // still continue, but record error
        break; // stop on first error for clarity
      }
    }

    // if grid toggled, re-run everything with new grid setting
    // (we detect by comparing? simpler: always re-run if showGrid changed? we don't track.
    //  We'll just re-run if any grid command was seen.)
    const hasGridCmd = lines.some(l => l.trim().toLowerCase().startsWith('grid '));
    if (hasGridCmd) {
      // re-run without grid command causing infinite recursion: we temporarily disable
      // store showGrid, clear, redraw grid if needed, then re-execute all commands EXCEPT grid
      const savedGrid = this.showGrid;
      this.clear(); // this draws grid based on showGrid
      // now re-execute all commands except grid, but we need to parse again.
      // We'll just re-execute the whole code but skip grid commands? easier:
      // We'll re-run with a flag to ignore grid commands.
      // But we are inside execute; let's just do a simple re-run.
      // To avoid infinite recursion, we'll set a flag.
      // Actually we can just re-run the code with grid commands filtered out.
      // Better: we'll just re-run manually here with a flag.
      this._reRunning = true;
      this._gridToggled = true;
      // We'll just re-run the whole execute but skip the grid handling to avoid loop
      // simpler: we clear and re-execute all commands except grid.
      // Let's just do a manual re-run of non-grid commands.
      // Quick fix: re-run execute with grid commands removed.
      const filteredLines = lines.filter(l => !l.trim().toLowerCase().startsWith('grid '));
      this.execute(filteredLines.join('\n'));
      // but this would also re-clear and redraw grid with current showGrid.
      // And we don't want infinite recursion if filteredLines still has no grid.
      // It's fine because filteredLines has no grid.
      // But we are still inside execute; calling execute recursively will re-clear
      // and re-draw everything. That's acceptable.
      // However we must avoid calling execute recursively infinitely.
      // Since filteredLines has no grid, the recursive call won't trigger this again.
      // Also we need to restore state? We're inside the first execute, we already drew stuff.
      // The recursive execute will clear and redraw correctly.
      // So we just return after recursive call.
      return; // the recursive call already did the job.
    }

    if (errorMsg) {
      this._lastError = errorMsg;
    } else {
      this._lastError = null;
    }
    return errorMsg;
  }

  // Helper to re-render from a list of commands (used for grid toggling)
  renderFromCommands(commands, showGrid) {
    this.showGrid = showGrid;
    this.clear();
    this.currentColor = '#e0e0e0';
    for (const c of commands) {
      if (c.cmd === 'grid') continue;
      try {
        switch (c.cmd) {
          case 'line': this.drawLine(c.args[0], c.args[1], c.args[2], c.args[3]); break;
          case 'circle': this.drawCircle(c.args[0], c.args[1], c.args[2]); break;
          case 'rect': this.drawRect(c.args[0], c.args[1], c.args[2], c.args[3]); break;
          case 'arc': this.drawArc(c.args[0], c.args[1], c.args[2], c.args[3], c.args[4]); break;
          case 'color': this.setColor(c.raw.split(/\s+/)[1] || '#e0e0e0'); break;
        }
      } catch (e) { /* ignore */ }
    }
  }
}

// expose for script.js
window.CadybaraEngine = CadybaraEngine;