function pad(n){ return String(n).padStart(2,'0'); }
function fmt(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const m = Math.floor(s/60);
  const sec = s % 60;
  return `${pad(m)}:${pad(sec)}`;
}
async function rpc(type, payload={}) {
  return await chrome.runtime.sendMessage({ type, ...payload });
}


async function applyState(s){
  document.getElementById('status').textContent=s.status;
  document.getElementById('xp').textContent=s.xp||0;
  document.getElementById('streak').textContent=s.streakDays||0;
  document.getElementById('sessions').textContent=s.sessions||0;

  let ms = 0;
  if(s.status==='focus'||s.status==='break') ms=s.endsAt-Date.now();
  else if(s.status==='paused') ms=s.endsAt;
  else ms=s.focusMinutes*60*1000;

  document.getElementById('timer').textContent=fmt(ms);

  document.getElementById('focus').value=s.focusMinutes;
  document.getElementById('short').value=s.shortBreak;
  document.getElementById('long').value=s.longBreak;
  document.getElementById('autoloop').checked=!!s.autoLoop;


  // Blocklist UI
  const ul=document.getElementById('list');
  ul.innerHTML='';
  (s.blocked||[]).forEach(domain=>{
    const li=document.createElement('li');
    li.innerHTML = `
      <span class="pill">${domain}</span>
      <button class="secondary" data-d="${domain}">Remove</button>
    `;
    ul.appendChild(li);
  });

  // Badges
  const b=document.getElementById('badges');
  b.innerHTML='';
  (s.badges||[]).forEach(name=>{
    const span=document.createElement('span');
    span.className='badge';
    span.textContent=name;
    b.appendChild(span);
  });
}

async function refresh(){
  const s = await rpc('getState');
  applyState(s);
}

// ------- MAIN BUTTONS -------
document.getElementById('start').onclick=()=>rpc('start').then(refresh);
document.getElementById('pause').onclick=async ()=>{
  const s = await rpc('getState');
  if(s.status==='paused') await rpc('resume');
  else await rpc('pause');
  refresh();
};
document.getElementById('reset').onclick=()=>rpc('reset').then(refresh);

// ------- SETTINGS UPDATES -------
['focus','short','long'].forEach(id=>{
  document.getElementById(id).addEventListener('change', ()=>{
    rpc('updateSettings',{patch:{
      focusMinutes:+document.getElementById('focus').value,
      shortBreak:+document.getElementById('short').value,
      longBreak:+document.getElementById('long').value
    }}).then(refresh);
  });
});
document.getElementById('autoloop').onchange=(e)=>
  rpc('updateSettings',{patch:{autoLoop:e.target.checked}}).then(refresh);




// ------- BLOCKLIST ADD -------
document.getElementById('add').onclick=()=>{
  let d = document.getElementById('domain').value.trim().toLowerCase();
  if(!d) return;

  d = d.replace(/^https?:\/\//,'')
       .replace(/^www\./,'')
       .replace(/\/.*$/,'');

  if(!d) return;

  rpc('addBlocked',{domain:d}).then(()=>{
    document.getElementById('domain').value='';
    refresh();
  });
};

// ------- BLOCKLIST REMOVE -------
document.getElementById('list').addEventListener('click',(e)=>{
  if(e.target.tagName==='BUTTON'){
    rpc('removeBlocked',{domain:e.target.dataset.d}).then(refresh);
  }
});

// Live updates
chrome.runtime.onMessage.addListener((msg)=>{
  if(msg.type==='state') refresh();
});

refresh();
setInterval(refresh,500);
