// blockme background — demo-mode version (short cycles) with full features

const DEFAULTS = {
  focusMinutes: 1,      // 1 minute (for demo)
  shortBreak: 0.33,     // ~20s
  longBreak: 0.66,      // ~40s (used for long break every 4th session)
  autoLoop: false,

  blocked: [],

  status: 'idle',
  endsAt: 0,

  xp: 0,
  sessions: 0,
  streakDays: 0,
  lastFocusDate: null,
  badges: []
};

const RULE_BASE = 7000;

function buildRule(id, domain) {
  return {
    id,
    priority: 1,
    action: { type: 'redirect', redirect: { extensionPath: '/blocked.html' } },
    condition: { urlFilter: `||${domain}^`, resourceTypes: ['main_frame'] }
  };
}

async function getState() {
  const s = await chrome.storage.local.get(DEFAULTS);
  return Object.assign({}, DEFAULTS, s);
}

async function setState(patch) {
  await chrome.storage.local.set(patch);
  chrome.runtime.sendMessage({ type: 'state', patch }).catch(() => {});
}

async function syncRules() {
  const s = await getState();
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const ours = existing
    .filter(r => r.id >= RULE_BASE && r.id < RULE_BASE + 5000)
    .map(r => r.id);

  // Remove old rules
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ours,
    addRules: []
  });

  // Only block during focus
  if (s.status === 'focus' && (s.blocked || []).length) {
    const toAdd = s.blocked.map((d, i) => buildRule(RULE_BASE + i, d));
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules: toAdd });
  }
}

function notify(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'logo.png', // if you don't have logo.png, Chrome just shows default icon
    title,
    message
  });
}

// ---------- Badges ----------
async function awardBadge(name) {
  const s = await getState();
  const set = new Set(s.badges || []);
  if (!set.has(name)) {
    set.add(name);
    await setState({ badges: Array.from(set) });
    notify('New badge unlocked!', name);
  }
}

async function checkBadges() {
  const s = await getState();
  if ((s.sessions || 0) >= 1) await awardBadge('First Focus');
  if ((s.sessions || 0) >= 5) await awardBadge('5 Sessions');
  if ((s.streakDays || 0) >= 3) await awardBadge('3-Day Streak');
  if ((s.xp || 0) >= 300) await awardBadge('300 XP');
}

// ---------- End focus ----------
async function endFocus() {
  const s = await getState();
  const gained = s.focusMinutes;            // 1 XP per minute of focus
  const sessions = (s.sessions || 0) + 1;   // +1 session

  const today = new Date(); 
  today.setHours(0,0,0,0);
  const last = s.lastFocusDate ? new Date(s.lastFocusDate) : null;

  let streak = s.streakDays || 0;
  if (!last) {
    streak = 1; // first ever focus day
  } else {
    last.setHours(0,0,0,0);
    const diff = today.getTime() - last.getTime();
    if (diff === 86400000)      streak += 1; // yesterday
    else if (diff > 86400000)   streak = 1;  // gap → restart streak
  }

  await setState({
    xp: (s.xp || 0) + gained,
    sessions,
    streakDays: streak,
    lastFocusDate: today.getTime()
  });

  await checkBadges();
}

// ---------- ALARM TICK ----------
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'tick') return;

  const s = await getState();

  if (s.status === 'focus' || s.status === 'break') {
    if (Date.now() >= s.endsAt) {

      // -------- FOCUS FINISHED --------
      if (s.status === 'focus') {
        await endFocus();

        // Classic Pomodoro: use long break roughly every 4 sessions
        const longBreakNow = ((s.sessions || 0) % 4 === 0);

        if (s.autoLoop) {
          const breakMinutes = longBreakNow ? s.longBreak : s.shortBreak;
          await setState({
            status: 'break',
            endsAt: Date.now() + breakMinutes * 60 * 1000
          });
          notify('Focus finished', longBreakNow ? 'Long break started!' : 'Short break started.');
        } else {
          await setState({ status: 'idle', endsAt: 0 });
          notify('Focus finished', 'Great job!');
        }

        await syncRules(); // unblocks sites when leaving focus
      }

      // -------- BREAK FINISHED --------
      else if (s.status === 'break') {
        if (s.autoLoop) {
          await setState({
            status: 'focus',
            endsAt: Date.now() + s.focusMinutes * 60 * 1000
          });
          notify('Break over', 'Back to focus!');
          await syncRules(); // re-apply rules in focus
        } else {
          await setState({ status: 'idle', endsAt: 0 });
          await syncRules();
        }
      }
    }

    chrome.alarms.create('tick', { when: Date.now() + 1000 });
  }
});

// ---------- MESSAGE HANDLERS ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    const s = await getState();

    if (msg.type === 'getState') {
      sendResponse(await getState());
      return;
    }

    if (msg.type === 'start') {
      await setState({
        status: 'focus',
        endsAt: Date.now() + s.focusMinutes * 60 * 1000
      });
      await syncRules();
      chrome.alarms.create('tick', { when: Date.now() + 1000 });
      notify('Focus started', 'Stay sharp!');
    }

    if (msg.type === 'pause') {
      if (s.status === 'focus' || s.status === 'break') {
        const remain = Math.max(0, s.endsAt - Date.now());
        await setState({ status: 'paused', endsAt: remain });
        await syncRules();
      }
    }

    if (msg.type === 'resume') {
      if (s.status === 'paused') {
        await setState({
          status: 'focus',
          endsAt: Date.now() + s.endsAt
        });
        await syncRules();
        chrome.alarms.create('tick', { when: Date.now() + 1000 });
      }
    }

    if (msg.type === 'reset') {
      await setState({ status: 'idle', endsAt: 0 });
      await syncRules();
    }

    if (msg.type === 'updateSettings') {
      await setState(msg.patch || {});
      await syncRules();
    }

    if (msg.type === 'addBlocked') {
      let domain = (msg.domain || '').trim();
      if (!domain) { sendResponse(await getState()); return; }

      // just in case, normalize a bit here too
      domain = domain
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/.*$/, '');

      const set = new Set([...(s.blocked || []), domain]);
      await setState({ blocked: Array.from(set) });
      await syncRules();
    }

    if (msg.type === 'removeBlocked') {
      const list = (s.blocked || []).filter(d => d !== msg.domain);
      await setState({ blocked: list });
      await syncRules();
    }

    sendResponse(await getState());
  })();
  return true;
});

// ---------- INIT ----------
(async () => { await syncRules(); })();
