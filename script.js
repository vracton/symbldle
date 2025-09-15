let SYMBOLS_TREE = null;
const LENGTH_RANGE = { minLen: 4, maxLen: 6 };
const MAX_GUESSES = 6;

let TOKEN_POOL = [];
let secret = null;
let currentGuess = [];
let guesses = [];
let feedbacks = [];
let builder = '';
let currentSuggestions = [];
let solved = false;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));


function renderKeyboard() {
  const kb = $('#keyboard');
  kb.innerHTML = '';
  const suggestRow = document.createElement('div');
  suggestRow.className = 'kb-row';
  suggestRow.id = 'suggestRow';
  $('#keyboard').appendChild(suggestRow);
  renderSuggestions();

  const ctrl = document.createElement('div');
  ctrl.className = 'kb-row';
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'key wide';
  backBtn.textContent = '⌫ Back';
  backBtn.addEventListener('click', () => handleKey('Back'));
  const enterBtn = document.createElement('button');
  enterBtn.type = 'button';
  enterBtn.className = 'key wide';
  enterBtn.textContent = 'Enter';
  enterBtn.addEventListener('click', () => handleKey('Enter'));
  ctrl.appendChild(backBtn);
  ctrl.appendChild(enterBtn);
  kb.appendChild(ctrl);
}

function createBoard() {
  const L = secret.tokens.length;
  const board = $('#board');
  board.innerHTML = '';
  board.style.gridTemplateRows = `repeat(${MAX_GUESSES}, 72px)`;
  const rowElts = [];
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.gridTemplateColumns = `repeat(${L}, 110px) 90px`;
    for (let c = 0; c < L; c++) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.dataset.row = String(r);
      tile.dataset.col = String(c);
      row.appendChild(tile);
    }
    const preview = document.createElement('div');
    preview.className = 'tile preview';
    preview.dataset.row = String(r);
    preview.dataset.col = 'preview';
    row.appendChild(preview);
    rowElts.push(row);
    board.appendChild(row);
  }
  return rowElts;
}

function drawRow(r, tokens, states = []) {
  const L = secret.tokens.length;
  for (let c = 0; c < L; c++) {
    const tile = document.querySelector(`.tile[data-row="${r}"][data-col="${c}"]`);
  tile.textContent = tokens[c] || '';
  tile.title = tokens[c] || '';
    tile.classList.toggle('filled', Boolean(tokens[c]));
    tile.classList.remove('green','yellow','gray');
    if (states[c]) tile.classList.add(states[c]);
  }
}

function lockRow(r, tokens, fb) {
  drawRow(r, tokens, fb);
  setRowPreview(r, tokens);
}

function newGame() {
  secret = generateDailySecret(utcToday());
  currentGuess = [];
  guesses = [];
  feedbacks = [];
  const wl = document.getElementById('wordLength');
  if (wl) wl.textContent = String(secret.tokens.length);
  console.info('New secret:', secret.toString(), secret);
  createBoard();
  drawRow(guesses.length, currentGuess);
  renderKeyboard();
  setTimeout(() => document.getElementById('board')?.focus(), 0);
  solved = false;
}

function reveal() {
  const msg = `Secret: ${secret.toString()} — tokens: [${secret.tokens.join(', ')}]`;
  alert(msg);
}

function submitGuess() {
  const guessMods = [...currentGuess];
  if (!guessMods.length) return;
  const need = secret.tokens.length;
  if (guessMods.length !== need) {
  toast(`Guess must have ${need} tokens. You have ${guessMods.length}.`, 'error');
    return;
  }
  const r = guesses.length;
  const fb = feedback(guessMods, secret.tokens);
  lockRow(r, guessMods, fb);
  guesses.push(guessMods);
  feedbacks.push(fb);

  if (fb.every(s => s === 'green')) {
  solved = true;
  toast('You got it!');
  showResultModal(true);
  } else if (guesses.length >= MAX_GUESSES) {
  toast(`Out of guesses. Secret was ${secret.toString()}.`, 'error');
  showResultModal(false);
  } else {
    currentGuess = [];
    builder = '';
    drawRow(guesses.length, currentGuess);
  renderSuggestions();
  setTimeout(() => document.getElementById('board')?.focus(), 0);
  }
}

