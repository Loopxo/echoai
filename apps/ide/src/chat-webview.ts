import { randomBytes } from 'node:crypto';
import type * as vscode from 'vscode';

/**
 * Echo Agent panel markup.
 *
 * Styled entirely from the Echo monochrome token table rather than the VS Code
 * theme variables, so the panel matches the rest of the IDE chrome: zero border
 * radius, no shadows, JetBrains Mono, and white-on-black as the only accent.
 *
 * Layout mirrors the reference: a session tab strip on top, the thread in the
 * middle with collapsible tool and reasoning groups, a change bar, and a composer
 * carrying the context picker, model picker, mode, Max and Autopilot controls.
 */
export function renderChatWebview(webview: vscode.Webview): string {
	const nonce = randomBytes(16).toString('base64');
	const csp = [
		"default-src 'none'",
		`style-src ${webview.cspSource} 'nonce-${nonce}'`,
		`script-src 'nonce-${nonce}'`,
	].join('; ');

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style nonce="${nonce}">
:root {
  --bg-base: #000000;
  --bg-inset: #050505;
  --bg-raised: #0a0a0a;
  --hair: #1f1f1f;
  --mid: #2a2a2a;
  --strong: #5a5a5a;
  --full: #ffffff;
  --fg: #ffffff;
  --fg2: #8a8a8a;
  --fg3: #5a5a5a;
  --mono: 'Echo Mono', 'JetBrains Mono', ui-monospace, monospace;
}
* { box-sizing: border-box; border-radius: 0 !important; box-shadow: none !important; }
html, body { height: 100%; }
body {
  margin: 0; display: flex; flex-direction: column; height: 100vh;
  font-family: var(--mono); font-size: 12px; line-height: 1.6;
  color: var(--fg2); background: var(--bg-inset);
}
button, select, textarea, input { font: inherit; color: inherit; }
button { background: transparent; border: 0; cursor: pointer; }

/* ---------- session tabs ---------- */
.tabs { display: flex; align-items: stretch; min-height: 30px; border-bottom: 1px solid var(--hair); background: var(--bg-inset); }
.tabstrip { display: flex; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.tabstrip::-webkit-scrollbar { display: none; }
.tab {
  display: flex; align-items: center; gap: 6px; max-width: 190px; padding: 0 8px;
  border-right: 1px solid var(--hair); color: var(--fg3); font-size: 11px; white-space: nowrap;
}
.tab:hover { background: var(--bg-raised); color: var(--fg2); }
.tab.active { background: var(--bg-base); color: var(--fg); border-top: 2px solid var(--full); }
.tab-name { overflow: hidden; text-overflow: ellipsis; }
.tab-close { flex: none; padding: 0 2px; color: var(--fg3); font-size: 12px; line-height: 1; }
.tab-close:hover { color: var(--fg); }
.tabs-actions { display: flex; align-items: center; flex: none; padding: 0 6px; gap: 2px; border-left: 1px solid var(--hair); }
.tabs-actions button { padding: 3px 6px; color: var(--fg2); font-size: 13px; line-height: 1; }
.tabs-actions button:hover { background: var(--bg-raised); color: var(--fg); }

/* ---------- header ---------- */
.head { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-bottom: 1px solid var(--hair); }
.head-title { display: flex; align-items: center; gap: 7px; flex: 1; min-width: 0; }
.dot { width: 6px; height: 6px; flex: none; background: var(--full); }
.dot.busy { animation: pulse 1400ms linear infinite; }
.dot.idle { background: var(--strong); }
.dot.bad { background: var(--fg2); }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
.eyebrow { font-size: 9px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: var(--fg); }
.head-meta { overflow: hidden; color: var(--fg3); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; text-overflow: ellipsis; white-space: nowrap; }

/* ---------- thread ---------- */
.thread { flex: 1; overflow-y: auto; padding: 12px 10px 6px; background: var(--bg-inset); }
.msg { margin-bottom: 14px; }
.msg.user { display: flex; justify-content: flex-end; }
.msg.user .body { max-width: 88%; padding: 8px 10px; border: 1px solid var(--mid); background: var(--bg-raised); color: var(--fg); white-space: pre-wrap; overflow-wrap: anywhere; }
.msg.agent .body { padding-left: 10px; border-left: 2px solid var(--full); color: var(--fg2); white-space: pre-wrap; overflow-wrap: anywhere; }
.msg.agent .body strong.who { display: block; margin-bottom: 3px; color: var(--fg); font-size: 9px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
.attached { margin-top: 5px; color: var(--fg3); font-size: 10px; }

/* collapsible groups: "3 tool calls" / "Thought complete" */
.group { margin: 0 0 10px; }
.group-head { display: flex; align-items: center; gap: 6px; width: 100%; padding: 4px 0; color: var(--fg3); font-size: 11px; text-align: left; }
.group-head:hover { color: var(--fg); }
.chev { display: inline-block; width: 9px; flex: none; transition: none; }
.group.open .chev { transform: rotate(90deg); }
.group-body { display: none; margin-top: 4px; padding-left: 15px; border-left: 1px solid var(--hair); }
.group.open .group-body { display: block; }

.tool { margin-bottom: 8px; padding: 7px 8px; border: 1px solid var(--hair); background: var(--bg-raised); }
.tool.failed { border-color: var(--strong); }
.tool-head { display: flex; justify-content: space-between; gap: 8px; color: var(--fg); font-size: 11px; }
.tool-state { color: var(--fg3); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; }
.cap { margin: 6px 0 2px; color: var(--fg3); font-size: 9px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
.pre { max-height: 200px; overflow: auto; color: var(--fg2); font-size: 11px; white-space: pre-wrap; overflow-wrap: anywhere; }
.tool-links { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.chip-btn { padding: 2px 6px; border: 1px solid var(--mid); color: var(--fg2); font-size: 10px; }
.chip-btn:hover { border-color: var(--full); color: var(--fg); }

/* plan checklist: 12px squares, filled when done */
.plan { margin-bottom: 12px; }
.plan-row { display: flex; align-items: flex-start; gap: 7px; margin: 4px 0; color: var(--fg2); font-size: 11px; }
.box { width: 12px; height: 12px; flex: none; margin-top: 3px; border: 1px solid var(--strong); }
.box.done { background: var(--full); border-color: var(--full); }
.box.active { border-color: var(--full); }
.plan-row.done { color: var(--fg3); }

.turn { margin: 0 0 12px; color: var(--fg3); font-size: 9px; letter-spacing: .14em; text-transform: uppercase; text-align: right; }
.err { margin-bottom: 12px; padding: 8px 10px; border: 1px solid var(--strong); color: var(--fg); white-space: pre-wrap; }
.empty { padding: 34px 14px; color: var(--fg3); text-align: center; }
.empty .wordmark { margin-bottom: 6px; color: var(--fg); font-size: 26px; font-weight: 800; letter-spacing: -0.03em; }
.empty .rule { width: 54px; height: 2px; margin: 12px auto; background: var(--full); }
.empty p { margin: 0; font-size: 11px; }

/* ---------- change bar ---------- */
.changes { display: none; align-items: center; gap: 8px; padding: 6px 10px; border-top: 1px solid var(--hair); background: var(--bg-raised); }
.changes.on { display: flex; }
.changes .count { flex: 1; color: var(--fg2); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
.changes button { padding: 3px 8px; border: 1px solid var(--mid); color: var(--fg2); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; }
.changes button:hover { border-color: var(--full); color: var(--fg); }
.changes .x { border: 0; padding: 3px 4px; font-size: 12px; }

/* ---------- composer ---------- */
.composer { flex: none; padding: 8px 10px 10px; border-top: 1px solid var(--hair); background: var(--bg-inset); }
.ctx-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
.ctx-chip { display: flex; align-items: center; gap: 5px; padding: 2px 6px; border: 1px solid var(--mid); color: var(--fg2); font-size: 10px; letter-spacing: .06em; text-transform: uppercase; }
.ctx-chip button { color: var(--fg3); font-size: 11px; line-height: 1; }
.ctx-chip button:hover { color: var(--fg); }
.box-input { position: relative; border: 1px solid var(--mid); background: var(--bg-base); }
.box-input:focus-within { border-color: var(--full); }
textarea {
  display: block; width: 100%; min-height: 52px; max-height: 190px; resize: vertical;
  /* Right padding clears the send button, which sits on the first text line. */
  padding: 8px 38px 4px 9px; background: transparent; border: 0; outline: none; color: var(--fg);
}
textarea::placeholder { color: var(--fg3); }

/* Send sits on the placeholder line, top-right, not down beside Autopilot. */
.send {
  position: absolute; top: 6px; right: 6px; z-index: 2;
  width: 24px; height: 24px; flex: none;
  background: var(--full); color: var(--bg-base); font-size: 13px; line-height: 1;
}
.send:hover { background: var(--fg2); }
.send:disabled { background: var(--strong); color: var(--bg-base); cursor: default; }

/*
 * The control row has to survive a narrow panel. It wraps instead of overflowing,
 * every child may shrink, and the model name truncates rather than reflowing onto
 * three lines and pushing the toggle outside the box.
 */
.row {
  display: flex; align-items: center; flex-wrap: wrap; gap: 2px 4px;
  padding: 4px 5px 5px; overflow: hidden;
}
.row .spacer { flex: 1 1 auto; min-width: 0; }
.iconbtn { flex: none; padding: 3px 5px; color: var(--fg2); font-size: 12px; line-height: 1; }
.iconbtn:hover { color: var(--fg); background: var(--bg-raised); }
.pick {
  display: flex; align-items: center; gap: 4px; min-width: 0; max-width: 100%;
  padding: 3px 6px; color: var(--fg2); font-size: 10px; letter-spacing: .06em;
}
.pick:hover { color: var(--fg); background: var(--bg-raised); }
.pick .caret { flex: none; color: var(--fg3); font-size: 8px; }
.pick > span:first-child {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
#modelBtn { flex: 0 1 auto; }
#modelLabel { max-width: 130px; }
#maxBtn, #modeBtn { flex: none; }
.toggle {
  display: flex; align-items: center; gap: 5px; flex: none;
  color: var(--fg2); font-size: 10px; letter-spacing: .06em; text-transform: uppercase;
}
.switch { width: 24px; height: 12px; flex: none; padding: 1px; border: 1px solid var(--strong); }
.switch span { display: block; width: 8px; height: 8px; background: var(--strong); }
.toggle.on .switch { border-color: var(--full); }
.toggle.on .switch span { margin-left: 12px; background: var(--full); }

/* Below this width the labels are dropped before anything can collide. */
@media (max-width: 330px) {
  .toggle .label-text { display: none; }
  #modelLabel { max-width: 84px; }
}

/* ---------- account row ---------- */
.account { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--hair); }
.account .who { flex: 1; min-width: 0; overflow: hidden; color: var(--fg2); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; text-overflow: ellipsis; white-space: nowrap; }
.account:not(.out) .who { cursor: pointer; }
.account:not(.out) .who:hover { color: var(--fg); }
.account button { padding: 3px 8px; border: 1px solid var(--mid); color: var(--fg2); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; }
.account button:hover { border-color: var(--full); color: var(--fg); }
.account.out { background: var(--bg-raised); }
.account.out button { background: var(--full); border-color: var(--full); color: var(--bg-base); }
.account.out button:hover { background: var(--fg2); }

/* ---------- in-panel history ---------- */
.history { position: absolute; top: 0; right: 0; bottom: 0; left: 0; z-index: 30; display: none; flex-direction: column; background: var(--bg-inset); }
.history.on { display: flex; }
.history-head { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-bottom: 1px solid var(--hair); }
.history-head .t { flex: 1; color: var(--fg); font-size: 9px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
.history-head button { padding: 3px 5px; color: var(--fg2); font-size: 12px; }
.history-head button:hover { color: var(--fg); }
.history-list { flex: 1; overflow-y: auto; }
.hist-row { display: block; width: 100%; padding: 8px 10px; border-bottom: 1px solid var(--hair); text-align: left; }
.hist-row:hover { background: var(--bg-raised); }
.hist-row .title { display: block; overflow: hidden; color: var(--fg); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.hist-row .sub { display: block; margin-top: 2px; color: var(--fg3); font-size: 9px; letter-spacing: .1em; text-transform: uppercase; }
.hist-row.open .title::after { content: ' \\2022 open'; color: var(--fg3); }
.hist-empty { padding: 24px 12px; color: var(--fg3); font-size: 11px; text-align: center; }
.shell { position: relative; display: flex; flex-direction: column; flex: 1; min-height: 0; }

/* ---------- dropdown menus ---------- */
.menu { position: fixed; z-index: 40; display: none; min-width: 200px; max-height: 340px; overflow-y: auto; border: 1px solid var(--mid); background: var(--bg-raised); }
.menu.on { display: block; }
.menu-title { padding: 7px 10px 5px; color: var(--fg3); font-size: 9px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; border-bottom: 1px solid var(--hair); }
.menu-group { padding: 7px 10px 3px; color: var(--fg3); font-size: 9px; letter-spacing: .18em; text-transform: uppercase; }
.menu-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 6px 10px; color: var(--fg2); font-size: 11px; text-align: left; }
.menu-item:hover { background: var(--full); color: var(--bg-base); }
.menu-item .tick { width: 10px; flex: none; color: inherit; }
.menu-item .sub { margin-left: auto; color: var(--fg3); font-size: 9px; letter-spacing: .1em; text-transform: uppercase; }
.menu-item:hover .sub { color: var(--bg-base); }
.menu-item.off { color: var(--fg3); }
.menu-item.off .sub { color: var(--fg3); }
</style>
</head>
<body>
  <div class="tabs">
    <div class="tabstrip" id="tabstrip"></div>
    <div class="tabs-actions">
      <button id="newTab" title="New chat" aria-label="New chat">+</button>
      <button id="historyBtn" title="Chat history" aria-label="Chat history">&#9776;</button>
    </div>
  </div>

  <div class="account out" id="account">
    <span class="who" id="accountWho">Not signed in</span>
    <button id="accountBtn">Sign in</button>
  </div>

  <div class="head">
    <div class="head-title">
      <span class="dot idle" id="dot"></span>
      <span class="eyebrow">Echo Agent</span>
    </div>
    <span class="head-meta" id="meta"></span>
  </div>

  <div class="shell">
    <div class="thread" id="thread" aria-live="polite"></div>

    <div class="history" id="historyPanel">
      <div class="history-head">
        <span class="t">Chat history</span>
        <button id="historyClose" title="Close" aria-label="Close history">&#10005;</button>
      </div>
      <div class="history-list" id="historyList"></div>
    </div>
  </div>

  <div class="changes" id="changes">
    <span class="count" id="changeCount"></span>
    <button id="viewChanges">View changes</button>
    <button id="revertChanges">Revert changes</button>
    <button class="x" id="dismissChanges" title="Dismiss" aria-label="Dismiss">&#10005;</button>
  </div>

  <div class="composer">
    <div class="ctx-chips" id="chips"></div>
    <div class="box-input">
      <button class="send" id="send" title="Send" aria-label="Send">&#8593;</button>
      <textarea id="prompt" rows="2" aria-label="Message Echo Agent" placeholder="Describe a change, or / for commands..."></textarea>
      <div class="row">
        <button class="iconbtn" id="ctxBtn" title="Add context" aria-label="Add context">#</button>
        <button class="iconbtn" id="attachBtn" title="Attach files" aria-label="Attach files">&#128206;</button>
        <button class="pick" id="modelBtn" aria-label="Select model"><span id="modelLabel">Model</span><span class="caret">&#9662;</span></button>
        <button class="pick" id="maxBtn" aria-label="Select reasoning effort"><span id="maxLabel">Medium</span><span class="caret">&#9662;</span></button>
        <span class="spacer"></span>
        <button class="pick" id="modeBtn" aria-label="Select mode"><span id="modeLabel">Default</span><span class="caret">&#9662;</span></button>
        <button class="toggle" id="autopilot" aria-pressed="false" aria-label="Autopilot"><span class="label-text">Autopilot</span><span class="switch"><span></span></span></button>
      </div>
    </div>
  </div>

  <div class="menu" id="menu" role="menu"></div>

<script nonce="${nonce}">
const vscode = acquireVsCodeApi();
const $ = (id) => document.getElementById(id);
const thread = $('thread'), tabstrip = $('tabstrip'), menu = $('menu'), chips = $('chips');
const prompt = $('prompt'), send = $('send'), dot = $('dot'), meta = $('meta');

const CONTEXT_TYPES = [
  ['openFiles', 'Currently Open Files'],
  ['diagnostics', 'Diagnostics'],
  ['gitDiff', 'Git Diff'],
  ['file', 'File'],
  ['folder', 'Folder'],
  ['spec', 'Spec'],
  ['steering', 'Steering'],
  ['mcp', 'MCP'],
  ['terminal', 'Terminal'],
];
// A scale needs distinct rungs. "Max / Max High / Max Off" was three names for one
// idea, so this is an ordinary low-to-max effort scale.
const EFFORT_LEVELS = [
  ['low', 'Low', 'Short answers, minimal tool use'],
  ['medium', 'Medium', 'Balanced effort'],
  ['high', 'High', 'Longer answers, deeper tool use'],
  ['max', 'Max', 'No limit on reasoning or tool depth'],
];
const MODES = [
  ['default', 'Default', 'Build: plan, edit, test, review'],
  ['plan', 'Plan', 'Read-only: inspect and plan'],
];

function isObj(v) { return Boolean(v) && typeof v === 'object' && !Array.isArray(v); }

const saved = vscode.getState();
const restored = isObj(saved) && saved.version === 2 ? saved : {};
const ui = {
  version: 2,
  entries: Array.isArray(restored.entries) ? restored.entries.filter(isObj).slice(-200) : [],
  tools: isObj(restored.tools) ? restored.tools : Object.create(null),
  sessionId: typeof restored.sessionId === 'string' ? restored.sessionId : undefined,
  sessions: Array.isArray(restored.sessions) ? restored.sessions.filter(isObj) : [],
  models: Array.isArray(restored.models) ? restored.models.filter(isObj) : [],
  routing: isObj(restored.routing) ? restored.routing : undefined,
  mode: restored.mode === 'plan' ? 'plan' : 'default',
  effort: typeof restored.effort === 'string' ? restored.effort : 'medium',
  account: isObj(restored.account) ? restored.account : { signedIn: false },
  autopilot: restored.autopilot === true,
  context: Array.isArray(restored.context) ? restored.context.filter(isObj).slice(0, 40) : [],
  changes: Array.isArray(restored.changes) ? restored.changes.filter((v) => typeof v === 'string') : [],
  changesDismissed: restored.changesDismissed === true,
  status: 'stopped',
};
const nodes = new Map();
let activeAgentId, persistTimer, elapsedTimer, turnStartedAt;

function persist() {
  clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const snap = { ...ui, entries: ui.entries.slice(-200) };
    delete snap.status;
    let text = JSON.stringify(snap);
    while (text.length > 262144 && snap.entries.length > 20) {
      const gone = snap.entries.shift();
      if (gone && gone.type === 'tool') delete snap.tools[gone.id];
      text = JSON.stringify(snap);
    }
    try { vscode.setState(JSON.parse(text)); } catch { /* state too large; skip this tick */ }
  }, 90);
}

/* ---------------- tabs ---------------- */
function tabTitle(session) {
  const raw = (session.title || '').trim();
  if (raw && raw !== 'ACP Session' && raw !== 'Echo AI Session') return raw;
  if (session.preview) return session.preview;
  return 'New session';
}
function renderTabs() {
  tabstrip.replaceChildren();
  const list = ui.sessions.length ? ui.sessions : (ui.sessionId ? [{ sessionId: ui.sessionId }] : []);
  for (const session of list) {
    const tab = document.createElement('div');
    tab.className = 'tab' + (session.sessionId === ui.sessionId ? ' active' : '');
    const name = document.createElement('button');
    name.className = 'tab-name';
    name.textContent = tabTitle(session);
    name.title = tabTitle(session);
    name.addEventListener('click', () => {
      if (session.sessionId !== ui.sessionId) vscode.postMessage({ type: 'switchSession', sessionId: session.sessionId });
    });
    tab.append(name);
    if (list.length > 1) {
      const close = document.createElement('button');
      close.className = 'tab-close';
      close.textContent = '\\u2715';
      close.title = 'Close';
      close.addEventListener('click', (e) => { e.stopPropagation(); vscode.postMessage({ type: 'closeSession', sessionId: session.sessionId }); });
      tab.append(close);
    }
    tabstrip.append(tab);
  }
}

/* ---------------- menus ---------------- */
function closeMenu() { menu.classList.remove('on'); menu.replaceChildren(); }
function openMenu(anchor, title, build) {
  closeMenu();
  const head = document.createElement('div');
  head.className = 'menu-title';
  head.textContent = title;
  menu.append(head);
  build(menu);
  menu.classList.add('on');
  const r = anchor.getBoundingClientRect();
  const h = Math.min(menu.scrollHeight, 340);
  menu.style.left = Math.max(6, Math.min(r.left, window.innerWidth - menu.offsetWidth - 6)) + 'px';
  menu.style.top = (r.top - h - 6 > 0 ? r.top - h - 6 : r.bottom + 6) + 'px';
}
function menuItem(label, opts = {}) {
  const b = document.createElement('button');
  b.className = 'menu-item' + (opts.disabled ? ' off' : '');
  b.setAttribute('role', 'menuitem');
  const tick = document.createElement('span');
  tick.className = 'tick';
  tick.textContent = opts.checked ? '\\u2713' : '';
  const text = document.createElement('span');
  text.textContent = label;
  b.append(tick, text);
  if (opts.sub) {
    const sub = document.createElement('span');
    sub.className = 'sub';
    sub.textContent = opts.sub;
    b.append(sub);
  }
  if (opts.onClick) b.addEventListener('click', () => { closeMenu(); opts.onClick(); });
  return b;
}

$('ctxBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  openMenu(e.currentTarget, 'Select context type', (root) => {
    for (const [kind, label] of CONTEXT_TYPES) {
      root.append(menuItem(label, { onClick: () => vscode.postMessage({ type: 'addContext', kind }) }));
    }
  });
});
$('modelBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  openMenu(e.currentTarget, 'Select model', (root) => {
    if (!ui.models.length) { root.append(menuItem('No providers available', { disabled: true })); return; }
    let group;
    for (const m of ui.models) {
      if (m.group !== group) {
        group = m.group;
        const g = document.createElement('div');
        g.className = 'menu-group';
        g.textContent = group;
        root.append(g);
      }
      const active = ui.routing && ui.routing.provider === m.providerId && ui.routing.model === m.modelId;
      root.append(menuItem(m.modelLabel, {
        checked: Boolean(active),
        sub: m.available ? (m.reasoning ? 'reasoning' : '') : 'no key',
        disabled: !m.available,
        onClick: () => vscode.postMessage({ type: 'setModel', provider: m.providerId, model: m.modelId }),
      }));
    }
  });
});
$('maxBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  openMenu(e.currentTarget, 'Reasoning effort', (root) => {
    for (const [id, label, sub] of EFFORT_LEVELS) {
      root.append(menuItem(label, { checked: ui.effort === id, sub, onClick: () => { ui.effort = id; applyEffort(); persist(); vscode.postMessage({ type: 'setEffort', level: id }); } }));
    }
  });
});
$('modeBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  openMenu(e.currentTarget, 'Agent mode', (root) => {
    for (const [id, label, sub] of MODES) {
      root.append(menuItem(label, { checked: ui.mode === id, sub, onClick: () => vscode.postMessage({ type: 'setMode', mode: id }) }));
    }
  });
});
document.addEventListener('click', closeMenu);
menu.addEventListener('click', (e) => e.stopPropagation());
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

