// script.js – UI logic, live update, default example

(function() {
  const canvas = document.getElementById('cadCanvas');
  const editor = document.getElementById('codeEditor');
  const statusMsg = document.getElementById('statusMsg');
  const resetBtn = document.getElementById('resetBtn');
  const runBtn = document.getElementById('runBtn');

  const engine = new CadybaraEngine(canvas);

  // ---- default example pseudo‑code ----
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

  // ---- initialization ----
  function resetToDefault() {
    editor.value = DEFAULT_CODE;
    updateFromEditor();
  }

  // load default
  resetToDefault();

  // ---- event listeners ----
  editor.addEventListener('input', debouncedUpdate);

  // run button forces immediate update
  runBtn.addEventListener('click', () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    updateFromEditor();
  });

  resetBtn.addEventListener('click', resetToDefault);

  // keyboard shortcut: Ctrl+Enter to render
  editor.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (debounceTimer) clearTimeout(debounceTimer);
      updateFromEditor();
    }
    // tab support
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
      editor.selectionStart = editor.selectionEnd = start + 2;
      debouncedUpdate();
    }
  });

  // handle canvas resize (keep internal resolution sharp)
  function resizeCanvas() {
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    // We keep logical size 800x800 for simplicity of pseudo-cad coordinates,
    // but we can stretch the canvas to fill. For simplicity, we'll keep it fixed.
    // Actually we want the drawing to fill the viewport nicely.
    // We'll set canvas display size to fill container, but keep internal 800x800.
    // That's what we have. So no changes needed.
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // expose engine for debugging
  window.__engine = engine;
})();