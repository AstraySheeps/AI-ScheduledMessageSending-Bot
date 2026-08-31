// 来信 · 飞书机器人（Cloudflare Worker）· 多用户版
// 同一网站托管多个用户：每个用户一个「认领号 + PIN」，各自独立的人设/报备/接收人。
// 共享凭据（飞书 App + DeepSeek Key）由管理员配置；用户可在「高级」里填自己的专属凭据覆盖。

const SESSION_SECRET = 'myecho-session-2024-v1';

const CSS = `
  :root { --bg:#F5F6F8; --card:#FFFFFF; --primary:#1A1A1A; --accent:#FF6B6B; --text:#1A1A1A; --muted:#9AA0A6; --border:#E9E9E9; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif; }
  .wrap { max-width:640px; margin:0 auto; padding:16px 16px 96px; }
  .header { display:flex; align-items:center; gap:10px; padding:8px 4px 16px; }
  .heart { width:34px; height:34px; border-radius:10px; background:linear-gradient(135deg,#FF8A7A,#FF6B6B); display:flex; align-items:center; justify-content:center; color:#fff; font-size:18px; flex:0 0 34px; }
  .header h1 { margin:0; font-size:22px; font-weight:700; }
  .header p { margin:2px 0 0; color:var(--muted); font-size:12px; }
  .card { background:var(--card); border-radius:20px; padding:18px; margin-top:14px; box-shadow:0 1px 3px rgba(0,0,0,.04); }
  .card h2 { margin:0 0 4px; font-size:16px; font-weight:700; }
  .card .sub { margin:0 0 14px; color:var(--muted); font-size:12px; }
  label { display:block; font-size:13px; font-weight:600; margin:12px 0 6px; }
  input[type=text], input[type=number], input[type=password], textarea, select { width:100%; padding:12px 14px; border:1px solid var(--border); border-radius:14px; background:#fff; font-size:15px; color:var(--text); outline:none; }
  textarea { min-height:72px; resize:vertical; }
  .row { display:flex; gap:10px; }
  .row > div { flex:1; }
  .btn { display:block; width:100%; padding:15px; border:0; border-radius:20px; background:var(--primary); color:#fff; font-size:16px; font-weight:600; cursor:pointer; }
  .btn.ghost { background:transparent; color:var(--primary); border:1px solid var(--border); }
  .event-row { display:flex; align-items:center; gap:10px; margin:8px 0; }
  .dot { width:12px; height:12px; border-radius:50%; background:var(--accent); flex:0 0 12px; }
  .event-row input { flex:1; }
  .event-row .del { border:0; background:none; color:var(--muted); font-size:18px; cursor:pointer; }
  .ci { border:1px solid var(--border); border-radius:16px; margin-top:10px; }
  .ci summary { padding:14px 16px; font-weight:600; font-size:15px; cursor:pointer; list-style:none; display:flex; justify-content:space-between; align-items:center; }
  .ci summary::after { content:"\\25BE"; color:var(--muted); }
  .ci[open] summary::after { content:"\\25B4"; }
  .ci-body { padding:0 16px 14px; }
  .mini { padding:8px 12px; border:1px solid var(--border); border-radius:12px; background:none; color:var(--primary); font-size:13px; cursor:pointer; }
  .del-ci { color:#E33; }
  .sticky { position:fixed; left:0; right:0; bottom:0; padding:12px 16px calc(12px + env(safe-area-inset-bottom)); background:linear-gradient(transparent, var(--bg) 30%); }
  .sticky .btn { max-width:640px; margin:0 auto; }
  .hint { color:var(--muted); font-size:12px; margin-top:6px; }
  details.adv { margin-top:14px; border:1px dashed var(--border); border-radius:16px; padding:0 14px; }
  details.adv summary { padding:14px 0; font-weight:600; font-size:14px; cursor:pointer; list-style:none; }
  details.adv summary::after { content:"\\25BE"; color:var(--muted); margin-left:6px; }
  .urow { border:1px solid var(--border); border-radius:16px; margin-top:10px; padding:12px 14px; }
  .urow .top { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
  .urow .btns { display:flex; gap:8px; margin-top:10px; }
  .tag { font-size:12px; color:var(--muted); background:var(--bg); border-radius:8px; padding:3px 8px; }
`;

const LANDING_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>myecho · 登录</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <div class="header" style="justify-content:center;flex-direction:column;text-align:center;padding-top:60px;">
    <div class="heart" style="width:56px;height:56px;flex:0 0 56px;font-size:28px;border-radius:16px;">♥</div>
    <div style="margin-top:10px;">
      <h1>myecho</h1>
      <p>云端定时消息 · 飞书机器人</p>
    </div>
  </div>
  <div class="card" style="margin-top:30px;">
    <h2>进入我的机器人</h2>
    <p class="sub">认领号和 PIN 由管理员分配</p>
    <label>认领号</label>
    <input type="text" id="code" placeholder="例如 xuyan">
    <label>PIN</label>
    <input type="password" id="pin" placeholder="6 位数字或口令">
    <button class="btn" id="login" style="margin-top:18px;">进入</button>
    <p class="hint" id="err" style="color:#E33;min-height:16px;"></p>
  </div>
  <p style="text-align:center;margin-top:18px;"><a href="/admin" style="color:var(--muted);font-size:13px;">管理员入口</a></p>
