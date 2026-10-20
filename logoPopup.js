// logoPopup.js — click logo → show a "about" popup with smooth close animation

(function () {
  const CLOSE_MS = 160; // must match the close animation duration in style.css

  function init() {
    const logo = document.querySelector('.pane-header .logo');
    if (!logo) return;

    // build the popup DOM once
    const backdrop = document.createElement('div');
    backdrop.className = 'logo-popup-backdrop';
    backdrop.innerHTML = `
      <div class="logo-popup">
        <button class="logo-popup-close" aria-label="close">
          <p>x</p>
        </button>
        <div class="logo-popup-body">
          <img src="icon-transparent.png" alt="" class="logo-popup-icon" />
          <h2>cadybara</h2>
          <p>a tiny live pseudo‑CAD</p>
          <p class="logo-popup-hint">Made by mkrm0000 and obviously deepseek</p>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    const popup = backdrop.querySelector('.logo-popup');
    const closeBtn = backdrop.querySelector('.logo-popup-close');

    let closeTimer = null;
    let isClosing = false;

    function open() {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      isClosing = false;
      backdrop.classList.remove('closing');
      backdrop.classList.add('open');
    }

    function close() {
      if (isClosing || !backdrop.classList.contains('open')) return;
      isClosing = true;
      backdrop.classList.remove('open');
      backdrop.classList.add('closing');

      // safety net: hide after animation should have finished
      closeTimer = setTimeout(() => {
        backdrop.classList.remove('closing');
        isClosing = false;
        closeTimer = null;
      }, CLOSE_MS);

      // end early the moment the popup's reverse animation fires
      popup.addEventListener('animationend', function onEnd(e) {
        if (e.animationName === 'logo-pop-out') {
          popup.removeEventListener('animationend', onEnd);
          if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
          backdrop.classList.remove('closing');
          isClosing = false;
        }
      });
    }

    logo.style.cursor = 'pointer';
    logo.addEventListener('click', (e) => {
      e.stopPropagation();
      open();
    });

    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && backdrop.classList.contains('open')) close();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();