/* ---------------- in-panel history ---------------- */
function renderHistory(sessions, error) {
  const list = $('historyList');
  list.replaceChildren();
  if (error) {
    const e = document.createElement('div');
    e.className = 'hist-empty';
    e.textContent = String(error);
    list.append(e);
  } else if (!sessions.length) {
    const e = document.createElement('div');
    e.className = 'hist-empty';
    e.textContent = 'No previous chats in this workspace yet.';
    list.append(e);
  } else {
    for (const s of sessions) {
      const row = document.createElement('button');
      row.className = 'hist-row' + (s.open ? ' open' : '');
      const title = document.createElement('span');
      title.className = 'title';
      title.textContent = s.preview || (s.title && s.title !== 'ACP Session' ? s.title : 'Untitled chat');
      const sub = document.createElement('span');
      sub.className = 'sub';
      const when = s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '';
      sub.textContent = [when, s.model].filter(Boolean).join('  \\u00b7  ');
      row.append(title, sub);
      row.addEventListener('click', () => {
        $('historyPanel').classList.remove('on');
        vscode.postMessage({ type: 'switchSession', sessionId: s.sessionId });
      });
      list.append(row);
    }
  }
  $('historyPanel').classList.add('on');
}

/* ---------------- context chips ---------------- */
function renderChips() {
  chips.replaceChildren();
  for (const [index, chip] of ui.context.entries()) {
    const el = document.createElement('span');
    el.className = 'ctx-chip';
    const label = document.createElement('span');
    label.textContent = chip.label;
    if (chip.detail) el.title = chip.detail;
    const x = document.createElement('button');
    x.textContent = '\\u2715';
    x.title = 'Remove';
    x.addEventListener('click', () => { ui.context.splice(index, 1); renderChips(); persist(); });
    el.append(label, x);
    chips.append(el);
  }
}