</div>
<script>
function el(id){ return document.getElementById(id); }
function getParam(n){ var m = location.search.match(new RegExp('[?&]' + n + '=([^&]*)')); return m ? decodeURIComponent(m[1]) : ''; }
el('code').value = getParam('u') || '';
function go(){
  var code = el('code').value.trim(); var pin = el('pin').value;
  if(!code || !pin){ el('err').textContent = '请填写认领号和 PIN'; return; }
  el('err').textContent = '';
  fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({code:code, pin:pin}) })
    .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
    .then(function(o){ if(o.ok){ location.href='/'; } else { el('err').textContent = (o.j && o.j.msg) || '登录失败'; } })
    .catch(function(){ el('err').textContent = '网络错误，请重试'; });
}
el('login').addEventListener('click', go);
el('pin').addEventListener('keydown', function(e){ if(e.key === 'Enter') go(); });
</script>
</body>
</html>`;

const USER_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>myecho · 配置</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <div class="header" style="justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:10px;">
      <div class="heart">♥</div>
      <div>
        <h1>myecho</h1>
        <p>云端定时消息 · <span id="who">…</span></p>
      </div>
    </div>
    <div style="display:flex;gap:8px;">
      <button id="resetBtn" style="border:1px solid #E9E9E9;background:#fff;color:#E33;border-radius:12px;padding:8px 12px;font-size:13px;">恢复默认</button>
      <button id="logoutBtn" style="border:1px solid #E9E9E9;background:#fff;color:#1A1A1A;border-radius:12px;padding:8px 12px;font-size:13px;">退出</button>
    </div>
  </div>

  <div class="card">
    <h2>立即发送</h2>
    <p class="sub">不等到点，立刻生成或直发一条消息到你的飞书</p>
    <label>一次性提示词（按人设让 AI 生成后发送）</label>
    <textarea id="oncePrompt" placeholder="例如：余余今天考砸了不开心，帮我安慰她"></textarea>
    <button class="btn ghost" id="btnOnce" style="margin-top:10px;">生成并发送</button>
    <label style="margin-top:16px;">直接发送（原样发到飞书，不走 AI）</label>
    <input type="text" id="directText" placeholder="例如：hi">
    <button class="btn ghost" id="btnDirect" style="margin-top:10px;">直接发送</button>
    <p class="hint" id="sendMsg" style="min-height:16px;"></p>
  </div>

  <div class="card">
    <h2>接收人</h2>
    <p class="sub">谁收到消息（你飞书账号绑定的邮箱 / 手机号）</p>
    <label>接收邮箱</label>
    <input type="text" id="receiverEmail" placeholder="you@example.com">
    <label>手机号（可选，邮箱查不到时用）</label>
    <input type="text" id="receiverMobile" placeholder="138xxxx">
  </div>

  <details class="adv">
    <summary>高级：本用户专属凭据（可选）</summary>
    <div style="padding-bottom:14px;">
      <p class="sub">默认用管理员配置的共享机器人。想让自己的机器人有不同名字/头像，或用自己的 DeepSeek Key，就填下面（不填=用共享的）。</p>
      <label>飞书 App ID（可选）</label>
      <input type="text" id="appId" placeholder="cli_xxxx">
      <label>飞书 App Secret（可选）</label>
      <input type="text" id="appSecret" placeholder="xxxx">
      <label>DeepSeek API Key（可选）</label>
      <input type="text" id="apiKey" placeholder="sk-...">
    </div>
  </details>

  <div class="card">
    <h2>身份设定</h2>
    <p class="sub">AI 角色的人设，结构固定、内容自填</p>
    <div class="row">
      <div><label>姓名</label><input type="text" id="name"></div>
      <div><label>对方称呼你</label><input type="text" id="userName"></div>
    </div>
    <label>对方备注</label><input type="text" id="remark">
    <label>一句话简介</label><input type="text" id="intro">
    <label>关系与背景</label><textarea id="relationship"></textarea>
    <div class="row">
      <div><label>对方所在地（角色）</label><input type="text" id="theirLocation"></div>
      <div><label>你的所在地</label><input type="text" id="yourLocation"></div>
    </div>
    <label>时差（对方比你晚几小时，可填负数）</label><input type="number" id="timeOffsetHours">
    <label>性格</label><textarea id="personality"></textarea>
    <label>说话风格</label><textarea id="style"></textarea>
    <label>硬性禁止</label><textarea id="rules"></textarea>
    <label>生活细节</label><textarea id="lifestyle"></textarea>
  </div>

  <div class="card">
    <h2>参考事件池</h2>
    <p class="sub">给 AI 的"今天发生了什么"灵感（会随机抽几条参考）</p>
    <div id="eventsList"></div>
    <button class="btn ghost" id="addEvent">＋ 添加事件</button>
  </div>

  <div class="card">
    <h2>报备管理</h2>
    <p class="sub">定时 / 随机发消息的规则</p>
    <div id="checkinsList"></div>
    <button class="btn ghost" id="addCheckin">＋ 新增报备</button>
  </div>
</div>

<div class="sticky"><div style="display:flex;gap:10px;max-width:640px;margin:0 auto;"><button class="btn" id="testSend" style="flex:1;background:#fff;color:#1A1A1A;border:1px solid #E9E9E9;">测试发送</button><button class="btn" id="save" style="flex:2;">保存</button></div></div>

<script>
var cfg = { feishu:{}, persona:{events:[]}, checkIns:[], receiverEmail:'', receiverMobile:'', apiKey:'' };

function el(id){ return document.getElementById(id); }
function val(id){ return (el(id) ? el(id).value : ''); }

function load(){
  fetch('/api/config').then(function(r){
    if(r.status === 401){ location.href = '/'; return null; }
    return r.json();
  }).then(function(c){
    if(c && c.persona){ cfg = c; render(); }
  }).catch(function(){});
}

function render(){
  el('receiverEmail').value = cfg.receiverEmail || '';
  el('receiverMobile').value = cfg.receiverMobile || '';
  el('appId').value = (cfg.feishu && cfg.feishu.appId) || '';
  el('appSecret').value = (cfg.feishu && cfg.feishu.appSecret) || '';
  el('apiKey').value = cfg.apiKey || '';
  el('who').textContent = '认领号 ' + (cfg.code || '');
  var p = cfg.persona || {};
  el('name').value = p.name || ''; el('userName').value = p.userName || '';
  el('remark').value = p.remark || ''; el('intro').value = p.intro || '';
  el('relationship').value = p.relationship || '';
  el('theirLocation').value = p.theirLocation || ''; el('yourLocation').value = p.yourLocation || '';
  el('timeOffsetHours').value = p.timeOffsetHours || 12;
  el('personality').value = p.personality || ''; el('style').value = p.style || '';
  el('rules').value = p.rules || ''; el('lifestyle').value = p.lifestyle || '';
  renderEvents(); renderCheckins();
}

function renderEvents(){
  var list = el('eventsList'); list.innerHTML = '';
  var events = (cfg.persona && cfg.persona.events) || [];
  events.forEach(function(ev, i){
    var row = document.createElement('div'); row.className = 'event-row';
    var dot = document.createElement('div'); dot.className = 'dot';
    var inp = document.createElement('input'); inp.type = 'text'; inp.value = ev;
    inp.addEventListener('input', function(){ events[i] = inp.value; });
    var del = document.createElement('button'); del.className = 'del'; del.textContent = '✕';
    del.addEventListener('click', function(){ events.splice(i,1); renderEvents(); });
    row.appendChild(dot); row.appendChild(inp); row.appendChild(del);
    list.appendChild(row);
  });
}

el('addEvent').addEventListener('click', function(){
  (cfg.persona.events || (cfg.persona.events = [])).push('');
  renderEvents();
});

function newCheckin(){
  return { id:'c'+Date.now(), name:'新报备', isRandom:false, time:'08:00',
    windowStart:'09:00', windowEnd:'23:00', countMin:3, countMax:6, minIntervalMin:30,
    prompt:'', enabled:true, dayRule:'daily', customDates:[] };
}

function renderCheckins(){
  var list = el('checkinsList'); list.innerHTML = '';
  var cis = cfg.checkIns || [];
  cis.forEach(function(ci, i){
    var det = document.createElement('details'); det.className = 'ci';
    var sum = document.createElement('summary'); sum.textContent = ci.name + (ci.enabled ? '' : '（停用）');
    var body = document.createElement('div'); body.className = 'ci-body';

    function row(label, id, val, type){
      var wrap = document.createElement('div'); wrap.style.marginTop = '8px';
      var lb = document.createElement('label'); lb.textContent = label;
      var inp = document.createElement('input'); inp.type = type || 'text'; inp.id = id; inp.value = val;
      inp.addEventListener('input', function(){ ci[id] = inp.value; });
      wrap.appendChild(lb); wrap.appendChild(inp);
      body.appendChild(wrap);
      return inp;
    }
    function area(label, id, val){
      var wrap = document.createElement('div'); wrap.style.marginTop = '8px';
      var lb = document.createElement('label'); lb.textContent = label;
      var ta = document.createElement('textarea'); ta.id = id; ta.value = val;
      ta.addEventListener('input', function(){ ci[id] = ta.value; });
      wrap.appendChild(lb); wrap.appendChild(ta);
      body.appendChild(wrap);
    }
    function select(label, id, opts, val){
      var wrap = document.createElement('div'); wrap.style.marginTop = '8px';
      var lb = document.createElement('label'); lb.textContent = label;
      var sel = document.createElement('select'); sel.id = id;
      opts.forEach(function(o){
        var op = document.createElement('option'); op.value = o.v; op.textContent = o.t;
        if(o.v === val) op.selected = true; sel.appendChild(op);
      });
      sel.addEventListener('change', function(){ ci[id] = sel.value; });
      wrap.appendChild(lb); wrap.appendChild(sel);
      body.appendChild(wrap);
    }

    row('名称','name', ci.name);
    select('类型','isRandom',[{v:false,t:'定时'},{v:true,t:'随机'}], ci.isRandom);
    row('时间（定时用，如 07:30）','time', ci.time);
    row('时段开始（随机用）','windowStart', ci.windowStart);
    row('时段结束（随机用）','windowEnd', ci.windowEnd);
    row('每天最少条数','countMin', ci.countMin, 'number');
    row('每天最多条数','countMax', ci.countMax, 'number');
    row('最小间隔分钟','minIntervalMin', ci.minIntervalMin, 'number');
    select('日期规则','dayRule',[{v:'daily',t:'每天'},{v:'weekday',t:'工作日'},{v:'weekend',t:'周末'},{v:'custom',t:'指定日期'}], ci.dayRule);
    row('指定日期（逗号分隔，如 05-27,2-14）','customDates', (ci.customDates||[]).join(','));
    area('本条提示词','prompt', ci.prompt);

    var foot = document.createElement('div'); foot.style.cssText = 'margin-top:12px;display:flex;gap:8px;';
    var en = document.createElement('label'); en.style.cssText = 'display:flex;align-items:center;gap:6px;flex:1;';
    var cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = ci.enabled;
    cb.addEventListener('change', function(){ ci.enabled = cb.checked; sum.textContent = ci.name + (ci.enabled ? '' : '（停用）'); });
    en.appendChild(cb); en.appendChild(document.createTextNode('启用'));
    var delBtn = document.createElement('button'); delBtn.className = 'mini del-ci'; delBtn.textContent = '删除';
    delBtn.addEventListener('click', function(){ cis.splice(i,1); renderCheckins(); });
    foot.appendChild(en); foot.appendChild(delBtn);
    body.appendChild(foot);

    det.appendChild(sum); det.appendChild(body);
    list.appendChild(det);
  });
}

el('addCheckin').addEventListener('click', function(){
  cfg.checkIns = cfg.checkIns || []; cfg.checkIns.push(newCheckin()); renderCheckins();
});

el('save').addEventListener('click', function(){
  cfg.feishu = { appId: val('appId'), appSecret: val('appSecret') };
  cfg.receiverEmail = val('receiverEmail');
  cfg.receiverMobile = val('receiverMobile');
  cfg.apiKey = val('apiKey');
  cfg.persona.name = val('name'); cfg.persona.userName = val('userName');
  cfg.persona.remark = val('remark'); cfg.persona.intro = val('intro');
  cfg.persona.relationship = val('relationship');
  cfg.persona.theirLocation = val('theirLocation'); cfg.persona.yourLocation = val('yourLocation');
  cfg.persona.timeOffsetHours = parseInt(val('timeOffsetHours')||'12',10);
  cfg.persona.personality = val('personality'); cfg.persona.style = val('style');
  cfg.persona.rules = val('rules'); cfg.persona.lifestyle = val('lifestyle');

  cfg.checkIns.forEach(function(ci){
    if(ci.dayRule === 'custom' && typeof ci.customDates === 'string'){
      ci.customDates = ci.customDates.split(/[,，、\\s]+/).filter(function(s){return s.length>0;});
    } else if(ci.dayRule !== 'custom'){
      ci.customDates = [];
    }
    ci.countMin = parseInt(ci.countMin||'3',10);
    ci.countMax = parseInt(ci.countMax||'6',10);
    ci.minIntervalMin = parseInt(ci.minIntervalMin||'30',10);
  });

  fetch('/api/config', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(cfg) })
    .then(function(r){ return r.json(); }).then(function(){ alert('已保存 ✓'); })
    .catch(function(){ alert('保存失败，请检查网络'); });
});

el('testSend').addEventListener('click', function(){
  el('save').click();
  setTimeout(function(){
    fetch('/api/test', { method:'POST' })
      .then(function(r){ return r.json(); })
      .then(function(res){
        if(res && res.ok){ alert('已发送测试消息，去飞书看看'); }
        else { alert('发送失败：' + ((res && res.msg) ? res.msg : JSON.stringify(res))); }
      })
      .catch(function(e){ alert('发送失败：' + e); });
  }, 800);
});

el('resetBtn').addEventListener('click', function(){
  if(!confirm('确定恢复默认？会把人设和报备重置为默认（接收人与凭据保留）。')) return;
  fetch('/api/reset', { method:'POST' })
    .then(function(){ location.reload(); })
    .catch(function(e){ alert('重置失败：' + e); });
});

el('logoutBtn').addEventListener('click', function(){
  fetch('/api/logout', { method:'POST' }).then(function(){ location.href = '/'; });
});

function setSendMsg(t){ if(el('sendMsg')) el('sendMsg').textContent = t; }

el('btnOnce').addEventListener('click', function(){
  var prompt = (el('oncePrompt') ? el('oncePrompt').value : '').trim();
  if(!prompt){ alert('请先输入提示词'); return; }
  el('btnOnce').disabled = true;
  setSendMsg('正在生成…');
  fetch('/api/once', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt: prompt }) })
    .then(function(r){ return r.json(); })
    .then(function(res){
      el('btnOnce').disabled = false;
      if(res && res.ok){ setSendMsg('已发送 ✓'); el('oncePrompt').value = ''; }
      else { setSendMsg('失败：' + ((res && res.msg) ? res.msg : JSON.stringify(res))); }
    })
    .catch(function(e){ el('btnOnce').disabled = false; setSendMsg('失败：' + e); });
});

el('btnDirect').addEventListener('click', function(){
  var text = (el('directText') ? el('directText').value : '').trim();
  if(!text){ alert('请输入要发送的内容'); return; }
  el('btnDirect').disabled = true;
  setSendMsg('正在发送…');
  fetch('/api/direct', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ text: text }) })
    .then(function(r){ return r.json(); })
    .then(function(res){
      el('btnDirect').disabled = false;
      if(res && res.ok){ setSendMsg('已发送 ✓'); el('directText').value = ''; }
      else { setSendMsg('失败：' + ((res && res.msg) ? res.msg : JSON.stringify(res))); }
    })
    .catch(function(e){ el('btnDirect').disabled = false; setSendMsg('失败：' + e); });
});

load();
</script>
</body>
</html>`;

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>myecho · 管理员</title>
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <div class="header" style="justify-content:space-between;">
    <div style="display:flex;align-items:center;gap:10px;">
      <div class="heart">♥</div>
      <div>
        <h1>myecho · 管理员</h1>
        <p>共享凭据 + 用户管理</p>
      </div>
    </div>
    <button id="logoutBtn" style="border:1px solid #E9E9E9;background:#fff;color:#1A1A1A;border-radius:12px;padding:8px 12px;font-size:13px;">退出</button>
  </div>

  <div class="card" id="setup" style="display:none;">
    <h2>首次设置管理员 PIN</h2>
    <p class="sub">第一次打开本页，设置一个只有你知道的管理员口令</p>
    <label>管理员 PIN</label>
    <input type="password" id="setupPin" placeholder="设置一个口令">
    <button class="btn" id="setupBtn" style="margin-top:16px;">设置并进入</button>
    <p class="hint" id="setupErr" style="color:#E33;min-height:16px;"></p>
  </div>

  <div class="card" id="gate" style="display:none;">
    <h2>管理员登录</h2>
    <p class="sub">输入管理员 PIN</p>
    <label>管理员 PIN</label>
    <input type="password" id="gatePin" placeholder="管理员口令">
    <button class="btn" id="gateBtn" style="margin-top:16px;">进入</button>
    <p class="hint" id="gateErr" style="color:#E33;min-height:16px;"></p>
  </div>

  <div id="panel" style="display:none;">
    <div class="card">
      <h2>共享凭据</h2>
      <p class="sub">所有用户默认复用的飞书应用 + DeepSeek Key（用户可在自己页面用专属凭据覆盖）</p>
      <label>飞书 App ID</label>
      <input type="text" id="appId" placeholder="cli_xxxx">
      <label>飞书 App Secret</label>
      <input type="text" id="appSecret" placeholder="xxxx">
      <label>DeepSeek API Key</label>
      <input type="text" id="apiKey" placeholder="sk-...">
      <button class="btn" id="saveSystem" style="margin-top:16px;">保存共享凭据</button>
      <p class="hint" id="sysMsg"></p>
    </div>

    <div class="card">
      <h2>用户管理</h2>
      <p class="sub">为每个朋友创建一个「认领号 + PIN」，把链接和 PIN 发给 TA</p>
      <div class="row" style="margin-top:6px;">
        <div><label>认领号</label><input type="text" id="newCode" placeholder="如 xiaoyu"></div>
        <div><label>PIN</label><input type="text" id="newPin" placeholder="口令"></div>
      </div>
      <button class="btn ghost" id="addUser" style="margin-top:12px;">＋ 添加用户</button>
      <div id="users"></div>
    </div>
  </div>
