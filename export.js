// export.js — SVG & PNG export from the scene graph

(function () {
  function shapeToSvg(s, color) {
    const sw = 2.2;
    switch (s.type) {
      case 'line':
        return `<line x1="${s.args[0]}" y1="${s.args[1]}" x2="${s.args[2]}" y2="${s.args[3]}" stroke="${color}" stroke-width="${sw}" />`;
      case 'circle':
        return `<circle cx="${s.args[0]}" cy="${s.args[1]}" r="${Math.abs(s.args[2])}" fill="none" stroke="${color}" stroke-width="${sw}" />`;
      case 'fillcircle':
        return `<circle cx="${s.args[0]}" cy="${s.args[1]}" r="${Math.abs(s.args[2])}" fill="${color}" />`;
      case 'rect':
        return `<rect x="${s.args[0]}" y="${s.args[1]}" width="${s.args[2]}" height="${s.args[3]}" fill="none" stroke="${color}" stroke-width="${sw}" />`;
      case 'arc': {
        const [cx, cy, r, a1, a2] = s.args;
        const start = polar(cx, cy, r, a1);
        const end = polar(cx, cy, r, a2);
        const large = Math.abs(a2 - a1) > 180 ? 1 : 0;
        const sweep = a2 > a1 ? 1 : 0;
        return `<path d="M ${start.x} ${start.y} A ${Math.abs(r)} ${Math.abs(r)} 0 ${large} ${sweep} ${end.x} ${end.y}" fill="none" stroke="${color}" stroke-width="${sw}" />`;
      }
      case 'polyline': {
        if (s.args.length < 4) return '';
        let d = `M ${s.args[0]} ${s.args[1]}`;
        for (let i = 2; i < s.args.length; i += 2) d += ` L ${s.args[i]} ${s.args[i + 1]}`;
        return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" />`;
      }
      case 'text':
        return `<text x="${s.x}" y="${s.y}" fill="${color}" font-family="Fira Code, monospace" font-size="${s.size}" dominant-baseline="hanging">${escapeXml(s.content)}</text>`;
    }
    return '';
  }

  function polar(cx, cy, r, deg) {
    const a = deg * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  function escapeXml(s) {
    return String(s).replace(/[<>&"']/g, c => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
    }[c]));
  }

  function exportSVG(engine) {
    const shapes = engine.getVisibleShapes();
    const bounds = engine.computeBounds() || { minX: 0, minY: 0, maxX: 800, maxY: 800 };
    const pad = 20;
    const w = bounds.maxX - bounds.minX + pad * 2;
    const h = bounds.maxY - bounds.minY + pad * 2;
    const minX = bounds.minX - pad;
    const minY = bounds.minY - pad;

    let body = '';
    for (const s of shapes) {
      const color = engine.shapeColor(s);
      body += '  ' + shapeToSvg(s, color) + '\n';
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${minX} ${minY} ${w} ${h}">
  <rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="#1a1b1e" />
${body}</svg>`;
  }

  function exportPNG(engine, scale = 2) {
    // render scene into an offscreen canvas at high resolution
    const bounds = engine.computeBounds() || { minX: 0, minY: 0, maxX: 800, maxY: 800 };
    const pad = 20;
    const w = (bounds.maxX - bounds.minX + pad * 2) * scale;
    const h = (bounds.maxY - bounds.minY + pad * 2) * scale;

    const oc = document.createElement('canvas');
    oc.width = w;
    oc.height = h;
    const octx = oc.getContext('2d');

    octx.fillStyle = '#1a1b1e';
    octx.fillRect(0, 0, w, h);

    octx.translate(-(bounds.minX - pad) * scale, -(bounds.minY - pad) * scale);
    octx.scale(scale, scale);

    const shapes = engine.getVisibleShapes();
    for (const s of shapes) {
      const color = engine.shapeColor(s);
      octx.strokeStyle = color;
      octx.fillStyle = color;
      octx.lineWidth = 2.2;
      switch (s.type) {
        case 'line': {
          const [x1, y1, x2, y2] = s.args;
          octx.beginPath(); octx.moveTo(x1, y1); octx.lineTo(x2, y2); octx.stroke();
          break;
        }
        case 'circle': {
          const [cx, cy, r] = s.args;
          octx.beginPath(); octx.arc(cx, cy, Math.abs(r), 0, Math.PI * 2); octx.stroke();
          break;
        }
        case 'fillcircle': {
          const [cx, cy, r] = s.args;
          octx.beginPath(); octx.arc(cx, cy, Math.abs(r), 0, Math.PI * 2); octx.fill();
          break;
        }
        case 'rect': {
          const [x, y, ww, hh] = s.args;
          octx.beginPath(); octx.rect(x, y, ww, hh); octx.stroke();
          break;
        }
        case 'arc': {
          const [cx, cy, r, a1, a2] = s.args;
          octx.beginPath();
          octx.arc(cx, cy, Math.abs(r), a1 * Math.PI / 180, a2 * Math.PI / 180);
          octx.stroke();
          break;
        }
        case 'polyline': {
          if (s.args.length < 4) break;
          octx.beginPath();
          octx.moveTo(s.args[0], s.args[1]);
          for (let i = 2; i < s.args.length; i += 2) octx.lineTo(s.args[i], s.args[i + 1]);
          octx.stroke();
          break;
        }
        case 'text': {
          octx.font = `${s.size}px 'Fira Code', monospace`;
          octx.textBaseline = 'top';
          octx.fillText(s.content, s.x, s.y);
          break;
        }
      }
    }

    return oc.toDataURL('image/png');
  }

  function download(filename, blobUrl) {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function downloadSVG(engine, filename = 'cadybara.svg') {
    const svg = exportSVG(engine);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    download(filename, url);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadPNG(engine, filename = 'cadybara.png') {
    const dataUrl = exportPNG(engine);
    download(filename, dataUrl);
  }

  window.CadybaraExport = { exportSVG, exportPNG, downloadSVG, downloadPNG };
})();