/* ---------------- thread ---------------- */
function scrollEnd() { thread.scrollTop = thread.scrollHeight; }
function ensureEmpty() {
  if (ui.entries.length || thread.childElementCount) return;
  const root = document.createElement('div');
  root.className = 'empty';
  const w = document.createElement('div');
  w.className = 'wordmark';
  w.textContent = 'ECHO';
  const rule = document.createElement('div');
  rule.className = 'rule';
  const p = document.createElement('p');
  p.textContent = 'Plan, search, or build anything.';
  root.append(w, rule, p);
  thread.append(root);
}
function clearEmpty() { const e = thread.querySelector('.empty'); if (e) e.remove(); }

function addEntry(entry) {
  ui.entries.push(entry);
  if (ui.entries.length > 300) {
    ui.entries.splice(0, ui.entries.length - 300);
    redraw();
  } else {
    draw(entry);
  }
  persist(); scrollEnd();
}
function redraw() {
  nodes.clear(); thread.replaceChildren();
  for (const e of ui.entries) draw(e);
  ensureEmpty();
}
function draw(entry) {
  clearEmpty();
  if (entry.type === 'message') return drawMessage(entry);
  if (entry.type === 'toolGroup') return drawToolGroup(entry);
  if (entry.type === 'thought') return drawThought(entry);
  if (entry.type === 'plan') return drawPlan(entry);
  if (entry.type === 'error') return drawError(entry);
  if (entry.type === 'turn') return drawTurn(entry);
}
function drawMessage(entry) {
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + (entry.role === 'user' ? 'user' : 'agent');
  const body = document.createElement('div');
  body.className = 'body';
  if (entry.role === 'agent') {
    const who = document.createElement('strong');
    who.className = 'who';
    who.textContent = 'Echo';
    body.append(who);
  }
  const text = document.createElement('span');
  text.textContent = entry.text || '';
  body.append(text);
  wrap.append(body);
  if (entry.context) {
    const a = document.createElement('div');
    a.className = 'attached';
    a.textContent = 'Context: ' + entry.context;
    body.append(a);
  }
  thread.append(wrap);
  nodes.set(entry.id, text);
}
function makeGroup(entry, label) {
  const root = document.createElement('section');
  root.className = 'group' + (entry.open ? ' open' : '');
  const head = document.createElement('button');
  head.className = 'group-head';
  const chev = document.createElement('span');
  chev.className = 'chev';
  chev.textContent = '\\u276F';
  const text = document.createElement('span');
  text.textContent = label;
  head.append(chev, text);
  head.addEventListener('click', () => { entry.open = !entry.open; root.classList.toggle('open', entry.open); persist(); });
  const body = document.createElement('div');
  body.className = 'group-body';
  root.append(head, body);
  nodes.set(entry.id, root);
  nodes.set(entry.id + ':label', text);
  nodes.set(entry.id + ':body', body);
  thread.append(root);
  return body;
}
function toolGroupLabel(entry) {
  const n = entry.toolIds.length;
  return n === 1 ? '1 tool call' : n + ' tool calls';
}
function drawToolGroup(entry) {
  const body = makeGroup(entry, toolGroupLabel(entry));
  for (const id of entry.toolIds) {
    const card = buildTool(id);
    if (card) body.append(card);
  }
}
function drawThought(entry) {
  const body = makeGroup(entry, entry.done ? 'Thought complete' : 'Thinking...');
  const pre = document.createElement('div');
  pre.className = 'pre';
  pre.textContent = entry.text || '';
  body.append(pre);
  nodes.set(entry.id + ':text', pre);
}
function drawPlan(entry) {
  const root = document.createElement('section');
  root.className = 'plan';
  nodes.set(entry.id, root);
  for (const step of entry.entries || []) {
    const row = document.createElement('div');
    row.className = 'plan-row' + (step.status === 'completed' ? ' done' : '');
    const box = document.createElement('span');
    box.className = 'box' + (step.status === 'completed' ? ' done' : step.status === 'in_progress' ? ' active' : '');
    const label = document.createElement('span');
    label.textContent = step.content;
    row.append(box, label);
    root.append(row);
  }
  thread.append(root);
}
function drawError(entry) {
  const el = document.createElement('div');
  el.className = 'err';
  el.textContent = entry.message;
  thread.append(el);
}
function drawTurn(entry) {
  const el = document.createElement('div');
  el.className = 'turn';
  el.textContent = entry.text;
  thread.append(el);
  nodes.set(entry.id, el);
}