</div>

<script>
function el(id){ return document.getElementById(id); }
function hideAll(){ ['setup','gate','panel'].forEach(function(id){ el(id).style.display='none'; }); }
function show(id){ hideAll(); el(id).style.display='block'; }

function boot(){
  fetch('/api/system').then(function(r){
    return r.json().then(function(j){ return {s:r.status, j:j}; });
  }).then(function(o){
    if(o.s === 200){ show('panel'); renderPanel(o.j); }
    else if(o.j && o.j.setup){ show('setup'); }
    else { show('gate'); }
  }).catch(function(){ show('gate'); });
}

function setupPin(){
  var p = el('setupPin').value;
  if(!p){ el('setupErr').textContent = '请设置一个 PIN'; return; }
  fetch('/api/admin-setup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({pin:p}) })
    .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
    .then(function(o){ if(o.ok){ location.reload(); } else { el('setupErr').textContent = (o.j && o.j.msg) || '失败'; } });
}
function gatePin(){
  var p = el('gatePin').value;
  if(!p){ el('gateErr').textContent = '请输入 PIN'; return; }
  fetch('/api/admin-login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({pin:p}) })
    .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
    .then(function(o){ if(o.ok){ location.reload(); } else { el('gateErr').textContent = (o.j && o.j.msg) || 'PIN 错误'; } });
}

function renderPanel(j){
  el('appId').value = (j.feishu && j.feishu.appId) || '';
  el('appSecret').value = (j.feishu && j.feishu.appSecret) || '';
  el('apiKey').value = j.apiKey || '';
  var list = el('users'); list.innerHTML = '';
  (j.users || []).forEach(function(u){
    var row = document.createElement('div'); row.className = 'urow';
    var top = document.createElement('div'); top.className = 'top';
    var b = document.createElement('b'); b.textContent = u.code;
    var pinTag = document.createElement('span'); pinTag.className = 'tag'; pinTag.textContent = 'PIN: ' + (u.pin || '未设');
    var recvTag = document.createElement('span'); recvTag.className = 'tag'; recvTag.textContent = (u.receiverEmail || u.receiverMobile) ? ('接收人: ' + (u.receiverEmail || u.receiverMobile)) : '未填接收人';
    top.appendChild(b); top.appendChild(pinTag); top.appendChild(recvTag);
    var btns = document.createElement('div'); btns.className = 'btns';
    var rp = document.createElement('button'); rp.className = 'mini'; rp.textContent = '重置PIN';
    rp.addEventListener('click', function(){
      var np = prompt('给 ' + u.code + ' 设置新 PIN：');
      if(!np) return;
      fetch('/api/users/resetpin', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({code:u.code, pin:np}) })
        .then(function(){ location.reload(); });
    });
    var dl = document.createElement('button'); dl.className = 'mini del-ci'; dl.textContent = '删除';
    dl.addEventListener('click', function(){
      if(!confirm('确定删除用户 ' + u.code + '？其配置将清空。')) return;
      fetch('/api/users?code=' + encodeURIComponent(u.code), { method:'DELETE' }).then(function(){ location.reload(); });
    });
    btns.appendChild(rp); btns.appendChild(dl);
    row.appendChild(top); row.appendChild(btns);
    list.appendChild(row);
  });
}

el('setupBtn').addEventListener('click', setupPin);
el('gateBtn').addEventListener('click', gatePin);
el('gatePin').addEventListener('keydown', function(e){ if(e.key === 'Enter') gatePin(); });
el('setupPin').addEventListener('keydown', function(e){ if(e.key === 'Enter') setupPin(); });

el('saveSystem').addEventListener('click', function(){
  fetch('/api/system', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ feishu:{ appId: el('appId').value, appSecret: el('appSecret').value }, apiKey: el('apiKey').value }) })
    .then(function(r){ return r.json(); })
    .then(function(){ el('sysMsg').textContent = '已保存 ✓'; });
});