function handleKey(key) {
  if (solved || guesses.length >= MAX_GUESSES) return;
  const need = secret.tokens.length;
  const isSep = key === '.' || key === ',' || key === ' ';
  if (isModalOpen()) return;
  if (key === 'Enter') {
    if (builder) {
      const nextTok = builder.toLowerCase();
      if (!isValidNextToken(nextTok)) {
        toast(`Invalid Modifier: ${nextTok}`, 'error');
        return;
      }
      currentGuess.push(nextTok);
      builder = '';
    }
    if (currentGuess.length === need) submitGuess();
    else toast(`Need ${need} modifiers; you have ${currentGuess.length}.`, 'error');
    return;
  }
  if (key === 'Tab') {
    if (currentSuggestions.length > 0) {
      const t = currentSuggestions[0];
      if (isValidNextToken(t)) {
        currentGuess.push(t);
        builder = '';
        drawCurrentTyping();
        renderSuggestions();
      }
    }
    return;
  }
  if (key === 'Back' || key === 'Backspace') {
    if (builder.length > 0) builder = builder.slice(0, -1);
    else if (currentGuess.length > 0) currentGuess.pop();
    drawCurrentTyping();
    renderSuggestions();
    return;
  }
  if (isSep) {
    if (builder) {
      const nextTok = builder.toLowerCase();
      if (!isValidNextToken(nextTok)) {
        toast(`Invalid Modifier: ${nextTok}`, 'error');
      } else {
        currentGuess.push(nextTok);
      }
      builder = '';
      if (currentGuess.length > need) currentGuess = currentGuess.slice(0, need);
      drawCurrentTyping();
      renderSuggestions();
    }
    return;
  }
  if (/^[a-zA-Z0-9]$/.test(key)) {
    const need = secret.tokens.length;
    const total = currentGuess.length + (builder ? 1 : 0);
    if (total >= need) return;
    builder += key.toLowerCase();
    drawCurrentTyping();
    renderSuggestions();
  }
}

function drawCurrentTyping() {
  const tokens = [...currentGuess];
  if (builder) tokens.push(builder);
  drawRow(guesses.length, tokens);
}

window.addEventListener('keydown', (e) => {
  const k = e.key;
  if (k === 'Enter' || k === 'Tab' || k === 'Backspace' || /^[a-zA-Z0-9]$/.test(k) || k === '.' || k === ',' || k === ' ') {
    e.preventDefault();
    handleKey(k);
  }
});

