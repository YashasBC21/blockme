// blocked.js — uses assets/quotes.json, assets/puzzles.json and shows live timer

// --- RPC to background ---
async function rpc(type,payload={}) {
  try { return await chrome.runtime.sendMessage({type, ...payload}); }
  catch { return {}; }
}

// --- Timer formatting helpers ---
function pad(n){ return String(n).padStart(2,'0'); }
function fmt(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const m = Math.floor(s/60), sec = s % 60;
  return `${pad(m)}:${pad(sec)}`;
}

// --- Load quotes from quotes.json ---
async function loadQuote() {
  try {
    const file = chrome.runtime.getURL("assets/quotes.json");
    const data = await fetch(file).then(r => r.json());
    const list = data.quotes || [];
    if (list.length > 0) {
      const q = list[Math.floor(Math.random() * list.length)];
      document.getElementById("quote").textContent = q;
    }
  } catch (e) {
    document.getElementById("quote").textContent = "Stay focused. You've got this.";
  }
}

// --- Load puzzles from puzzles.json ---
async function loadPuzzle() {
  try {
    const file = chrome.runtime.getURL("assets/puzzles.json");
    const data = await fetch(file).then(r => r.json());
    const list = data.riddles || [];
    if (list.length > 0) {
      const r = list[Math.floor(Math.random() * list.length)];
      document.getElementById("riddle").textContent = r.q;
    }
  } catch (e) {
    document.getElementById("riddle").textContent = "Error loading puzzle.";
  }
}

// --- Countdown display ---
async function render() {
  const s = await rpc('getState');
  let ms = 0;

  if (s.status === 'focus' || s.status === 'break')
    ms = s.endsAt - Date.now();
  else if (s.status === 'paused')
    ms = s.endsAt;

  const t = fmt(ms);
  document.title = `Focus ends in ${t}`;

  let el = document.getElementById('countdown');
  if (!el) {
    el = document.createElement('div');
    el.id = 'countdown';
    el.style = 'font-size:42px;margin:10px 0;text-align:center;';
    document.querySelector('.card')
            .insertBefore(el, document.querySelector('#quote'));
  }
  el.textContent = t;
}

// --- Init ---
loadQuote();
loadPuzzle();
setInterval(render, 1000);
render();