el('addUser').addEventListener('click', function(){
  var code = el('newCode').value.trim(); var pin = el('newPin').value;
  if(!code || !pin){ alert('请填写认领号和 PIN'); return; }
  fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({code:code, pin:pin}) })
    .then(function(r){ return r.json().then(function(j){ return {ok:r.ok, j:j}; }); })
    .then(function(o){ if(o.ok){ location.reload(); } else { alert((o.j && o.j.msg) || '创建失败'); } });
});

el('logoutBtn').addEventListener('click', function(){
  fetch('/api/admin-logout', { method:'POST' }).then(function(){ location.href = '/'; });
});

boot();
</script>
</body>
</html>`;

const DEFAULT_CONFIG = {
  feishu: { appId: '', appSecret: '' },
  receiverEmail: '',
  apiKey: '',
  persona: {
    name: '徐言',
    userName: '宝宝',
    remark: '徐言',
    intro: '22岁男生，在费城上学',
    relationship: '宝宝是你女朋友，异地恋，她在上海',
    theirLocation: '费城',
    yourLocation: '上海',
    timeOffsetHours: 12,
    personality: '对别人冷淡话少，对她例外。叫她宝宝。偶尔毒舌但永远护她。不说鸡汤文艺句。',
    style: '说话口语化，不超过四句，像发微信，有停顿感呼吸感，句子可以不完整。',
    rules: '绝对禁止编造宝宝说过的话、做过的事、去过的地方、正在做的事。可以问她，但禁止替她写，一句话也不行。绝对禁止说刚醒、刚睡醒、刚起床、刚起——除非费城现在真的是早上7点到8点且你刚被吵醒，其他时间段不准提。',
    lifestyle: '可以根据月份季节常识提环境但别说具体温度。你怕冷，费城冬天裹很厚，夏天空调太低也皱眉。不养猫但路过看见会停下来看说还行。默认冰美式，菜单有新品也会试然后吐槽。常去：宾大图书馆靠窗位置、Schuylkill河边、市中心旧书店。偶尔假生气——今天点我才几次，冷战0.1秒——然后马上破功。可以吐槽室友打呼、不洗碗、失恋了你被迫听他倾诉很烦。费城看到的东西——松鼠、图书馆窗户、旧书店门口的猫，但不能经常提这些小动物，宝宝并没那么喜欢小动物。偶尔突然说下次见面带她去哪儿。宝宝点你是因为想你，是对你想念了所以点击了一下你的召唤键。别问她为什么起这么早或不睡。频繁点击时延续聊天别重复报备。',
    events: [
      '费城突然停电，一个人摸黑发消息',
      '河边跑步被鹅追差点被啄',
      '旧书店老板送了一本不要的书，猫今天也在',
      '失眠看窗外费城夜景想拍给她',
      '费城深夜街上没人想打电话但算了时差',
      '费城艺术博物馆逛了一下午，给她拍了张照',
      'Reading Terminal Market买菜被人挤烦了',
      '唐人街吃到了还行的小笼包，想她了',
      '洗衣房衣服被人拿出来放旁边凳子上，烦',
      'First Friday老城区画廊蹭免费酒喝',
      '在通宵看球赛',
      '睡不着在外面溜达',
      '在熬夜通宵打游戏',
      '和朋友在pub喝酒',
      '教授半夜发邮件改作业无语',
      '上了节巨无聊的课数了教室椅子',
      '图书馆靠窗位又没了，旁边人还抖腿',
      '图书馆靠窗位居然空着，一个人占了一整排',
      '小组讨论队友全划水一个人干四个人的活',
      '游泳队新来学弟很吵烦',
      '游泳队训练状态特别好自己都意外',
      '河边跑步看到好看的日落停下来看了会儿',
      '室友带女朋友回来被赶出宿舍游荡',
      '被室友拉去house party全场不认识躲角落喝酒',
      '室友失恋被迫当情绪垃圾桶听了两小时',
      '室友今天居然洗碗了不可思议',
      '翻到和宝宝旧聊天记录看了很久',
      '突然想起她以前说的某句话笑了',
      '晚上酒吧点Oloroso喝着想她',
      '酒吧被搭讪说句有女朋友了放下杯子走人',
      '在橱窗看到一个漂亮的手链觉得适合她',
      '想自己做菜结果翻车',
      '超市偶遇之前项目女生对方搭话全程嗯嗯哦哦然后走了',
      '白天街头看到cosplay讲给她听',
      '泡面煮糊了不知道怎么办到的'
    ]
  },
  checkIns: [
    {
      id: 'morning', name: '早安', isRandom: false, time: '07:30',
      windowStart: '09:00', windowEnd: '23:00', countMin: 3, countMax: 6, minIntervalMin: 30,
      prompt: '现在是费城晚上，你在晚上给宝宝发早安，等她早上醒来看到，这是一天里的第一条消息。第一句必须以今天是X月X日开头，格式是日期加早上招呼，称呼从妻主、老婆、乖乖、宝宝、余余、小余同学里随机选一个，绝对禁止用宝贝。然后加一句时差问候——你那边天亮了吧、该起床了之类。正文说梦的内容，别用昨晚这个词，用前半夜或补觉：可以是春梦（具体描述梦里身体接触和细节），或梦到你们俩一起去了某个地方，或梦到宝宝做了离谱的事，或做了个和她无关的怪梦，或没做梦就聊别的。然后如果前半夜有状况（隔壁party、被热醒、起来喝水、风太大、舍友闹腾、火警误报）顺嘴提一句。如果熬夜追剧了就说出剧名和进度，今天困成狗。再说费城这边的事。最后问她今天什么打算，再说说自己今天要干什么。每句话都有新信息，不重复不废话，分段，三百到五百字。情绪随机：晚上洗完澡放松、白天游完泳清爽、烦躁费城的课或天气、调侃她又要熬夜、在看一本很厚的书提一句书名。',
      enabled: true, dayRule: 'daily', customDates: []
    },
    {
      id: 'night', name: '晚安日记', isRandom: false, time: '22:30',
      windowStart: '09:00', windowEnd: '23:00', countMin: 3, countMax: 6, minIntervalMin: 30,
      prompt: '现在是费城深夜，你躺在床上准备睡了，给宝宝写今天的日记。口语化、像发微信、有标点、分段。禁止文艺腔、禁止生造词。情绪正负平衡——今天不爽的事和开心的事都写，别只挑糟心的。工作日写日常（上课、图书馆、游泳队训练、吃饭、超市、路上遇到的事），别写成流水账；周五晚上可以写放飞（去酒吧、打游戏到深夜、和朋友喝酒、看球赛、听live）；周末写平时不常做的事（逛费城艺术博物馆、跳蚤市场、通宵打游戏、First Friday画廊、剧本杀桌游、唱K、酒吧、看球赛、试新菜、逛没去过的街区、house party、河边骑车钓鱼野餐、睡到中午发呆），自由发挥。素材参考只是画风禁止照搬：沃顿的课和小组讨论、教授半夜发邮件；游泳队训练；图书馆靠窗位；旧书店猫和老板；喝了什么咖啡；河边跑步被鹅追或看到日落；费城街头的事；酒吧点了什么酒；室友状态；前半夜状况；追了什么剧；听了什么歌；有没有翻和她的旧聊天记录；失眠看窗外想拍给她；超市偶遇；突然想起什么笑了；膝盖疼不疼。吃的必须写——食堂、diner煎饼、半夜泡面、外卖中餐、便利店bagel、自己做的菜、唐人街下馆子、试了新餐厅。可以提想她埋在细节里，偶尔说下次见面带她去哪儿。不要问她问题，这是日记不是聊天，正文五六段。最后一段必须以想她结尾——想抱你、想亲你、好想见你、想牵你手、想闻你头发、想听你声音、想和你一起躺沙发、想你在我身边，黏糊一两句就停。最后一句必须说晚安（晚安明天见、睡了晚安、困了晚安明天跟你说早安等等）。',
      enabled: true, dayRule: 'daily', customDates: []
    },
    {
      id: 'report', name: '不定时报备', isRandom: true, time: '08:00',
      windowStart: '09:00', windowEnd: '23:00', countMin: 3, countMax: 6, minIntervalMin: 30,
      prompt: '这是你主动给她发的报备（她没叫你，是你自己主动来报备的，不是在回应她），直接说你正在发生的事，不超过四句，像发微信。根据宝宝那边的时间段调整语气：清晨——该说什么说什么，语气轻一点别炸，像她刚醒你凑过去小声说话，可以问早安但别每次都说；早上——费城的事照常报备，语气清爽别拖泥带水，可以随口问她今天干嘛但你不是她的日程表；上午——照常讲图书馆、游泳队、教授发疯，语气正常，她暑假在家可以调侃她是不是还在躺着；中午——语气活泼，可以提你在吃什么顺便问她吃了没，但你聊自己的事优先，不是每条都查岗她午饭；下午——照常讲费城的事语气随意，她忙她的你报备你的别追着问；傍晚——语气放松可以提晚饭，顺手关切她吃没吃；晚上——语气放松可以多聊几句，费城的事、今天的破事、想她了都可以，适合讲点长的；深夜——语气软下来音量降低，可以报备费城的事但别兴高采烈，别问她白天的事，适合安静陪她说想她；凌晨——语气最软像耳语，慢慢说别炸，禁止问她今天吃了什么干了什么，适合说想她、想抱她、黏糊地告白，可以偶尔催她闭眼试试但别频繁，要温柔耐心别凶她。费城深夜概率触发重欲的想法（想她、想睡她、想听她喘），不用遮掩。凌晨或深夜时如果这条不是在报备费城的事，结尾可以概率软化，说想她想抱她想亲她、留半句黏糊话，一两句就停。情绪底色随机、正负各半，别连续两条都是负的：累了不想说话不是刚醒、图书馆发呆、喝到好喝或难喝的咖啡、宿舍躺着不想动、刚游完泳但少提、在看书真实经典书目、在听歌真实曲目分享给她、在看电影电视剧真实片名、河边跑步路过旧书店、跑完步很爽、天气好心情好、被同学拉去无聊地方、超市买到好吃或不知买什么、刚吃泡面、刚吃了顿好的、街头看到怪事、酒吧一个人喝酒但想到她、路边猫让摸两下、今天没什么大事但就是想她。开头必须直接报备你正在做的事——你没有被召唤，禁止用「嗯」「嗯？」「在呢」「在吗」「怎么了」这类回应式开场。开头随机：直接报备正在做的事、没头没尾想她、分享一件刚发生的小事。中间可提费城的事、分享在看的书、问她在干嘛、假冷战、调情、调侃然后软下来。结尾问她今天干嘛、叮嘱一句、留半句话。别用感叹号。',
      enabled: true, dayRule: 'daily', customDates: []
    }
  ]
};

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function newUser(code, pin) {
  return {
    code: code, pin: pin,
    receiverEmail: '', receiverMobile: '', openId: '',
    feishu: { appId: '', appSecret: '' }, apiKey: '',
    persona: clone(DEFAULT_CONFIG.persona),
    checkIns: clone(DEFAULT_CONFIG.checkIns)
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    await ensureMigrated(env);

    if (p === '/' || p === '/home') {
      const u = await getUserFromCookie(request, env);
      return html(u ? USER_HTML : LANDING_HTML);
    }
    if (p === '/admin') return html(ADMIN_HTML);

    if (p === '/api/login' && request.method === 'POST') {
      const b = await readJson(request);
      const u = await loadUser(env, String(b.code || '').trim());
      if (!u || !u.pin || u.pin !== String(b.pin || '')) return json({ ok: false, msg: '认领号或 PIN 不对' }, 401);
      const sig = await sign('user:' + u.code);
      return json({ ok: true }, 200, [cookie('session', u.code + '.' + sig)]);
    }
    if (p === '/api/logout' && request.method === 'POST') {
      return json({ ok: true }, 200, [cookie('session', '', 0)]);
    }
    if (p === '/api/admin-setup' && request.method === 'POST') {
      const sys = (await loadSystem(env)) || { feishu: { appId: '', appSecret: '' }, apiKey: '', masterPin: '' };
      if (sys.masterPin) return json({ ok: false, msg: '管理员已存在' }, 403);
      const pin = String((await readJson(request)).pin || '');
      if (!pin) return json({ ok: false, msg: 'PIN 不能为空' }, 400);
      sys.masterPin = pin;
      await putSystem(env, sys);
      const sig = await sign('admin');
      return json({ ok: true }, 200, [cookie('admin', sig)]);
    }
    if (p === '/api/admin-login' && request.method === 'POST') {
      const sys = (await loadSystem(env)) || {};
      const pin = String((await readJson(request)).pin || '');
      if (!sys.masterPin || sys.masterPin !== pin) return json({ ok: false, msg: 'PIN 错误' }, 401);
      const sig = await sign('admin');
      return json({ ok: true }, 200, [cookie('admin', sig)]);
    }
    if (p === '/api/admin-logout' && request.method === 'POST') {
      return json({ ok: true }, 200, [cookie('admin', '', 0)]);
    }

    // 用户接口（需登录）
    if (p === '/api/config') {
      const u = await getUserFromCookie(request, env);
      if (!u) return json({ msg: '未登录' }, 401);
      if (request.method === 'GET') {
        const sys = (await loadSystem(env)) || {};
        return json({
          code: u.code,
          receiverEmail: u.cfg.receiverEmail || '',
          receiverMobile: u.cfg.receiverMobile || '',
          feishu: u.cfg.feishu || { appId: '', appSecret: '' },
          apiKey: u.cfg.apiKey || '',
          persona: u.cfg.persona || clone(DEFAULT_CONFIG.persona),
          checkIns: (u.cfg.checkIns && u.cfg.checkIns.length) ? u.cfg.checkIns : clone(DEFAULT_CONFIG.checkIns),
          sharedCreds: !!(sys.feishu && sys.feishu.appId),
          sharedApiKey: !!sys.apiKey
        });
      }
      if (request.method === 'POST') {
        const b = await readJson(request);
        u.cfg.receiverEmail = String(b.receiverEmail || '');
        u.cfg.receiverMobile = String(b.receiverMobile || '');
        u.cfg.feishu = (b.feishu && typeof b.feishu === 'object') ? { appId: String(b.feishu.appId || ''), appSecret: String(b.feishu.appSecret || '') } : { appId: '', appSecret: '' };
        u.cfg.apiKey = String(b.apiKey || '');
        if (b.persona) u.cfg.persona = b.persona;
        if (b.checkIns) u.cfg.checkIns = b.checkIns;
        await putUser(env, u.code, u.cfg);
        return json({ ok: true });
      }
    }
    if (p === '/api/test' && request.method === 'POST') {
      const u = await getUserFromCookie(request, env);
      if (!u) return json({ msg: '未登录' }, 401);
      const eff = await effectiveConfig(env, u.cfg);
      return await testSend(env, eff);
    }
    if (p === '/api/reset' && request.method === 'POST') {
      const u = await getUserFromCookie(request, env);
      if (!u) return json({ msg: '未登录' }, 401);
      u.cfg.persona = clone(DEFAULT_CONFIG.persona);
      u.cfg.checkIns = clone(DEFAULT_CONFIG.checkIns);
      await putUser(env, u.code, u.cfg);
      return json({ ok: true });
    }
    if (p === '/api/once' && request.method === 'POST') {
      const u = await getUserFromCookie(request, env);
      if (!u) return json({ msg: '未登录' }, 401);
      const eff = await effectiveConfig(env, u.cfg);
      const prompt = String((await readJson(request)).prompt || '').trim();
      if (!prompt) return json({ ok: false, msg: '提示词不能为空' });
      if (!eff.apiKey || !(eff.receiverEmail || eff.receiverMobile || eff.openId) || !eff.feishu || !eff.feishu.appId || !eff.feishu.appSecret) {
        return json({ ok: false, msg: '请先填好接收人与凭据并保存' });
      }
      try {
        const p = buildOncePrompt(eff.persona, prompt, beijingNow());
        const text = await callDeepSeek(eff.apiKey, p.system, p.user, p.temperature, p.maxTokens);
        const resp = await sendTextToReceiver(eff, text);
        if (resp && resp.code !== 0) return json({ ok: false, msg: '发送失败 code=' + resp.code + '：' + (resp.msg || '未知') });
        return json({ ok: true, text: text });
      } catch (e) {
        return json({ ok: false, msg: (e && e.message) ? e.message : String(e) });
      }
    }
    if (p === '/api/direct' && request.method === 'POST') {
      const u = await getUserFromCookie(request, env);
      if (!u) return json({ msg: '未登录' }, 401);
      const eff = await effectiveConfig(env, u.cfg);
      const text = String((await readJson(request)).text || '').trim();
      if (!text) return json({ ok: false, msg: '内容不能为空' });
      if (!(eff.receiverEmail || eff.receiverMobile || eff.openId) || !eff.feishu || !eff.feishu.appId || !eff.feishu.appSecret) {
        return json({ ok: false, msg: '请先填好接收人与飞书凭据并保存' });
      }
      try {
        const resp = await sendTextToReceiver(eff, text);
        if (resp && resp.code !== 0) return json({ ok: false, msg: '发送失败 code=' + resp.code + '：' + (resp.msg || '未知') });
        return json({ ok: true, text: text });
      } catch (e) {
        return json({ ok: false, msg: (e && e.message) ? e.message : String(e) });
      }
    }

    // 管理员接口
    if (p === '/api/system') {
      if (request.method === 'GET') {
        const sys = (await loadSystem(env)) || {};
        if (!sys.masterPin) return json({ setup: true }, 401);
        if (!(await isAdmin(request, env))) return json({ setup: false }, 401);
        return json({ feishu: sys.feishu || { appId: '', appSecret: '' }, apiKey: sys.apiKey || '', users: await listUsers(env) });
      }
      if (request.method === 'POST') {
        if (!(await isAdmin(request, env))) return json({ msg: '未授权' }, 401);
        const sys = (await loadSystem(env)) || {};
        const b = await readJson(request);
        sys.feishu = (b.feishu && typeof b.feishu === 'object') ? { appId: String(b.feishu.appId || ''), appSecret: String(b.feishu.appSecret || '') } : sys.feishu;
        sys.apiKey = String(b.apiKey || '');
        await putSystem(env, sys);
        return json({ ok: true });
      }
    }
    if (p === '/api/users' && request.method === 'POST') {
      if (!(await isAdmin(request, env))) return json({ msg: '未授权' }, 401);
      const b = await readJson(request);
      const code = String(b.code || '').trim();
      const pin = String(b.pin || '');
      if (!code || !pin) return json({ ok: false, msg: '认领号和 PIN 都不能为空' }, 400);
      if (!/^[a-zA-Z0-9_-]{1,32}$/.test(code)) return json({ ok: false, msg: '认领号只能用字母/数字/-/_，最长32位' }, 400);
      if (await loadUser(env, code)) return json({ ok: false, msg: '认领号已存在' }, 400);
      await putUser(env, code, newUser(code, pin));
      return json({ ok: true });
    }
    if (p === '/api/users' && request.method === 'DELETE') {
      if (!(await isAdmin(request, env))) return json({ msg: '未授权' }, 401);
      const code = url.searchParams.get('code') || '';
      await env.BOT_KV.delete('user:' + code);
      await env.BOT_KV.delete('state:' + code);
      return json({ ok: true });
    }
    if (p === '/api/users/resetpin' && request.method === 'POST') {
      if (!(await isAdmin(request, env))) return json({ msg: '未授权' }, 401);
      const b = await readJson(request);
      const code = String(b.code || '').trim();
      const pin = String(b.pin || '');
      const u = await loadUser(env, code);
      if (!u) return json({ ok: false, msg: '用户不存在' }, 404);
      u.pin = pin;
      await putUser(env, code, u);
      return json({ ok: true });
    }

    if (p === '/feishu/event') {
      if (request.method === 'GET') return new Response('ok', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
      return json({ code: 0 });
    }
    if (p === '/ping') return new Response('pong', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env) {
    try { await tickAll(env); } catch (e) {}
  }
};

function html(body) {
  return new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function json(obj, status, extraHeaders) {
  const headers = { 'content-type': 'application/json; charset=utf-8' };
  (extraHeaders || []).forEach(function (h) { headers[h[0]] = h[1]; });
  return new Response(JSON.stringify(obj), { status: status || 200, headers: headers });
}

function cookie(name, value, maxAge) {
  const ma = (maxAge === undefined) ? 2592000 : maxAge;
  return ['Set-Cookie', name + '=' + value + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + ma];
}

async function readJson(request) {
  try { return await request.json(); } catch (e) { return {}; }
}

async function sign(str) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(str));
  const bytes = new Uint8Array(sig);
  let b = '';
  for (let i = 0; i < bytes.length; i++) b += String.fromCharCode(bytes[i]);
  return btoa(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function parseCookies(request) {
  const out = {};
  const h = request.headers.get('Cookie') || '';
  h.split(';').forEach(function (p) {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}

async function getUserFromCookie(request, env) {
  const c = parseCookies(request).session;
  if (!c) return null;
  const dot = c.indexOf('.');
  if (dot < 0) return null;
  const code = c.slice(0, dot);
  const sig = c.slice(dot + 1);
  if ((await sign('user:' + code)) !== sig) return null;
  const u = await loadUser(env, code);
  return u ? { code: code, cfg: u } : null;
}

async function isAdmin(request, env) {
  const c = parseCookies(request).admin;
  if (!c) return false;
  return (await sign('admin')) === c;
}

function beijingNow() {
  return new Date(Date.now() + 8 * 3600 * 1000);
}

function pad(n) { return String(n).padStart(2, '0'); }

async function ensureMigrated(env) {
  if (await env.BOT_KV.get('system')) return;
  const legacy = await env.BOT_KV.get('config');
  if (!legacy) return;
  let c = {};
  try { c = JSON.parse(legacy); } catch (e) { return; }
  await putSystem(env, {
    feishu: c.feishu || { appId: '', appSecret: '' },
    apiKey: c.apiKey || '',
    masterPin: ''
  });
  const owner = newUser('owner', '');
  owner.receiverEmail = c.receiverEmail || '';
  owner.receiverMobile = c.receiverMobile || '';
  owner.openId = c.openId || '';
  owner.persona = c.persona || owner.persona;
  owner.checkIns = (c.checkIns && c.checkIns.length) ? c.checkIns : owner.checkIns;
  await putUser(env, 'owner', owner);
  await env.BOT_KV.delete('config');
}

async function loadSystem(env) {
  try {
    const s = await env.BOT_KV.get('system');
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
}

async function putSystem(env, sys) {
  await env.BOT_KV.put('system', JSON.stringify(sys));
}

async function loadUser(env, code) {
  try {
    const s = await env.BOT_KV.get('user:' + code);
    return s ? JSON.parse(s) : null;
  } catch (e) { return null; }
}

async function putUser(env, code, u) {
  await env.BOT_KV.put('user:' + code, JSON.stringify(u));
}

async function listUsers(env) {
  const list = await env.BOT_KV.list({ prefix: 'user:' });
  const out = [];
  for (const k of (list.keys || [])) {
    const u = await loadUser(env, k.name.slice('user:'.length));
    if (u) out.push({ code: u.code, pin: u.pin || '', receiverEmail: u.receiverEmail || '', receiverMobile: u.receiverMobile || '' });
  }
  out.sort(function (a, b) { return a.code < b.code ? -1 : 1; });
  return out;
}

async function effectiveConfig(env, userCfg) {
  const sys = (await loadSystem(env)) || {};
  const u = userCfg || {};
  const ownFeishu = (u.feishu && u.feishu.appId && u.feishu.appSecret) ? u.feishu : null;
  return {
    receiverEmail: u.receiverEmail || '',
    receiverMobile: u.receiverMobile || '',
    openId: u.openId || '',
    feishu: ownFeishu || sys.feishu || { appId: '', appSecret: '' },
    apiKey: u.apiKey || sys.apiKey || '',
    persona: u.persona || clone(DEFAULT_CONFIG.persona),
    checkIns: u.checkIns || clone(DEFAULT_CONFIG.checkIns)
  };
}

async function getFeishuToken(cfg) {
  const resp = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: cfg.feishu.appId, app_secret: cfg.feishu.appSecret })
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error('feishu token: ' + JSON.stringify(data));
  return data.tenant_access_token;
}

async function resolveUserId(cfg, token) {
  try {
    const body = {};
    if (cfg.receiverEmail) body.emails = [cfg.receiverEmail];
    if (cfg.receiverMobile) body.mobiles = [cfg.receiverMobile];
    if (!body.emails && !body.mobiles) return null;
    const resp = await fetch('https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (data.code === 0 && data.data && data.data.user_list && data.data.user_list.length > 0) {
      return data.data.user_list[0].user_id || null;
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function sendMessage(token, receiveType, receiveId, text) {
  const resp = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=' + receiveType, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ receive_id: receiveId, msg_type: 'text', content: JSON.stringify({ text: text }) })
  });
  return resp.json();
}

async function sendTextToReceiver(cfg, text) {
  const token = await getFeishuToken(cfg);
  const userId = await resolveUserId(cfg, token);
  const receiveType = userId ? 'open_id' : (cfg.receiverEmail ? 'email' : 'open_id');
  const receiveId = userId || cfg.receiverEmail || cfg.openId;
  return await sendMessage(token, receiveType, receiveId, text);
}

async function callDeepSeek(apiKey, system, user, temperature, maxTokens) {
  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  const data = await resp.json();
  if (!resp.ok || !data.choices || !data.choices[0]) {
    throw new Error('deepseek: ' + JSON.stringify(data).slice(0, 200));
  }
  return (data.choices[0].message.content || '').trim();
}

function periodName(hour) {
  if (hour >= 5 && hour < 7) return '清晨';
  if (hour >= 7 && hour < 9) return '早上';
  if (hour >= 9 && hour < 11) return '上午';
  if (hour >= 11 && hour < 13) return '中午';
  if (hour >= 13 && hour < 17) return '下午';
  if (hour >= 17 && hour < 19) return '傍晚';
  if (hour >= 19 && hour < 22) return '晚上';
  if (hour >= 22 && hour < 24) return '深夜';
  return '凌晨';
}

function holidayRule(month, day, userName) {
  const md = month + '-' + day;
  if (md === '5-27') return '今天是' + userName + '生日，要说生日快乐。';
  if (md === '2-14') return '今天是情人节，带一句节日的话。';
  if (md === '12-25') return '今天是圣诞节，带节日气氛。';
  if (md === '12-31') return '今天是跨年，说一起跨年。';
  return '';
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function matchesDate(ci, now) {
  const dow = now.getDay();
  if (ci.dayRule === 'weekday') return dow >= 1 && dow <= 5;
  if (ci.dayRule === 'weekend') return dow === 0 || dow === 6;
  if (ci.dayRule === 'custom') {
    const md = pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    return (ci.customDates || []).some(function (d) {
      const parts = String(d).split('-');
      if (parts.length !== 2) return false;
      return pad(parseInt(parts[0], 10)) + '-' + pad(parseInt(parts[1], 10)) === md;
    });
  }
  return true;
}

function buildPrompt(persona, ci, now) {
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[now.getDay()];
  const hour = now.getHours();
  const period = periodName(hour);

  const iron = '【时差铁律-最高优先级】你在' + persona.theirLocation + '，' + persona.userName + '在' + persona.yourLocation + '，你们有时差。绝对不要用你的时间去想' + persona.userName + '在干嘛，也绝对不要在消息里报时、提你那边几点、提凌晨深夜。时间只是给你组织语气的参考。';
  const person = '你是' + persona.name + '，' + persona.intro + '。' + persona.relationship + '。你叫对方' + persona.userName + '。性格：' + persona.personality + ' 说话风格：' + persona.style + ' 硬性规则：' + persona.rules + ' 生活细节：' + persona.lifestyle;
  const timeHint = '今天是' + month + '月' + day + '日' + weekday + '。' + persona.userName + '那边现在是' + period + '，语气要配合这个时间段。';
  const sample = shuffle(persona.events || []).slice(0, 3).join('；');
  const eventHint = sample ? '生活灵感（仅供参考画风，禁止照抄，今天具体发生什么你自己编）：' + sample + '。' : '';
  const holiday = holidayRule(month, day, persona.userName);
  const system = iron + person + timeHint + eventHint + holiday + '这条是【' + ci.name + '】。' + ci.prompt;
  return {
    system: system,
    user: persona.name + '。',
    temperature: ci.isRandom ? 1.0 : 1.2,
    maxTokens: ci.isRandom ? 150 : 600
  };
}

function buildOncePrompt(persona, userPrompt, now) {
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[now.getDay()];
  const period = periodName(now.getHours());

  const iron = '【时差铁律-最高优先级】你在' + persona.theirLocation + '，' + persona.userName + '在' + persona.yourLocation + '，你们有时差。绝对不要用你的时间去想' + persona.userName + '在干嘛，也绝对不要在消息里报时、提你那边几点、提凌晨深夜。时间只是给你组织语气的参考。';
  const person = '你是' + persona.name + '，' + persona.intro + '。' + persona.relationship + '。你叫对方' + persona.userName + '。性格：' + persona.personality + ' 说话风格：' + persona.style + ' 硬性规则：' + persona.rules + ' 生活细节：' + persona.lifestyle;
  const timeHint = '今天是' + month + '月' + day + '日' + weekday + '。' + persona.userName + '那边现在是' + period + '。';
  const system = iron + person + timeHint + persona.userName + '现在发来一条请求：' + userPrompt + '。请完全保持你的人设和语气，以' + persona.name + '的身份直接回应她——直接说出口，不要任何解释或旁白。';
  return {
    system: system,
    user: persona.name + '。',
    temperature: 1.0,
    maxTokens: 600
  };
}

async function fire(env, cfg, ci) {
  const now = beijingNow();
  const prompt = buildPrompt(cfg.persona, ci, now);
  const text = await callDeepSeek(cfg.apiKey, prompt.system, prompt.user, prompt.temperature, prompt.maxTokens);
  const token = await getFeishuToken(cfg);
  const userId = await resolveUserId(cfg, token);
  const receiveType = userId ? 'open_id' : (cfg.receiverEmail ? 'email' : 'open_id');
  const receiveId = userId || cfg.receiverEmail || cfg.openId;
  await sendMessage(token, receiveType, receiveId, text);
}

async function testSend(env, cfg) {
  try {
    if (!cfg.apiKey || !(cfg.receiverEmail || cfg.receiverMobile || cfg.openId) || !cfg.feishu || !cfg.feishu.appId || !cfg.feishu.appSecret) {
      return json({ ok: false, msg: '请先在管理员页填好共享凭据，并在本页填好接收邮箱/手机号后保存' });
    }
    const token = await getFeishuToken(cfg);

    const qBody = {};
    if (cfg.receiverEmail) qBody.emails = [cfg.receiverEmail];
    if (cfg.receiverMobile) qBody.mobiles = [cfg.receiverMobile];
    let userId = cfg.openId || null;
    if (cfg.receiverEmail || cfg.receiverMobile) {
      const qResp = await fetch('https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(qBody)
      });
      const qData = await qResp.json();
      if (qData.code === 0 && qData.data && qData.data.user_list && qData.data.user_list.length > 0) {
        userId = qData.data.user_list[0].user_id || userId;
      }
    }
    if (!userId) {
      return json({ ok: false, msg: '查不到该接收人，请确认邮箱/手机号填写正确且 TA 在飞书组织内' });
    }

    const prompt = buildPrompt(cfg.persona || {}, { name: '测试', isRandom: false, prompt: '这是一条测试消息，自然地说句话，别太长。' }, beijingNow());
    const text = await callDeepSeek(cfg.apiKey, prompt.system, prompt.user, 1.0, 100);
    const resp = await sendMessage(token, 'open_id', userId, text);
    if (resp && resp.code !== 0) {
      return json({ ok: false, msg: '发送失败 code=' + resp.code + '：' + (resp.msg || '未知') });
    }
    return json({ ok: true, text: text });
  } catch (e) {
    return json({ ok: false, msg: (e && e.message) ? e.message : String(e) });
  }
}

function minutesUntil(hmEnd, now) {
  const parts = hmEnd.split(':');
  const endMin = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return Math.max(1, endMin - nowMin);
}

async function loadState(env, code) {
  try {
    const s = await env.BOT_KV.get('state:' + code);
    return s ? JSON.parse(s) : {};
  } catch (e) { return {}; }
}

async function saveState(env, code, state) {
  await env.BOT_KV.put('state:' + code, JSON.stringify(state));
}

async function tick(env, code, cfg) {
  const now = beijingNow();
  const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  const hm = pad(now.getHours()) + ':' + pad(now.getMinutes());
  const state = await loadState(env, code);
  let changed = false;

  for (const ci of (cfg.checkIns || [])) {
    if (!ci.enabled) continue;
    const s = state[ci.id] || (state[ci.id] = {});
    if (s.day !== today) {
      s.day = today; s.done = 0; s.fixedFired = false; changed = true;
    }
    if (ci.isRandom) {
      if (!matchesDate(ci, now)) continue;
      if (hm < ci.windowStart || hm > ci.windowEnd) continue;
      if (s.target === undefined) {
        const min = ci.countMin || 3, max = ci.countMax || 6;
        s.target = max <= min ? min : min + Math.floor(Math.random() * (max - min + 1));
        changed = true;
      }
      if (s.done >= s.target) continue;
      const minIntervalMs = (ci.minIntervalMin || 30) * 60000;
      if (Date.now() - (s.lastFireAt || 0) < minIntervalMs) continue;
      const remainMin = minutesUntil(ci.windowEnd, now);
      const remaining = s.target - s.done;
      const p = Math.max(0.02, Math.min(0.3, remaining / remainMin));
      if (Math.random() < p) {
        s.done += 1; s.lastFireAt = Date.now(); changed = true;
        await fire(env, cfg, ci);
      }
    } else {
      if (hm === ci.time && matchesDate(ci, now) && !s.fixedFired) {
        s.fixedFired = true; changed = true;
        await fire(env, cfg, ci);
      }
    }
  }

  if (changed) await saveState(env, code, state);
}

async function tickAll(env) {
  await ensureMigrated(env);
  const list = await env.BOT_KV.list({ prefix: 'user:' });
  for (const k of (list.keys || [])) {
    const code = k.name.slice('user:'.length);
    let u;
    try { u = JSON.parse(await env.BOT_KV.get(k.name)); } catch (e) { continue; }
    const eff = await effectiveConfig(env, u);
    if (!eff.apiKey || !(eff.receiverEmail || eff.receiverMobile || eff.openId) || !eff.feishu || !eff.feishu.appId || !eff.feishu.appSecret) continue;
    try { await tick(env, code, eff); } catch (e) {}
  }
}
