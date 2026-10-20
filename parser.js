// parser.js — tokenizer, expression parser, statement parser
// Produces an AST that cad.js executes. Errors carry {line, col, message}.

(function () {
  // ----- Tokenizer -----
  function tokenize(src) {
    const tokens = [];
    let i = 0, line = 1, col = 1;
    const isDigit = c => c >= '0' && c <= '9';
    const isAlpha = c => /[a-zA-Z_]/.test(c);

    function push(type, value, l, c) {
      tokens.push({ type, value, line: l, col: c });
    }

    while (i < src.length) {
      const c = src[i];
      if (c === '\n') { line++; col = 1; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r') { i++; col++; continue; }
      if (c === '/' && src[i + 1] === '/') {
        while (i < src.length && src[i] !== '\n') { i++; col++; }
        continue;
      }
      if (c === '#') {
        while (i < src.length && src[i] !== '\n') { i++; col++; }
        continue;
      }
      // numbers
      if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
        const startL = line, startC = col;
        let num = '';
        while (i < src.length && (isDigit(src[i]) || src[i] === '.')) {
          num += src[i]; i++; col++;
        }
        push('number', parseFloat(num), startL, startC);
        continue;
      }
      // identifiers / keywords
      if (isAlpha(c)) {
        const startL = line, startC = col;
        let id = '';
        while (i < src.length && /[a-zA-Z0-9_]/.test(src[i])) {
          id += src[i]; i++; col++;
        }
        push('ident', id, startL, startC);
        continue;
      }
      // strings (for text "hello")
      if (c === '"') {
        const startL = line, startC = col;
        i++; col++;
        let str = '';
        while (i < src.length && src[i] !== '"') {
          if (src[i] === '\\' && i + 1 < src.length) {
            str += src[i + 1]; i += 2; col += 2;
          } else {
            str += src[i]; i++; col++;
          }
        }
        if (i >= src.length) {
          throw { line: startL, col: startC, message: 'unterminated string' };
        }
        i++; col++;
        push('string', str, startL, startC);
        continue;
      }
      // operators & punctuation
      const twoChar = src.slice(i, i + 2);
      if (['==', '!=', '<=', '>='].includes(twoChar)) {
        push('op', twoChar, line, col);
        i += 2; col += 2;
        continue;
      }
      if ('+-*/%^()=,'.includes(c)) {
        push('op', c, line, col);
        i++; col++;
        continue;
      }
      throw { line, col, message: `unexpected character '${c}'` };
    }
    push('eof', null, line, col);
    return tokens;
  }

  // ----- Expression parser (Pratt) -----
  function parseExpr(tokens, state) {
    return parseBinary(tokens, state, 0);
  }

  const BINOP_PREC = {
    '+': 1, '-': 1,
    '*': 2, '/': 2, '%': 2,
    '^': 3,
    '==': 0, '!=': 0, '<=': 0, '>=': 0,
  };

  function parseBinary(tokens, state, minPrec) {
    let left = parseUnary(tokens, state);
    while (true) {
      const t = tokens[state.i];
      if (t.type !== 'op' || !(t.value in BINOP_PREC)) break;
      const prec = BINOP_PREC[t.value];
      if (prec < minPrec) break;
      const op = t.value;
      state.i++;
      const right = parseBinary(tokens, state, op === '^' ? prec : prec + 1);
      left = { type: 'bin', op, left, right, line: t.line, col: t.col };
    }
    return left;
  }

  function parseUnary(tokens, state) {
    const t = tokens[state.i];
    if (t.type === 'op' && (t.value === '-' || t.value === '+')) {
      state.i++;
      const operand = parseUnary(tokens, state);
      return { type: 'unary', op: t.value, operand, line: t.line, col: t.col };
    }
    return parsePrimary(tokens, state);
  }

  function parsePrimary(tokens, state) {
    const t = tokens[state.i];
    if (t.type === 'number') { state.i++; return { type: 'num', value: t.value, line: t.line, col: t.col }; }
    if (t.type === 'string') { state.i++; return { type: 'str', value: t.value, line: t.line, col: t.col }; }
    if (t.type === 'ident') {
      state.i++;
      const name = t.value;
      // function call?
      if (tokens[state.i].type === 'op' && tokens[state.i].value === '(') {
        state.i++; // consume (
        const args = [];
        if (!(tokens[state.i].type === 'op' && tokens[state.i].value === ')')) {
          while (true) {
            args.push(parseExpr(tokens, state));
            if (tokens[state.i].type === 'op' && tokens[state.i].value === ',') { state.i++; continue; }
            break;
          }
        }
        if (!(tokens[state.i].type === 'op' && tokens[state.i].value === ')')) {
          throw { line: t.line, col: t.col, message: `expected ')' after ${name}(...)` };
        }
        state.i++;
        return { type: 'call', name, args, line: t.line, col: t.col };
      }
      // variable
      return { type: 'var', name, line: t.line, col: t.col };
    }
    if (t.type === 'op' && t.value === '(') {
      state.i++;
      const e = parseExpr(tokens, state);
      if (!(tokens[state.i].type === 'op' && tokens[state.i].value === ')')) {
        throw { line: t.line, col: t.col, message: `expected ')'` };
      }
      state.i++;
      return e;
    }
    throw { line: t.line, col: t.col, message: `unexpected token '${t.value ?? t.type}'` };
  }

  // ----- Statement parser -----
  function parseProgram(src) {
    const tokens = tokenize(src);
    const state = { i: 0 };
    const stmts = [];

    while (tokens[state.i].type !== 'eof') {
      const t = tokens[state.i];

      // skip blank statements
      if (t.type === 'eof') break;

      if (t.type === 'ident') {
        const kw = t.value.toLowerCase();

        // let
        if (kw === 'let') {
          state.i++;
          const nameTok = tokens[state.i];
          if (nameTok.type !== 'ident') {
            throw { line: t.line, col: t.col, message: "expected variable name after 'let'" };
          }
          state.i++;
          if (!(tokens[state.i].type === 'op' && tokens[state.i].value === '=')) {
            throw { line: t.line, col: t.col, message: "expected '=' after variable name" };
          }
          state.i++;
          const expr = parseExpr(tokens, state);
          stmts.push({ type: 'let', name: nameTok.value, expr, line: t.line, col: t.col });
          continue;
        }

        // layer / group / endgroup
        if (kw === 'layer') {
          state.i++;
          const nameTok = tokens[state.i];
          if (nameTok.type !== 'ident') {
            throw { line: t.line, col: t.col, message: "expected layer name" };
          }
          state.i++;
          // optional color
          let color = null;
          if (tokens[state.i].type === 'ident' && tokens[state.i].value.toLowerCase() === 'color') {
            state.i++;
            const cTok = tokens[state.i];
            if (cTok.type !== 'string' && cTok.type !== 'ident') {
              throw { line: t.line, col: t.col, message: "expected color name or string" };
            }
            color = cTok.value;
            state.i++;
          }
          stmts.push({ type: 'layer', name: nameTok.value, color, line: t.line, col: t.col });
          continue;
        }

        if (kw === 'group') {
          state.i++;
          const nameTok = tokens[state.i];
          const name = nameTok.type === 'ident' ? nameTok.value : 'group';
          if (nameTok.type === 'ident') state.i++;
          stmts.push({ type: 'group', name, line: t.line, col: t.col });
          continue;
        }

        if (kw === 'endgroup') {
          state.i++;
          stmts.push({ type: 'endgroup', line: t.line, col: t.col });
          continue;
        }

        // hide / show layer
        if (kw === 'hide' || kw === 'show') {
          state.i++;
          const nameTok = tokens[state.i];
          if (nameTok.type !== 'ident') {
            throw { line: t.line, col: t.col, message: `expected layer name after '${kw}'` };
          }
          state.i++;
          stmts.push({ type: kw, name: nameTok.value, line: t.line, col: t.col });
          continue;
        }

        // grid on/off
        if (kw === 'grid') {
          state.i++;
          const argTok = tokens[state.i];
          if (argTok.type !== 'ident') {
            throw { line: t.line, col: t.col, message: "expected 'on' or 'off'" };
          }
          state.i++;
          stmts.push({ type: 'grid', value: argTok.value.toLowerCase(), line: t.line, col: t.col });
          continue;
        }

        // clear
        if (kw === 'clear') {
          state.i++;
          stmts.push({ type: 'clear', line: t.line, col: t.col });
          continue;
        }

        // color
        if (kw === 'color') {
          state.i++;
          const cTok = tokens[state.i];
          if (cTok.type !== 'string' && cTok.type !== 'ident' && cTok.type !== 'number') {
            throw { line: t.line, col: t.col, message: "expected color (e.g. #ff0000)" };
          }
          state.i++;
          stmts.push({ type: 'color', value: cTok.value, line: t.line, col: t.col });
          continue;
        }

        // text
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
          // optional size: if next token is number, parse it
          if (tokens[state.i].type === 'number') {
            size = parseExpr(tokens, state);
          }
          stmts.push({ type: 'text', x, y, content: contentTok.value, size, line: t.line, col: t.col });
          continue;
        }

        // primitive: name followed by expressions
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
      }

      // fallback: error
      throw { line: t.line, col: t.col, message: `unexpected token '${t.value ?? t.type}'` };
    }
    return stmts;
  }

  function isStatementStart(word) {
    const kw = word.toLowerCase();
    return ['let', 'layer', 'group', 'endgroup', 'hide', 'show', 'grid', 'clear',
            'color', 'text', 'line', 'circle', 'rect', 'arc', 'polyline', 'fillcircle'].includes(kw);
  }

  // ----- Evaluator -----
  const FUNCS = {
    sin: x => Math.sin(x * Math.PI / 180),  // degrees
    cos: x => Math.cos(x * Math.PI / 180),
    tan: x => Math.tan(x * Math.PI / 180),
    asin: x => Math.asin(x) * 180 / Math.PI,
    acos: x => Math.acos(x) * 180 / Math.PI,
    atan: x => Math.atan(x) * 180 / Math.PI,
    sqrt: Math.sqrt,
    abs: Math.abs,
    min: Math.min,
    max: Math.max,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    pow: Math.pow,
    deg: x => x,
    rad: x => x * 180 / Math.PI,
  };

  const CONSTS = { pi: Math.PI, tau: Math.PI * 2, e: Math.E };

  function evalExpr(node, vars) {
    switch (node.type) {
      case 'num': return node.value;
      case 'str': return node.value;
      case 'var': {
        const k = node.name.toLowerCase();
        if (k in vars) return vars[k];
        if (k in CONSTS) return CONSTS[k];
        if (k in FUNCS) return FUNCS[k];
        throw { line: node.line, col: node.col, message: `unknown variable '${node.name}'` };
      }
      case 'unary': {
        const v = evalExpr(node.operand, vars);
        return node.op === '-' ? -v : v;
      }
      case 'bin': {
        const a = evalExpr(node.left, vars);
        const b = evalExpr(node.right, vars);
        switch (node.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return b === 0 ? 0 : a / b;
          case '%': return b === 0 ? 0 : a % b;
          case '^': return Math.pow(a, b);
          case '==': return a === b ? 1 : 0;
          case '!=': return a !== b ? 1 : 0;
          case '<=': return a <= b ? 1 : 0;
          case '>=': return a >= b ? 1 : 0;
        }
        throw { line: node.line, col: node.col, message: `unknown operator ${node.op}` };
      }
      case 'call': {
        const fn = FUNCS[node.name.toLowerCase()];
        if (!fn) {
          throw { line: node.line, col: node.col, message: `unknown function '${node.name}'` };
        }
        const args = node.args.map(a => evalExpr(a, vars));
        return fn(...args);
      }
    }
    throw { line: 0, col: 0, message: 'internal eval error' };
  }

  window.CadybaraParser = { tokenize, parseProgram, evalExpr, FUNCS, CONSTS, isStatementStart };
})();