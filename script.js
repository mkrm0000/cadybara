// script.js – UI logic, live update, help modal, intellisense

(function () {
  const canvas = document.getElementById('cadCanvas');
  const editor = document.getElementById('codeEditor');
  const statusMsg = document.getElementById('statusMsg');
  const resetBtn = document.getElementById('resetBtn');
  const runBtn = document.getElementById('runBtn');
  const helpBtn = document.getElementById('helpBtn');
  const helpModal = document.getElementById('helpModal');
  const closeHelpBtn = document.getElementById('closeHelpBtn');
  const closeHelpBtn2 = document.getElementById('closeHelpBtn2');
  const helpBody = document.getElementById('helpBody');
  const intellisense = document.getElementById('intellisense');

  const engine = new CadybaraEngine(canvas);

  // ---- default example ----
  const DEFAULT_CODE = `// cadybara · live pseudo‑CAD
// try editing — everything updates instantly

color #6c9eff
line 100 100 400 100
line 400 100 400 400
line 400 400 100 400
line 100 400 100 100

color #e06c6c
circle 250 250 80
arc 250 250 120 0 180

color #6fbf6f
rect 150 150 200 200

color #d4a04a
circle 250 250 40

grid on
`;

  // ---- syntax data (loaded from syn.json) ----
  let SYNTAX = { commands: [] };
  let syntaxLoaded = false;

  async function loadSyntax() {
    try {
      const res = await fetch('syn.json');
      if (!res.ok) throw new Error('http ' + res.status);
      SYNTAX = await res.json();
      syntaxLoaded = true;
    } catch (e) {
      // fallback minimal syntax so intellisense/help still works without server
      SYNTAX = {
        commands: [
          { name: 'line', signature: 'line x1 y1 x2 y2', args: ['x1','y1','x2','y2'], description: 'Draw a line.', example: 'line 100 100 400 400' },
          { name: 'circle', signature: 'circle cx cy r', args: ['cx','cy','r'], description: 'Draw a circle.', example: 'circle 250 250 80' },
          { name: 'rect', signature: 'rect x y w h', args: ['x','y','w','h'], description: 'Draw a rectangle.', example: 'rect 150 150 200 200' },
          { name: 'arc', signature: 'arc cx cy r startDeg endDeg', args: ['cx','cy','r','startDeg','endDeg'], description: 'Draw an arc.', example: 'arc 250 250 120 0 180' },
          { name: 'color', signature: 'color #hex', args: ['#hex'], description: 'Set stroke color.', example: 'color #6c9eff' },
          { name: 'clear', signature: 'clear', args: [], description: 'Clear canvas.', example: 'clear' },
          { name: 'grid', signature: 'grid on|off', args: ['on|off'], description: 'Toggle grid.', example: 'grid on' }
        ]
      };
      syntaxLoaded = true;
      console.warn('syn.json not loaded, using fallback syntax.', e);
    }
  }

  // ---- live rendering with debounce ----
  let debounceTimer = null;

  function updateFromEditor() {
    const code = editor.value;
    const error = engine.execute(code);

    if (error) {
      statusMsg.textContent = '⚠ ' + error;
      statusMsg.className = 'error';
    } else {
      statusMsg.textContent = '✓ rendered ' + engine.commands.length + ' command(s)';
      statusMsg.className = 'ok';
    }
  }

  function debouncedUpdate() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(updateFromEditor, 120);
  }

  // ---- init ----
  async function init() {
    await loadSyntax();
    resetToDefault();
    bindEvents();
  }

  function resetToDefault() {
    editor.value = DEFAULT_CODE;
    updateFromEditor();
  }

  // ---- help modal ----
  function renderHelp() {
    if (!SYNTAX.commands.length) {
      helpBody.innerHTML = '<p style="color:#e06c6c">no syntax data available.</p>';
      return;
    }

    let html = '<h3>commands</h3>';
    html += '<table class="syn-table">';
    for (const cmd of SYNTAX.commands) {
      html += '<tr>';
      html += `<td class="cmd-name">${escapeHtml(cmd.name)}</td>`;
      html += '<td>';
      html += `<div class="sig">${escapeHtml(cmd.signature || cmd.name)}</div>`;
      if (cmd.description) {
        html += `<div class="desc">${escapeHtml(cmd.description)}</div>`;
      }
      if (cmd.example) {
        html += `<div class="example">→ ${escapeHtml(cmd.example)}</div>`;
      }
      html += '</td>';
      html += '</tr>';
    }
    html += '</table>';

    html += '<h3>general</h3>';
    html += '<table class="syn-table">';
    html += '<tr><td class="cmd-name">//</td><td><div class="desc">line comment — anything after <code>//</code> is ignored.</div></td></tr>';
    html += '<tr><td class="cmd-name">#</td><td><div class="desc">alternative comment marker (at start of line).</div></td></tr>';
    html += '<tr><td class="cmd-name">tab</td><td><div class="desc">inserts two spaces.</div></td></tr>';
    html += '<tr><td class="cmd-name">ctrl+enter</td><td><div class="desc">force re‑render immediately.</div></td></tr>';
    html += '</table>';

    helpBody.innerHTML = html;
  }

  function openHelp() {
    renderHelp();
    helpModal.classList.add('open');
  }

  function closeHelp() {
    helpModal.classList.remove('open');
  }

  // ---- intellisense ----
  let intelliState = {
    visible: false,
    items: [],
    activeIndex: 0,
    startPos: 0,   // char index where current word starts
    endPos: 0,     // char index where cursor is
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function getCurrentWord() {
    const pos = editor.selectionStart;
    const text = editor.value;
    let start = pos;
    while (start > 0 && /[a-zA-Z]/.test(text[start - 1])) start--;
    const word = text.slice(start, pos);
    return { word, start, end: pos };
  }

  function positionIntellisense() {
    // approximate caret position using a mirror div technique
    const text = editor.value.slice(0, editor.selectionStart);
    const lines = text.split('\n');
    const currentLine = lines.length - 1;
    const lineText = lines[currentLine] || '';

    const style = window.getComputedStyle(editor);
    const lineHeight = parseFloat(style.lineHeight) || 22;
    const paddingTop = parseFloat(style.paddingTop) || 20;
    const paddingLeft = parseFloat(style.paddingLeft) || 20;

    // measure text width using a hidden canvas
    const canvasMeasure = positionIntellisense._canvas || (positionIntellisense._canvas = document.createElement('canvas'));
    const mctx = canvasMeasure.getContext('2d');
    mctx.font = `${style.fontSize} ${style.fontFamily}`;
    const textWidth = mctx.measureText(lineText).width;

    const editorRect = editor.getBoundingClientRect();
    const wrapRect = editor.parentElement.getBoundingClientRect();

    let left = editorRect.left - wrapRect.left + paddingLeft + textWidth;
    let top = editorRect.top - wrapRect.top + paddingTop + currentLine * lineHeight + lineHeight;

    // clamp
    const maxLeft = wrapRect.width - 280;
    if (left > maxLeft) left = maxLeft;
    if (left < 8) left = 8;
    if (top < 8) top = 8;

    intellisense.style.left = left + 'px';
    intellisense.style.top = top + 'px';
  }

  function showIntellisense(matches, activeIndex) {
    if (!matches.length) {
      hideIntellisense();
      return;
    }

    intellisense.innerHTML = matches.map((m, i) => {
      const active = i === activeIndex ? ' active' : '';
      const sig = m.signature || m.name;
      return `<div class="item${active}" data-index="${i}">
        <span class="cmd">${escapeHtml(m.name)}</span>
        <span class="sig">${escapeHtml(sig)}</span>
      </div>`;
    }).join('');

    intellisense.style.display = 'block';
    intelliState.visible = true;
    intelliState.items = matches;
    intelliState.activeIndex = activeIndex;

    positionIntellisense();

    // bind clicks
    intellisense.querySelectorAll('.item').forEach(el => {
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const idx = Number(el.dataset.index);
        acceptIntellisense(idx);
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
    const before = editor.value.slice(0, start);
    const after = editor.value.slice(end);
    const insertion = item.name + ' ';
    editor.value = before + insertion + after;

    const newPos = start + insertion.length;
    editor.selectionStart = editor.selectionEnd = newPos;

    hideIntellisense();
    debouncedUpdate();
    editor.focus();
  }

  function updateIntellisense() {
    if (!syntaxLoaded) return;

    const { word, start, end } = getCurrentWord();

    if (!word) {
      hideIntellisense();
      return;
    }

    const lower = word.toLowerCase();
    const matches = SYNTAX.commands.filter(c =>
      c.name.toLowerCase().startsWith(lower)
    );

    if (!matches.length) {
      hideIntellisense();
      return;
    }

    // if exactly one match and the word is already complete, hide
    if (matches.length === 1 && matches[0].name.toLowerCase() === lower) {
      hideIntellisense();
      return;
    }

    intelliState.start = start;
    intelliState.end = end;

    let activeIndex = intelliState.activeIndex;
    if (activeIndex >= matches.length) activeIndex = 0;

    showIntellisense(matches, activeIndex);
  }

  function moveIntellisense(delta) {
    if (!intelliState.visible) return;
    const len = intelliState.items.length;
    if (!len) return;
    intelliState.activeIndex = (intelliState.activeIndex + delta + len) % len;
    // re-render active highlight without rebuilding whole list
    intellisense.querySelectorAll('.item').forEach((el, i) => {
      el.classList.toggle('active', i === intelliState.activeIndex);
    });
  }

  // ---- event bindings ----
  function bindEvents() {
    editor.addEventListener('input', () => {
      debouncedUpdate();
      updateIntellisense();
    });

    editor.addEventListener('keydown', (e) => {
      // intellisense navigation
      if (intelliState.visible) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          moveIntellisense(1);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          moveIntellisense(-1);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          acceptIntellisense(intelliState.activeIndex);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          hideIntellisense();
          return;
        }
      }

      // ctrl+enter force render
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (debounceTimer) clearTimeout(debounceTimer);
        updateFromEditor();
        hideIntellisense();
      }

      // tab inserts two spaces
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = editor.selectionStart;
        const en = editor.selectionEnd;
        editor.value = editor.value.substring(0, s) + '  ' + editor.value.substring(en);
        editor.selectionStart = editor.selectionEnd = s + 2;
        debouncedUpdate();
        updateIntellisense();
      }
    });

    // hide intellisense on blur / click elsewhere
    editor.addEventListener('blur', () => {
      setTimeout(hideIntellisense, 120);
    });

    editor.addEventListener('click', () => {
      updateIntellisense();
    });

    editor.addEventListener('scroll', () => {
      if (intelliState.visible) positionIntellisense();
    });

    // buttons
    runBtn.addEventListener('click', () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      updateFromEditor();
      hideIntellisense();
    });

    resetBtn.addEventListener('click', () => {
      resetToDefault();
      hideIntellisense();
    });

    helpBtn.addEventListener('click', openHelp);
    closeHelpBtn.addEventListener('click', closeHelp);
    closeHelpBtn2.addEventListener('click', closeHelp);

    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) closeHelp();
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && helpModal.classList.contains('open')) {
        closeHelp();
      }
    });
  }

  // expose engine for debugging
  window.__engine = engine;

  // go!
  init();
})();