window.addEventListener('DOMContentLoaded', () => {
  $('#helpBtn')?.addEventListener('click', openModal);
  document.querySelectorAll('[data-close]:not([data-close="result"])')
    .forEach(el => el.addEventListener('click', closeModal));
  document.querySelectorAll('[data-close="result"]').forEach(el => el.addEventListener('click', closeResultModal));
  document.getElementById('copyScoreBtn')?.addEventListener('click', copyScoreToClipboard);
  document.getElementById('playAgainBtn')?.addEventListener('click', () => { closeResultModal(); newGame(); });
  const todayEl = document.getElementById('today');
  if (todayEl) {
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    todayEl.textContent = new Date().toLocaleDateString(undefined, opts);
  }
  fetch('symbols.json', { cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(data => {
      if (data && typeof data === 'object') {
        SYMBOLS_TREE = data;
        TOKEN_POOL = Object.keys(SYMBOLS_TREE);
        console.info('Loaded symbols tree with', TOKEN_POOL.length, 'top-level tokens');
      } else {
        console.warn('symbols.json not found');
      }
    })
    .catch(() => console.warn('symbols.json not loaded;'))
    .finally(() => {
      newGame();
  openModal();
    });
});

function getTreeNode(path) {
  if (!SYMBOLS_TREE) return null;
  let node = SYMBOLS_TREE;
  for (const t of path) {
    if (!node || !Object.prototype.hasOwnProperty.call(node, t)) return null;
    node = node[t];
  }
  return node;
}

function isValidNextToken(token) {
  if (!SYMBOLS_TREE) return true;
  const node = getTreeNode(currentGuess);
  if (!node) return false;
  return Object.prototype.hasOwnProperty.call(node, token);
}

function renderSuggestions() {
  const row = $('#suggestRow');
  if (!row) return;
  row.innerHTML = '';
  const node = getTreeNode(currentGuess);
  const options = node ? Object.keys(node) : TOKEN_POOL;
  const prefix = builder.toLowerCase();
  const sugg = options
    .filter(t => (prefix ? t.startsWith(prefix) : true))
    .slice(0, 10);
  currentSuggestions = sugg;
  sugg.forEach(t => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'key';
    b.textContent = t;
    b.addEventListener('click', () => {
      if (!isValidNextToken(t)) return;
      currentGuess.push(t);
      builder = '';
      drawCurrentTyping();
      renderSuggestions();
    });
    row.appendChild(b);
  });
}

function randomWordFromTree(tree, lenRange) {
  const minL = lenRange.minLen ?? 4;
  const maxL = lenRange.maxLen ?? 6;
  for (let attempt = 0; attempt < 50; attempt++) {
    const target = Math.floor(Math.random() * (maxL - minL + 1)) + minL;
    const tokens = [];
    let node = tree;
    for (let i = 0; i < target; i++) {
      const keys = Object.keys(node);
      if (keys.length === 0) break;
      const pick = keys[Math.floor(Math.random() * keys.length)];
      tokens.push(pick);
      node = node[pick] || {};
    }
    if (tokens.length >= minL) return new Word(tokens);
  }

  const tokens = [];
  let node = tree;
  while (true) {
    const keys = Object.keys(node);
    if (keys.length === 0) break;
    const pick = keys[Math.floor(Math.random() * keys.length)];
    tokens.push(pick);
    node = node[pick] || {};
    if (tokens.length >= minL) break;
  }
  return new Word(tokens);
}

function setRowPreview(r, tokens) {
  const container = document.querySelector(`.tile.preview[data-row="${r}"]`);
  if (!container) return;
  container.innerHTML = '';
  const img = document.createElement('img');
  img.alt = tokens.join('.');
  img.src = `symbols/${tokens.join('.')}.png`;
  img.style.maxWidth = '86px';
  img.style.maxHeight = '64px';
  img.loading = 'lazy';
  img.onerror = () => { container.textContent = '—'; };
  container.appendChild(img);
}

function toast(msg, type) {
  const host = document.getElementById('toastHost');
  if (!host) return;
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'error' ? ' error' : '');
  t.textContent = msg;
  host.appendChild(t);
  setTimeout(() => {
    t.classList.add('fade');
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 250);
  }, 2000);
}

function openModal() {
  const modal = document.getElementById('helpModal');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'false');
  document.querySelector('.wrap')?.setAttribute('inert', '');
}
function closeModal() {
  const modal = document.getElementById('helpModal');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'true');
  document.querySelector('.wrap')?.removeAttribute('inert');
  setTimeout(() => document.getElementById('board')?.focus(), 0);
}
function isModalOpen() {
  const help = document.getElementById('helpModal');
  const res = document.getElementById('resultModal');
  const helpOpen = help && help.getAttribute('aria-hidden') === 'false';
  const resOpen = res && res.getAttribute('aria-hidden') === 'false';
  return Boolean(helpOpen || resOpen);
}

function showResultModal(won) {
  const tries = guesses.length;
  const summary = won ? `Solved in ${tries}/${MAX_GUESSES}` : `Failed — ${tries}/${MAX_GUESSES}`;
  const ans = secret.toString();
  const grid = buildEmojiGrid();
  const summaryEl = document.getElementById('resultSummary');
  const answerEl = document.getElementById('resultAnswer');
  const gridEl = document.getElementById('resultGrid');
  if (summaryEl) summaryEl.textContent = summary;
  if (answerEl) answerEl.textContent = ans;
  if (gridEl) gridEl.textContent = grid;
  openResultModal();
}

function buildEmojiGrid() {
  const map = { green: '🟩', yellow: '🟨', gray: '⬛' };
  return feedbacks
    .map(row => row.map(s => map[s] || '⬛').join(''))
    .join('\n');
}

function computeShareText() {
  const won = feedbacks.length > 0 && feedbacks[feedbacks.length - 1].every(s => s === 'green');
  const tries = guesses.length;
  const header = `SF Symboldle — ${won ? tries : 'X'}/${MAX_GUESSES}`;
  const grid = buildEmojiGrid();
  const url = window.location.href;
  const desc = 'Guess the SF Symbol from dot-separated tokens.';
  return `${header}\n${grid}\n\n${desc}\nTry it: ${url}`;
}