/* ---------------- tools ---------------- */
function fmt(value) {
  if (value === undefined || value === null) return '';
  try {
    const t = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return t.length > 14000 ? t.slice(0, 14000) + '\\n... truncated ...' : t;
  } catch { return String(value); }
}
function toolText(content) {
  return (content || []).filter((c) => c && c.type === 'content' && c.content && c.content.type === 'text').map((c) => c.content.text).filter(Boolean).join('\\n');
}
function buildTool(id) {
  const tool = ui.tools[id];
  if (!tool) return undefined;
  const root = document.createElement('div');
  root.className = 'tool' + (tool.status === 'failed' ? ' failed' : '');
  nodes.set('tool:' + id, root);
  const head = document.createElement('div');
  head.className = 'tool-head';
  const name = document.createElement('span');
  name.textContent = tool.title || 'Tool';
  const state = document.createElement('span');
  state.className = 'tool-state';
  state.textContent = String(tool.status || '').replace('_', ' ');
  head.append(name, state);
  root.append(head);
  const input = fmt(tool.rawInput);
  if (input) { const c = document.createElement('div'); c.className = 'cap'; c.textContent = 'Input'; const p = document.createElement('div'); p.className = 'pre'; p.textContent = input; root.append(c, p); }
  const out = toolText(tool.content) || fmt(tool.rawOutput);
  if (out) { const c = document.createElement('div'); c.className = 'cap'; c.textContent = 'Result'; const p = document.createElement('div'); p.className = 'pre'; p.textContent = out; root.append(c, p); }
  const links = document.createElement('div');
  links.className = 'tool-links';
  for (const loc of Array.isArray(tool.locations) ? tool.locations : []) {
    if (!loc || typeof loc.path !== 'string') continue;
    const b = document.createElement('button');
    b.className = 'chip-btn';
    b.textContent = loc.path + (loc.line ? ':' + loc.line : '');
    b.addEventListener('click', () => vscode.postMessage({ type: 'openLocation', path: loc.path, line: loc.line }));
    links.append(b);
  }
  for (const item of Array.isArray(tool.content) ? tool.content : []) {
    if (!item || item.type !== 'diff' || typeof item.path !== 'string') continue;
    const b = document.createElement('button');
    b.className = 'chip-btn';
    b.textContent = 'diff: ' + item.path;
    b.addEventListener('click', () => vscode.postMessage({ type: 'openDiff', path: item.path, oldText: item.oldText, newText: item.newText }));
    links.append(b);
  }
  if (links.childElementCount) root.append(links);
  return root;
}
function upsertTool(update) {
  activeAgentId = undefined;
  const id = update.toolCallId;
  const known = Boolean(ui.tools[id]);
  ui.tools[id] = { ...(ui.tools[id] || {}), ...update };
  if (!known) {
    const last = ui.entries[ui.entries.length - 1];
    if (last && last.type === 'toolGroup') {
      last.toolIds.push(id);
      const label = nodes.get(last.id + ':label');
      if (label) label.textContent = toolGroupLabel(last);
      const body = nodes.get(last.id + ':body');
      const card = buildTool(id);
      if (body && card) body.append(card);
      persist(); scrollEnd();
      return;
    }
    addEntry({ type: 'toolGroup', id: 'g' + id, toolIds: [id], open: false });
    return;
  }
  const old = nodes.get('tool:' + id);
  const next = buildTool(id);
  if (old && next) old.replaceWith(next);
  persist();
}

