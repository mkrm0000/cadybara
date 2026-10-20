// script.js — UI glue: live render, pan/zoom, intellisense, help, export, persist

(function () {
  const canvas = document.getElementById('cadCanvas');
  const container = document.getElementById('canvasContainer');
  const editor = document.getElementById('codeEditor');
  const statusMsg = document.getElementById('statusMsg');
  const statusRight = document.getElementById('statusRight');
  const viewBadge = document.getElementById('viewBadge');
  const intellisense = document.getElementById('intellisense');
  const helpModal = document.getElementById('helpModal');
  const helpBody = document.getElementById('helpBody');

  const engine = new CadybaraEngine(canvas);

  const DEFAULT_CODE = `// cadybara · live pseudo-CAD
// named colors use the PICO-8 palette

let s = 60
let w = 200

color blue
rect 100 100 w w

color red
circle 200 200 s
arc 200 200 (s * 1.5) 0 180

color green
polyline 100 100 150 50 250 50 300 100

layer details color yellow
circle 200 200 20
circle 200 200 8

// angles are degrees
let a = 45
line 200 200 (200 + 100 * cos(a)) (200 + 100 * sin(a))

grid on
`;

  // ---------- syntax data ----------
  let SYNTAX = { commands: [] };
  let syntaxLoaded = false;

  async function loadSyntax() {
    try {
      const res = await fetch('syn.json');
      if (!res.ok) throw new Error('http ' + res.status);
      SYNTAX = await res.json();
    } catch (e) {
      SYNTAX = {
        commands: [
          { name: 'line', signature: 'line x1 y1 x2 y2', description: 'Draw a line.', example: 'line 100 100 400 400' },
          { name: 'circle', signature: 'circle cx cy r', description: 'Draw a circle.', example: 'circle 200 200 80' },
          { name: 'rect', signature: 'rect x y w h', description: 'Draw a rectangle.', example: 'rect 150 150 200 200' },
          { name: 'arc', signature: 'arc cx cy r startDeg endDeg', description: 'Draw an arc (angles in degrees).', example: 'arc 200 200 100 0 180' },
          { name: 'polyline', signature: 'polyline x1 y1 x2 y2 ...', description: 'Connected line segments.', example: 'polyline 100 100 200 50 300 100' },
          { name: 'text', signature: 'text x y "content" [size]', description: 'Render a label.', example: 'text 100 100 "hello" 20' },
          { name: 'color', signature: 'color name', description: 'Set stroke color. Named colors use the PICO-8 palette. For hex, use a quoted string: color "#ff0000".', example: 'color blue' },
          { name: 'layer', signature: 'layer name [color name]', description: 'Start a new layer.', example: 'layer walls color darkblue' },
          { name: 'hide', signature: 'hide name', description: 'Hide a layer.', example: 'hide walls' },
          { name: 'show', signature: 'show name', description: 'Show a layer.', example: 'show walls' },
          { name: 'group', signature: 'group name', description: 'Start a group.', example: 'group box1' },
          { name: 'endgroup', signature: 'endgroup', description: 'End current group.', example: 'endgroup' },
          { name: 'let', signature: 'let name = expr', description: 'Bind a variable.', example: 'let w = 200' },
          { name: 'grid', signature: 'grid on|off', description: 'Toggle grid.', example: 'grid on' },
          { name: 'clear', signature: 'clear', description: 'Clear shapes.', example: 'clear' }
        ]
      };
    }
    syntaxLoaded = true;
  }

  // ---------- auto render ----------
  let autoRender = true;
  let debounceTimer = null;

  function setAutoRender(on) {
    autoRender = on;
    const b = document.getElementById('autoRenderBtn');
    b.classList.toggle('toggle-off', !on);
    b.textContent = on ? '🟢 auto' : '🔴 auto';
    b.title = on ? 'auto-render is ON — click to freeze' : 'auto-render is OFF — click to resume';
    if (on) {
      if (debounceTimer) clearTimeout(debounceTimer);
      updateFromEditor();
    }
  }

  function updateFromEditor() {
    const err = engine.execute(editor.value);
    if (err) {
      statusMsg.textContent = '⚠ ' + err;
      statusMsg.className = 'error';
    } else {
      statusMsg.textContent = '✓ ' + engine.shapes.length + ' shape(s)';
      statusMsg.className = 'ok';
    }
    updateStatusRight();
    updateViewBadge();
    scheduleSave();
  }

  function debouncedUpdate() {
    if (!autoRender) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updateFromEditor, 120);
  }

  function updateStatusRight() {
    statusRight.textContent = 'zoom ' + Math.round(engine.view.zoom * 100) + '% · ' + engine.shapes.length + ' shapes';
  }

  function updateViewBadge() {
    viewBadge.textContent = Math.round(engine.view.zoom * 100) + '%';
  }

  // ---------- persist ----------
  let saveTimer = null;
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      CadybaraStorage.save({
        code: editor.value,
        view: { ...engine.view },
        autoRender,
      });
    }, 400);
  }

  function tryRestore() {
    const saved = CadybaraStorage.load();
    if (saved && typeof saved.code === 'string') {
      editor.value = saved.code;
      if (saved.view) engine.view = { ...saved.view };
      if (typeof saved.autoRender === 'boolean') setAutoRender(saved.autoRender);
      return true;
    }
    return false;
  }

  // ---------- help modal ----------
  function renderHelp() {
    if (!SYNTAX.commands.length) {
      helpBody.innerHTML = '<p style="color:#e06c6c">no syntax data.</p>';
      return;
    }
    let html = '<h3>commands</h3><table class="syn-table">';
    for (const cmd of SYNTAX.commands) {
      html += '<tr>';
      html += `<td class="cmd-name">${esc(cmd.name)}</td><td>`;
      html += `<div class="sig">${esc(cmd.signature || cmd.name)}</div>`;
      if (cmd.description) html += `<div class="desc">${esc(cmd.description)}</div>`;
      if (cmd.example) html += `<div class="example">→ ${esc(cmd.example)}</div>`;
      html += '</td></tr>';
    }
    html += '</table>';

    // palette swatches
    if (window.PICO8) {
      html += '<h3>pico-8 palette</h3><table class="syn-table">';
      for (const [name, hex] of Object.entries(window.PICO8)) {
        html += `<tr>
          <td class="cmd-name">${esc(name)}</td>
          <td><span style="display:inline-block;width:14px;height:14px;background:${hex};border-radius:3px;vertical-align:middle;margin-right:8px;border:1px solid #3a3b40"></span>
          <code style="color:#8a8a8a">${hex}</code></td>
        </tr>`;
      }
      html += '</table>';
    }

    html += `<h3>expressions</h3><table class="syn-table">
      <tr><td class="cmd-name">+ - * / % ^</td><td><div class="desc">arithmetic operators.</div></td></tr>
      <tr><td class="cmd-name">pi tau e</td><td><div class="desc">built-in constants.</div></td></tr>
      <tr><td class="cmd-name">sin cos tan</td><td><div class="desc">trig — angles in <b>degrees</b>.</div></td></tr>
      <tr><td class="cmd-name">sqrt abs min max floor ceil round pow</td><td><div class="desc">math functions.</div></td></tr>
      <tr><td class="cmd-name">let</td><td><div class="desc">bind a variable: <code>let w = 200</code></div></td></tr>
      </table>
      <h3>viewport</h3><table class="syn-table">
      <tr><td class="cmd-name">drag</td><td><div class="desc">pan the canvas.</div></td></tr>
      <tr><td class="cmd-name">wheel</td><td><div class="desc">zoom in/out at cursor.</div></td></tr>
      <tr><td class="cmd-name">Ctrl+0</td><td><div class="desc">reset view.</div></td></tr>
      <tr><td class="cmd-name">Ctrl+Enter</td><td><div class="desc">force render (works when frozen).</div></td></tr>
      </table>`;
    helpBody.innerHTML = html;
  }

  // ---------- intellisense ----------
  const intelliState = { visible: false, items: [], activeIndex: 0, start: 0, end: 0 };
  let measureCanvas = document.createElement('canvas');

  function getCurrentWord() {
    const pos = editor.selectionStart;
    const text = editor.value;
    let start = pos;
    while (start > 0 && /[a-zA-Z]/.test(text[start - 1])) start--;
    return { word: text.slice(start, pos), start, end: pos };
  }

  function positionIntellisense() {
    const text = editor.value.slice(0, editor.selectionStart);
    const lines = text.split('\n');
    const currentLine = lines.length - 1;
    const lineText = lines[currentLine] || '';
    const style = window.getComputedStyle(editor);
    const lineHeight = parseFloat(style.lineHeight) || 22;
    const padTop = parseFloat(style.paddingTop) || 16;
    const padLeft = parseFloat(style.paddingLeft) || 18;

    const mctx = measureCanvas.getContext('2d');
    mctx.font = `${style.fontSize} ${style.fontFamily}`;
    const textWidth = mctx.measureText(lineText).width;

    const editorRect = editor.getBoundingClientRect();
    const wrapRect = editor.parentElement.getBoundingClientRect();

    let left = editorRect.left - wrapRect.left + padLeft + textWidth;
    let top = editorRect.top - wrapRect.top + padTop + currentLine * lineHeight + lineHeight;

    const maxLeft = wrapRect.width - 280;
    if (left > maxLeft) left = maxLeft;
    if (left < 8) left = 8;
    if (top < 8) top = 8;

    intellisense.style.left = left + 'px';
    intellisense.style.top = top + 'px';
  }

  function showIntellisense(items, activeIndex) {
    if (!items.length) { hideIntellisense(); return; }
    intellisense.innerHTML = items.map((m, i) => {
      const active = i === activeIndex ? ' active' : '';
      return `<div class="item${active}" data-index="${i}">
        <span class="cmd">${esc(m.name)}</span>
        <span class="sig">${esc(m.signature || m.name)}</span>
      </div>`;
    }).join('');
    intellisense.style.display = 'block';
    intelliState.visible = true;
    intelliState.items = items;
    intelliState.activeIndex = activeIndex;
    positionIntellisense();
    intellisense.querySelectorAll('.item').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        acceptIntellisense(Number(el.dataset.index));
      });
    });
  }

  function hideIntellisense() {
    intellisense.style.display = 'none';
    intelliState.visible = false;
    intelliState.items = [];
    intelliState.activeIndex = 0;
  }

  function acceptIntellisense(index) {
    const item = intelliState.items[index];
    if (!item) return;
    const { start, end } = intelliState;
    const insertion = item.name + ' ';
    editor.value = editor.value.slice(0, start) + insertion + editor.value.slice(end);
    const newPos = start + insertion.length;
    editor.selectionStart = editor.selectionEnd = newPos;
    hideIntellisense();
    debouncedUpdate();
    editor.focus();
  }

  function updateIntellisense() {
    if (!syntaxLoaded) return;
    const { word, start, end } = getCurrentWord();
    if (!word) { hideIntellisense(); return; }
    const lower = word.toLowerCase();
    const matches = SYNTAX.commands.filter(c => c.name.toLowerCase().startsWith(lower));
    if (!matches.length) { hideIntellisense(); return; }
    if (matches.length === 1 && matches[0].name.toLowerCase() === lower) { hideIntellisense(); return; }
    intelliState.start = start;
    intelliState.end = end;
    if (intelliState.activeIndex >= matches.length) intelliState.activeIndex = 0;
    showIntellisense(matches, intelliState.activeIndex);
  }

  function moveIntellisense(delta) {
    if (!intelliState.visible) return;
    const len = intelliState.items.length;
    if (!len) return;
    intelliState.activeIndex = (intelliState.activeIndex + delta + len) % len;
    intellisense.querySelectorAll('.item').forEach((el, i) => {
      el.classList.toggle('active', i === intelliState.activeIndex);
    });
  }

  // ---------- pan/zoom ----------
  let panning = false, panStart = { x: 0, y: 0, panX: 0, panY: 0 };

  function bindViewport() {
    canvas.addEventListener('mousedown', e => {
      panning = true;
      canvas.classList.add('panning');
      panStart = { x: e.offsetX, y: e.offsetY, panX: engine.view.panX, panY: engine.view.panY };
    });
    window.addEventListener('mousemove', e => {
      if (!panning) return;
      const rect = canvas.getBoundingClientRect();
      const dx = (e.clientX - rect.left) - panStart.x;
      const dy = (e.clientY - rect.top) - panStart.y;
      engine.view.panX = panStart.panX + dx;
      engine.view.panY = panStart.panY + dy;
      engine.redraw();
      updateViewBadge();
      updateStatusRight();
      scheduleSave();
    });
    window.addEventListener('mouseup', () => {
      panning = false;
      canvas.classList.remove('panning');
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      engine.zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
      updateViewBadge();
      updateStatusRight();
      scheduleSave();
    }, { passive: false });
  }

  // ---------- resize canvas to fit container (keeps 800x800 backing) ----------
  function sizeCanvas() {
    const rect = container.getBoundingClientRect();
    const size = Math.min(rect.width, rect.height) - 24;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
  }

  // ---------- init ----------
  async function init() {
    await loadSyntax();
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);

    const restored = tryRestore();
    if (!restored) {
      editor.value = DEFAULT_CODE;
      setAutoRender(true);
    }

    updateFromEditor();
    updateViewBadge();
    bindEvents();
    bindViewport();
  }

  function bindEvents() {
    const helpBtn = document.getElementById('helpBtn');
    const closeHelpBtn = document.getElementById('closeHelpBtn');
    const closeHelpBtn2 = document.getElementById('closeHelpBtn2');
    const resetBtn = document.getElementById('resetBtn');
    const autoRenderBtn = document.getElementById('autoRenderBtn');
    const exportSvgBtn = document.getElementById('exportSvgBtn');
    const exportPngBtn = document.getElementById('exportPngBtn');
    const fitBtn = document.getElementById('fitBtn');

    editor.addEventListener('input', () => {
      debouncedUpdate();
      updateIntellisense();
    });

    editor.addEventListener('keydown', e => {
      if (intelliState.visible) {
        if (e.key === 'ArrowDown') { e.preventDefault(); moveIntellisense(1); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); moveIntellisense(-1); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); acceptIntellisense(intelliState.activeIndex); return; }
        if (e.key === 'Escape') { e.preventDefault(); hideIntellisense(); return; }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (debounceTimer) clearTimeout(debounceTimer);
        updateFromEditor();
        hideIntellisense();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        engine.resetView();
        updateViewBadge(); updateStatusRight();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = editor.selectionStart, en = editor.selectionEnd;
        editor.value = editor.value.slice(0, s) + '  ' + editor.value.slice(en);
        editor.selectionStart = editor.selectionEnd = s + 2;
        debouncedUpdate();
        updateIntellisense();
      }
    });

    editor.addEventListener('blur', () => setTimeout(hideIntellisense, 120));
    editor.addEventListener('click', updateIntellisense);
    editor.addEventListener('scroll', () => { if (intelliState.visible) positionIntellisense(); });

    autoRenderBtn.addEventListener('click', () => setAutoRender(!autoRender));
    resetBtn.addEventListener('click', () => {
      CadybaraStorage.clear();
      editor.value = DEFAULT_CODE;
      engine.resetView();
      setAutoRender(true);
      updateFromEditor();
    });
    helpBtn.addEventListener('click', () => { renderHelp(); helpModal.classList.add('open'); });
    closeHelpBtn.addEventListener('click', () => helpModal.classList.remove('open'));
    closeHelpBtn2.addEventListener('click', () => helpModal.classList.remove('open'));
    helpModal.addEventListener('click', e => { if (e.target === helpModal) helpModal.classList.remove('open'); });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && helpModal.classList.contains('open')) helpModal.classList.remove('open');
    });

    exportSvgBtn.addEventListener('click', () => CadybaraExport.downloadSVG(engine));
    exportPngBtn.addEventListener('click', () => CadybaraExport.downloadPNG(engine));

    fitBtn.addEventListener('click', () => {
      engine.fit();
      updateViewBadge(); updateStatusRight();
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  window.__engine = engine;
  init();
})();