async function copyScoreToClipboard() {
  const text = computeShareText();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('Score copied to clipboard');
  } catch {
    toast('Could not copy score', 'error');
  }
}

function openResultModal() {
  const modal = document.getElementById('resultModal');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'false');
  document.querySelector('.wrap')?.setAttribute('inert', '');
}
function closeResultModal() {
  const modal = document.getElementById('resultModal');
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'true');
  document.querySelector('.wrap')?.removeAttribute('inert');
  setTimeout(() => document.getElementById('board')?.focus(), 0);
}

function utcToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
function dateKeyUTC(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rngIndex(n, rng) { return Math.floor(rng() * n); }

function generateDailySecret(date) {
  const seed = xmur3(dateKeyUTC(date))();
  const rng = mulberry32(seed);
  if (SYMBOLS_TREE && Object.keys(SYMBOLS_TREE).length) {
    const w = seededWordFromTree(SYMBOLS_TREE, LENGTH_RANGE, rng);
    if (w && w.tokens.length >= (LENGTH_RANGE.minLen ?? 1)) return w;
  }
  const pool = TOKEN_POOL && TOKEN_POOL.length ? TOKEN_POOL : ['person','heart','circle','square','fill','bolt','arrow'];
  return genSecretDeterministic(pool, LENGTH_RANGE, rng);
}
function seededWordFromTree(tree, lenRange, rng) {
  const minL = lenRange.minLen ?? 1;
  const maxL = lenRange.maxLen ?? Math.max(1, minL);
  for (let attempt = 0; attempt < 50; attempt++) {
    const target = Math.floor(rng() * (maxL - minL + 1)) + minL;
    const tokens = [];
    let node = tree;
    for (let i = 0; i < target; i++) {
      const keys = Object.keys(node);
      if (keys.length === 0) break;
      const pick = keys[rngIndex(keys.length, rng)];
      tokens.push(pick);
      node = node[pick] || {};
    }
    if (tokens.length >= minL) return new Word(tokens);
  }
  const tokens = [];
  let node = tree;
  while (true) {
    const keys = Object.keys(node);
    if (keys.length === 0) break;
    const pick = keys[rngIndex(keys.length, rng)];
    tokens.push(pick);
    node = node[pick] || {};
    if (tokens.length >= minL) break;
  }
  return new Word(tokens);
}
function genSecretDeterministic(pool, lenRange, rng) {
  const minL = lenRange.minLen ?? 1;
  const maxL = lenRange.maxLen ?? Math.max(1, minL);
  const target = Math.floor(rng() * (maxL - minL + 1)) + minL;
  const tokens = [];
  for (let i = 0; i < target; i++) {
    const pick = pool[rngIndex(pool.length, rng)];
    tokens.push(pick);
  }
  return new Word(tokens);
}

class Word {
  constructor(tokens = []) {
    this.tokens = Array.from(tokens);
  }
  toString() { 
    return this.tokens.join('.');
  }
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickN(arr, n) {
  const copy = [...arr];
  //fisher-yates
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
};

function genSecret(pool, len = { minLen: 3, maxLen: 6 }) {
  const L = randInt(len.minLen ?? 3, len.maxLen ?? 6);
  const tokens = pickN(pool, L);
  return new Word(tokens);
}

function feedback(guess, secret) {
  const result = new Array(guess.length).fill('gray');
  const secretCounts = new Map();
  for (const t of secret) secretCounts.set(t, (secretCounts.get(t) || 0) + 1);

  for (let i = 0; i < guess.length; i++) {
    if (i < secret.length && guess[i] === secret[i]) {
      result[i] = 'green';
      secretCounts.set(guess[i], secretCounts.get(guess[i]) - 1);
    }
  }

  for (let i = 0; i < guess.length; i++) {
    if (result[i] !== 'gray') continue;
    const g = guess[i];
    const avail = secretCounts.get(g) || 0;
    if (avail > 0) {
      result[i] = 'yellow';
      secretCounts.set(g, avail - 1);
    }
  }
  return result;
}