/* ---------------- messages ---------------- */
function addMessage(role, text, context, id) {
  activeAgentId = undefined;
  addEntry({ type: 'message', id: id || crypto.randomUUID(), role, text: String(text || '').slice(-200000), context });
}
function appendAgent(text, id) {
  const target = typeof id === 'string' ? id : activeAgentId;
  let entry = ui.entries.find((e) => e.type === 'message' && e.id === target);
  if (!entry) {
    entry = { type: 'message', id: target || crypto.randomUUID(), role: 'agent', text: '' };
    activeAgentId = entry.id;
    addEntry(entry);
  } else { activeAgentId = entry.id; }
  entry.text = String(entry.text || '') + String(text || '');
  const node = nodes.get(entry.id);
  if (node) node.textContent = entry.text;
  persist(); scrollEnd();
}
function appendThought(text) {
  let entry = ui.entries[ui.entries.length - 1];
  if (!entry || entry.type !== 'thought' || entry.done) {
    entry = { type: 'thought', id: crypto.randomUUID(), text: '', open: false, done: false };
    addEntry(entry);
  }
  entry.text = String(entry.text || '') + String(text || '');
  const node = nodes.get(entry.id + ':text');
  if (node) node.textContent = entry.text;
  persist();
}
function finishThoughts() {
  for (const e of ui.entries) {
    if (e.type === 'thought' && !e.done) {
      e.done = true;
      const label = nodes.get(e.id + ':label');
      if (label) label.textContent = 'Thought complete';
    }
  }
}

