<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Twogende API console</title>
{{--
  Deliberately plain. This is a local-only backend harness, not product UI
  the product's look comes from the Claude Design project and lives in
  ../mobile. Nothing here should be treated as a visual reference.
--}}
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font: 13px/1.5 ui-monospace, Menlo, Consolas, monospace; background: #16130f; color: #e8e2d6; }
  header { padding: 10px 16px; border-bottom: 1px solid #322b22; display: flex; gap: 16px; align-items: center; }
  header b { font-size: 14px; }
  .muted { color: #8b8172; }
  main { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #322b22; min-height: calc(100vh - 43px); }
  section { background: #16130f; padding: 14px 16px; overflow: auto; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #8b8172; margin: 0 0 10px; }
  button { font: inherit; background: #2a2318; color: #e8e2d6; border: 1px solid #453a2c; border-radius: 5px; padding: 5px 9px; cursor: pointer; }
  button:hover { background: #3a3122; }
  button.go { background: #c0512e; border-color: #c0512e; color: #fff; }
  input, textarea { font: inherit; width: 100%; background: #0f0d0a; color: #e8e2d6; border: 1px solid #453a2c; border-radius: 5px; padding: 6px 8px; }
  textarea { min-height: 108px; resize: vertical; }
  .row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
  .field { margin-bottom: 8px; }
  pre { background: #0f0d0a; border: 1px solid #2a2318; border-radius: 5px; padding: 10px; overflow: auto; margin: 0; white-space: pre-wrap; word-break: break-word; }
  .pill { display: inline-block; padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .ok { background: #24391f; color: #9bd47f; }
  .err { background: #3d211c; color: #f0917c; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  th, td { text-align: left; padding: 3px 8px 3px 0; border-bottom: 1px solid #241e17; white-space: nowrap; }
  th { color: #8b8172; font-weight: 600; }
  details { margin-bottom: 10px; }
  summary { cursor: pointer; color: #cf9a45; }
  .msg { border: 1px solid #453a2c; border-radius: 5px; padding: 8px; margin-bottom: 6px; }
  code.code { font-size: 15px; color: #cf9a45; font-weight: 700; }
</style>
</head>
<body>

<header>
  <b>Twogende API console</b>
  <span class="muted">local only · SMS driver: {{ $smsDriver }}</span>
  <span id="auth" class="muted">no token</span>
  <button onclick="clearToken()">Clear token</button>
  <button onclick="seed()">Seed demo data</button>
  <button onclick="reset()">Reset database</button>
</header>

<main>
  <section>
    <h2>Request</h2>
    <div class="row">
      <button onclick="preset('POST','/api/v1/auth/otp',{phone:'0701234567'})">request code</button>
      <button onclick="preset('POST','/api/v1/auth/otp/verify',{phone:'0701234567',code:''})">verify code</button>
      <button onclick="preset('GET','/api/v1/me',null)">me</button>
      <button onclick="preset('PATCH','/api/v1/me',{name:'Achen Grace'})">set name</button>
      <button onclick="preset('GET','/api/v1/trips',null)">trips</button>
      <button onclick="preset('POST','/api/v1/auth/logout',null)">logout</button>
    </div>
    <div class="field"><input id="method" value="POST" style="width:80px;display:inline-block"> <input id="path" value="/api/v1/auth/otp" style="width:calc(100% - 92px);display:inline-block"></div>
    <div class="field"><textarea id="body">{
  "phone": "0701234567"
}</textarea></div>
    <div class="row"><button class="go" onclick="send()">Send</button></div>

    <h2 style="margin-top:16px">Response <span id="status"></span></h2>
    <pre id="response">—</pre>
  </section>

  <section>
    <h2>SMS outbox <button onclick="clearOutbox()" style="float:right">clear</button></h2>
    <div id="outbox" class="muted">—</div>

    <h2 style="margin-top:18px">Database <span id="stamp" class="muted"></span></h2>
    <div id="state" class="muted">—</div>
  </section>
</main>

<script>
const OTP_LENGTH = {{ $otpLength }};
let token = null;

function preset(method, path, body) {
  document.getElementById('method').value = method;
  document.getElementById('path').value = path;
  document.getElementById('body').value = body ? JSON.stringify(body, null, 2) : '';
}

async function send() {
  const method = document.getElementById('method').value.trim().toUpperCase();
  const path = document.getElementById('path').value.trim();
  const raw = document.getElementById('body').value.trim();

  const headers = { 'Accept': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const init = { method, headers };
  if (raw && method !== 'GET') {
    headers['Content-Type'] = 'application/json';
    init.body = raw;
  }

  const started = performance.now();
  let res, payload;
  try {
    res = await fetch(path, init);
    payload = await res.json().catch(() => ({}));
  } catch (e) {
    document.getElementById('status').innerHTML = '<span class="pill err">network</span>';
    document.getElementById('response').textContent = String(e);
    return;
  }
  const ms = Math.round(performance.now() - started);

  const cls = res.ok ? 'ok' : 'err';
  document.getElementById('status').innerHTML =
    '<span class="pill ' + cls + '">' + res.status + '</span> <span class="muted">' + ms + 'ms</span>';
  document.getElementById('response').textContent = JSON.stringify(payload, null, 2);

  // Tokens are captured automatically so the next request is authenticated.
  if (payload && payload.token) {
    token = payload.token;
    document.getElementById('auth').textContent =
      'token: ' + (payload.user ? payload.user.name : '') + ' ' + token.slice(0, 12) + '…';
    document.getElementById('auth').className = '';
  }

  refresh();
}

function clearToken() {
  token = null;
  document.getElementById('auth').textContent = 'no token';
  document.getElementById('auth').className = 'muted';
}

async function refresh() {
  const [outbox, state] = await Promise.all([
    fetch('/dev/outbox').then(r => r.json()),
    fetch('/dev/state').then(r => r.json()),
  ]);

  document.getElementById('outbox').innerHTML = outbox.messages.length
    ? outbox.messages.map(m => {
        window.__lastPhone = window.__lastPhone || m.to;
        return '<div class="msg"><div class="muted">' + m.to + ' · ' + m.sent_at + '</div>' +
          (m.code ? '<code class="code">' + m.code + '</code> <button onclick="fillCode(\'' + m.to + '\',\'' + m.code + '\')">use</button><br>' : '') +
          '<span class="muted">' + m.message + '</span></div>';
      }).join('')
    : '<span class="muted">No messages yet.</span>';

  document.getElementById('stamp').textContent = new Date(state.generated_at).toLocaleTimeString();

  let html = '';
  for (const [name, rows] of Object.entries(state.tables)) {
    const count = state.counts[name] ?? rows.length;
    html += '<details' + (rows.length ? ' open' : '') + '><summary>' + name + ' (' + count + ')</summary>';
    if (!rows.length) {
      html += '<div class="muted">empty</div>';
    } else {
      const cols = Object.keys(rows[0]);
      html += '<table><tr>' + cols.map(c => '<th>' + c + '</th>').join('') + '</tr>';
      html += rows.map(r => '<tr>' + cols.map(c => '<td>' + fmt(r[c]) + '</td>').join('') + '</tr>').join('');
      html += '</table>';
    }
    html += '</details>';
  }
  document.getElementById('state').innerHTML = html;
}

function fmt(v) {
  if (v === null || v === undefined) return '<span class="muted">—</span>';
  if (v === true) return '<span class="pill ok">yes</span>';
  if (v === false) return '<span class="muted">no</span>';
  return String(v);
}

function fillCode(phone, code) {
  preset('POST', '/api/v1/auth/otp/verify', { phone, code });
}

async function clearOutbox() {
  await fetch('/dev/outbox', { method: 'DELETE' });
  refresh();
}

async function seed() {
  const r = await fetch('/dev/seed', { method: 'POST' }).then(r => r.json());
  document.getElementById('response').textContent = JSON.stringify(r, null, 2);
  refresh();
}

async function reset() {
  if (!confirm('Drop every table and re-run all migrations? All local data is lost.')) return;
  const r = await fetch('/dev/reset', { method: 'POST' }).then(r => r.json());
  clearToken();
  document.getElementById('response').textContent = JSON.stringify(r, null, 2);
  refresh();
}

refresh();
setInterval(refresh, 4000);
</script>
</body>
</html>
