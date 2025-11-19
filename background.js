// blockme background — demo-mode version (short cycles) with full features

const DEFAULTS = {
  focusMinutes: 1,      // 1 minute
  shortBreak: 0.33,     // ~33s
  longBreak: 0.66,      // ~66s
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

  // Clear our rules
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
    iconUrl: 'logo.png',
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
  if ((s.sessions || 0) >= 1)  await awardBadge('First Focus');
  if ((s.sessions || 0) >= 5)  await awardBadge('5 Sessions');
  if ((s.streakDays || 0) >= 3) await awardBadge('3-Day Streak');
  if ((s.xp || 0) >= 300)      await awardBadge('300 XP');
}

// ---------- End focus ----------
async function endFocus() {
  const s = await getState();
  const gained = s.focusMinutes;
  const sessions = (s.sessions || 0) + 1;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = s.lastFocusDate ? new Date(s.lastFocusDate) : null;
  let streak = s.streakDays || 0;

  if (!last) {
    streak = 1;
  } else {
    last.setHours(0, 0, 0, 0);
    const diff = today.getTime() - last.getTime();
    if (diff === 86400000) streak += 1;
    else if (diff > 86400000) streak = 1;
  }

  await setState({
    xp: (s.xp || 0) + gained,
    sessions,
    streakDays: streak,
    lastFocusDate: today.getTime()
  });

  await checkBadges();
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'tick') return;

  const s = await getState();

  if (s.status === 'focus' || s.status === 'break') {
    if (Date.now() >= s.endsAt) {
      if (s.status === 'focus') {
        await endFocus();
        if (s.autoLoop) {
          await setState({
            status: 'break',
            endsAt: Date.now() + s.shortBreak * 60 * 1000
          });
          notify('Focus finished', 'Short break started.');
        } else {
          await setState({ status: 'idle', endsAt: 0 });
          notify('Focus finished', 'Great job!');
        }
        await syncRules();
      } else if (s.status === 'break') {
        if (s.autoLoop) {
          await setState({
            status: 'focus',
            endsAt: Date.now() + s.focusMinutes * 60 * 1000
          });
          notify('Break over', 'Back to focus!');
          await syncRules();
        } else {
          await setState({ status: 'idle', endsAt: 0 });
          await syncRules();
        }
      }
    }
    chrome.alarms.create('tick', { when: Date.now() + 1000 });
  }
});

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
        await setState({ status: 'focus', endsAt: Date.now() + s.endsAt });
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
      const domain = (msg.domain || '').trim();
      if (!domain) { sendResponse(await getState()); return; }
      const set = new Set([...(s.blocked || []), domain]);
      await setState({ blocked: Array.from(set) });
      await syncRules();
    }

    if (msg.type === 'removeBlocked') {
      const list = (s.blocked || []).filter(d => d !== msg.domain);
      await setState({ blocked: list });
      await syncRules();
    }

    // NEW: for guests to sync host's blocklist
    if (msg.type === 'setBlockedList') {
      const list = Array.isArray(msg.blocked) ? msg.blocked : [];
      await setState({ blocked: list });
      await syncRules();
    }

    sendResponse(await getState());
  })();

  return true;
});

(async () => { await syncRules(); })();