/* ---------------- status ---------------- */
function setStatus(value, detail) {
  ui.status = value;
  const busy = value === 'running';
  dot.className = 'dot ' + (busy ? 'busy' : value === 'error' ? 'bad' : value === 'ready' ? '' : 'idle');
  send.disabled = busy || value === 'connecting';
  if (busy && !turnStartedAt) startElapsed();
  if (!busy) stopElapsed();
  if (detail) meta.textContent = detail;
  else if (!busy) meta.textContent = routingLabel();
}
function routingLabel() {
  if (!ui.routing) return '';
  const m = ui.models.find((x) => x.providerId === ui.routing.provider && x.modelId === ui.routing.model);
  return m ? m.providerLabel + ' / ' + m.modelLabel : ui.routing.provider + ' / ' + ui.routing.model;
}
function startElapsed() {
  turnStartedAt = Date.now();
  const entry = { type: 'turn', id: crypto.randomUUID(), text: 'Elapsed 0s' };
  addEntry(entry);
  elapsedTimer = setInterval(() => {
    const node = nodes.get(entry.id);
    if (!node) return;
    const s = Math.round((Date.now() - turnStartedAt) / 1000);
    const text = s < 60 ? 'Elapsed ' + s + 's' : 'Elapsed ' + Math.floor(s / 60) + 'm ' + (s % 60) + 's';
    entry.text = text; node.textContent = text;
  }, 1000);
}
function stopElapsed() { clearInterval(elapsedTimer); elapsedTimer = undefined; turnStartedAt = undefined; }

function renderChanges() {
  const bar = $('changes');
  const n = ui.changes.length;
  if (!n || ui.changesDismissed) { bar.classList.remove('on'); return; }
  bar.classList.add('on');
  $('changeCount').textContent = n === 1 ? '1 file changed' : n + ' files changed';
  $('viewChanges').textContent = 'View changes (' + n + ')';
  $('revertChanges').textContent = 'Revert changes (' + n + ')';
}

function applyModelLabel() {
  const m = ui.routing && ui.models.find((x) => x.providerId === ui.routing.provider && x.modelId === ui.routing.model);
  $('modelLabel').textContent = m ? m.modelLabel : (ui.routing ? ui.routing.model : 'Model');
  meta.textContent = routingLabel();
}
function applyMode() {
  const found = MODES.find(([id]) => id === ui.mode);
  $('modeLabel').textContent = found ? found[1] : 'Default';
}
function applyEffort() {
  const found = EFFORT_LEVELS.find(([id]) => id === ui.effort);
  $('maxLabel').textContent = found ? found[1] : 'Medium';
}
function applyAccount() {
  const box = $('account');
  const signedIn = Boolean(ui.account && ui.account.signedIn);
  box.classList.toggle('out', !signedIn);
  const who = $('accountWho');
  if (signedIn) {
    const bits = [];
    if (ui.account.plan) bits.push(ui.account.plan);
    if (typeof ui.account.balance === 'number') bits.push('$' + ui.account.balance.toFixed(2) + ' left');
    who.textContent = bits.length ? 'Echo AI \u00b7 ' + bits.join(' \u00b7 ') : 'Signed in to Echo AI';
    $('accountBtn').textContent = 'Profile';
  } else {
    who.textContent = 'Sign in to use Echo AI models';
    $('accountBtn').textContent = 'Sign in';
  }
}
function applyAutopilot() {
  const el = $('autopilot');
  el.classList.toggle('on', ui.autopilot);
  el.setAttribute('aria-pressed', String(ui.autopilot));
}

/* ---------------- actions ---------------- */
function submit() {
  const text = prompt.value.trim();
  if (!text || send.disabled) return;
  prompt.value = '';
  vscode.postMessage({ type: 'send', text, context: ui.context.slice() });
  ui.context = []; renderChips(); persist();
}
send.addEventListener('click', submit);
prompt.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
$('newTab').addEventListener('click', () => vscode.postMessage({ type: 'newSession' }));
$('historyBtn').addEventListener('click', () => { vscode.postMessage({ type: 'listHistory' }); });
$('historyClose').addEventListener('click', () => $('historyPanel').classList.remove('on'));
$('accountBtn').addEventListener('click', () => vscode.postMessage({ type: ui.account && ui.account.signedIn ? 'showAccount' : 'signIn' }));
$('accountWho').addEventListener('click', () => { if (ui.account && ui.account.signedIn) vscode.postMessage({ type: 'showAccount' }); });
$('attachBtn').addEventListener('click', () => vscode.postMessage({ type: 'addContext', kind: 'file' }));
$('autopilot').addEventListener('click', () => { ui.autopilot = !ui.autopilot; applyAutopilot(); persist(); vscode.postMessage({ type: 'setAutopilot', enabled: ui.autopilot }); });
$('viewChanges').addEventListener('click', () => vscode.postMessage({ type: 'viewChanges' }));
$('revertChanges').addEventListener('click', () => vscode.postMessage({ type: 'revertChanges' }));
$('dismissChanges').addEventListener('click', () => { ui.changesDismissed = true; renderChanges(); persist(); });

/* ---------------- boot ---------------- */
redraw(); renderTabs(); renderChips(); renderChanges(); applyModelLabel(); applyMode(); applyEffort(); applyAutopilot(); applyAccount(); scrollEnd();
vscode.postMessage({ type: 'ready' });

window.addEventListener('message', ({ data }) => {
  if (!isObj(data) || typeof data.type !== 'string') return;
  switch (data.type) {
    case 'panelState':
      if (Array.isArray(data.models)) ui.models = data.models;
      if (Array.isArray(data.sessions)) ui.sessions = data.sessions;
      if (isObj(data.routing)) ui.routing = data.routing;
      if (data.mode === 'default' || data.mode === 'plan') ui.mode = data.mode;
      if (typeof data.autopilot === 'boolean') ui.autopilot = data.autopilot;
      if (typeof data.activeSessionId === 'string') ui.sessionId = data.activeSessionId;
      if (isObj(data.account)) ui.account = data.account;
      renderTabs(); applyModelLabel(); applyMode(); applyAutopilot(); applyAccount(); persist();
      return;
    case 'history':
      renderHistory(Array.isArray(data.sessions) ? data.sessions : [], data.error);
      return;
    case 'contextAdded':
      if (isObj(data.chip)) { ui.context.push(data.chip); renderChips(); persist(); }
      return;
    case 'changes':
      if (Array.isArray(data.files)) { ui.changes = data.files; ui.changesDismissed = false; renderChanges(); persist(); }
      return;
    case 'localUser':
      addMessage('user', data.text, typeof data.context === 'string' ? data.context : undefined);
      return;
    case 'status':
      setStatus(data.status, typeof data.message === 'string' ? data.message : undefined);
      return;
    case 'error':
      finishThoughts();
      addEntry({ type: 'error', id: crypto.randomUUID(), message: String(data.message || '') });
      return;
    case 'session':
      if (typeof data.sessionId === 'string') {
        if (ui.sessionId && ui.sessionId !== data.sessionId) {
          ui.entries = []; ui.tools = Object.create(null); ui.changes = []; activeAgentId = undefined; redraw();
        }
        ui.sessionId = data.sessionId;
        if (data.mode === 'plan' || data.mode === 'default') { ui.mode = data.mode; applyMode(); }
        if (typeof data.provider === 'string' && typeof data.model === 'string') { ui.routing = { provider: data.provider, model: data.model }; applyModelLabel(); }
        renderTabs(); persist();
      }
      return;
    case 'turn':
      finishThoughts(); stopElapsed();
      return;
    case 'reset':
      ui.entries = []; ui.tools = Object.create(null); ui.changes = []; activeAgentId = undefined; redraw(); renderChanges(); persist();
      return;
  }

  if (data.type !== 'update' || !isObj(data.update)) return;
  const u = data.update;
  if (u.sessionUpdate === 'agent_message_chunk' && u.content && u.content.type === 'text') { finishThoughts(); appendAgent(u.content.text, u.messageId); }
  if (u.sessionUpdate === 'agent_thought_chunk' && u.content && u.content.type === 'text') appendThought(u.content.text);
  if (u.sessionUpdate === 'user_message_chunk' && u.content && u.content.type === 'text') addMessage('user', u.content.text, undefined, u.messageId);
  if ((u.sessionUpdate === 'tool_call' || u.sessionUpdate === 'tool_call_update') && typeof u.toolCallId === 'string') { finishThoughts(); upsertTool(u); }
  if (u.sessionUpdate === 'plan' && Array.isArray(u.entries)) {
    const steps = u.entries.filter(isObj).map((e) => ({ content: String(e.content || '').slice(0, 600), status: e.status === 'completed' ? 'completed' : e.status === 'in_progress' ? 'in_progress' : 'pending' }));
    const existing = ui.entries.find((e) => e.type === 'plan');
    if (existing) {
      existing.entries = steps;
      const old = nodes.get(existing.id);
      if (old) { const fresh = document.createElement('div'); old.replaceWith(fresh); thread.removeChild(fresh); redraw(); }
    } else { addEntry({ type: 'plan', id: crypto.randomUUID(), entries: steps }); }
  }
  if (u.sessionUpdate === 'current_mode_update' && (u.currentModeId === 'default' || u.currentModeId === 'plan')) { ui.mode = u.currentModeId; applyMode(); }
  if (u.sessionUpdate === 'usage_update' && typeof u.used === 'number' && typeof u.size === 'number') {
    meta.textContent = routingLabel() + '  ' + u.used.toLocaleString() + '/' + u.size.toLocaleString();
  }
});
</script>
</body>
</html>`;
}
