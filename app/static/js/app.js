/* LLM Studio — ChatGPT-style frontend (settings, thinking, voice) */
const $ = s => document.querySelector(s);
const DEFAULT_PERSONA = "You are a helpful, knowledgeable assistant. Use Markdown (tables, lists, fenced code blocks with language tags, and LaTeX math with $...$ or $$...$$) when useful.";

const IC = {
  copy:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  check:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  edit:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  regen:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>',
  like:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
  dislike:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>',
  speak:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
  trash:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>',
};
const ICON_SEND = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
const ICON_STOP = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>';

let MODELS = [];        // [{id, kind}]
const KIND = {};        // id -> "cloud"|"local"
let pendingFile = null, generating = false, stick = true, aborts = [], recog = null, recording = false;

let state = {
  user: null, quota: null, uid: null,
  chats: [],
  current: null,
  model: localStorage.getItem("llm_model") || "",
  theme: localStorage.getItem("llm_theme") || "system",
  search: "",
  settings: Object.assign({maxTokens:4096, temperature:0.7, persona:DEFAULT_PERSONA},
                          JSON.parse(localStorage.getItem("llm_settings") || "{}")),
};

marked.setOptions({ breaks:true, gfm:true });

/* ----------------------------- helpers ---------------------------------- */
function escapeHtml(s){ return (s||"").replace(/[&<>"]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[m])); }
function escapeAttr(s){ return escapeHtml(s).replace(/'/g,"&#39;"); }
function shortName(id){ return (id || "").replace(/^@cf\/[^/]+\//, ""); }
function modelKind(id){ return KIND[id] || (String(id).startsWith("@cf/") ? "cloud" : "local"); }
function isReasoning(id){ return /glm-5|glm-4|qwq|deepseek-r1|qwen3|thinking|reason/i.test(id||""); }
function renderMd(t){ return DOMPurify.sanitize(marked.parse(t||"")); }
function badgeHtml(id){ return `<span class="model-badge"><span class="dot ${modelKind(id)}"></span>${escapeHtml(shortName(id))}</span>`; }

/* ----------------------------- theme ------------------------------------ */
function applyTheme(mode){
  state.theme = mode; localStorage.setItem("llm_theme", mode);
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  document.querySelectorAll("[data-theme-choice]").forEach(b => b.classList.toggle("sel", b.dataset.themeChoice === mode));
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (state.theme === "system") applyTheme("system"); });

/* ----------------------------- models ----------------------------------- */
async function loadModels(){
  try{ const d = await (await fetch("/api/models")).json();
    MODELS = d.models || MODELS;
    MODELS.forEach(m => KIND[m.id] = m.kind);
    if(!state.model || !MODELS.some(m=>m.id===state.model)) state.model = d.default || (MODELS[0]&&MODELS[0].id);
  }catch(e){}
  renderModelMenu(); updateModelLabel();
}
function renderModelMenu(){
  $("#modelMenu").innerHTML = MODELS.map(m => {
    const sel = m.id === state.model;
    const kind = modelKind(m.id);
    const tags = [];
    if(isReasoning(m.id)) tags.push('<span class="tag-reason">reasoning</span>');
    tags.push(`<span class="tag-kind ${kind}">${kind}</span>`);
    if(sel) tags.push('<span class="opt-check">✓</span>');
    return `<div class="opt${sel?' sel':''}" onclick="pickModel('${m.id}')">`+
      `<span class="opt-name">${escapeHtml(shortName(m.id))}</span>`+
      `<span class="opt-tags">${tags.join("")}</span></div>`;
  }).join("");
}
function pickModel(id){ state.model = id; localStorage.setItem("llm_model", id); updateModelLabel(); renderModelMenu(); closeAllMenus(); }
function updateModelLabel(){ $("#modelLabel").textContent = shortName(state.model) || "Model"; }
function openModelMenu(){ closeModals(); $("#modelMenu").classList.add("open"); }

/* ----------------------------- chats ------------------------------------ */
function uid(){ return "c" + Math.random().toString(36).slice(2,10); }
let _syncT=null;
function syncDB(){ clearTimeout(_syncT); _syncT=setTimeout(()=>{ fetch("/api/chats",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(state.chats)}).catch(()=>{}); }, 900); }
function saveChats(){
  if(state.uid){ localStorage.setItem("llm_chats_"+state.uid, JSON.stringify(state.chats));
    localStorage.setItem("llm_current_"+state.uid, state.current || ""); }
  syncDB();
}
function curChat(){ return state.chats.find(c => c.id === state.current); }
function migrate(){ let ch=false; state.chats.forEach(c=>{ if(!c.created){c.created=Date.now();ch=true;} if(!c.updated){c.updated=c.created;ch=true;} }); if(ch) saveChats(); }
function newChat(){
  // ChatGPT behavior: a blank chat is a draft. Clicking "New chat" while already on a
  // blank chat reuses it (no duplicate), and stray empty drafts are pruned.
  state.chats = state.chats.filter(c => c.messages.length || c.id === state.current);
  const cur = curChat();
  if(!cur || cur.messages.length){
    const c={id:uid(), title:"New chat", messages:[], created:Date.now(), updated:Date.now()};
    state.chats.unshift(c); state.current=c.id;
  }
  pendingFile=null; renderAttach();
  const inp=$("#input"); if(inp){ inp.value=""; autoGrow(); }
  updateSendBtn(); saveChats(); renderSidebar(); renderThread(); if(inp) inp.focus();
}
function selectChat(id){ state.current=id; saveChats(); renderSidebar(); renderThread(); }
function deleteChat(id){ closeAllMenus(); fetch("/api/chats/"+id,{method:"DELETE"}).catch(()=>{}); state.chats=state.chats.filter(c=>c.id!==id); if(state.current===id) state.current=state.chats[0]?.id||null; if(!state.chats.length){ saveChats(); newChat(); return; } saveChats(); renderSidebar(); renderThread(); }

function groupChats(list){
  const now=new Date(); const startToday=new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(); const day=86400000;
  const b=[["Today",[]],["Yesterday",[]],["Previous 7 Days",[]],["Previous 30 Days",[]],["Older",[]]];
  list.forEach(c=>{ const t=c.updated||c.created||0;
    if(t>=startToday) b[0][1].push(c); else if(t>=startToday-day) b[1][1].push(c);
    else if(t>=startToday-7*day) b[2][1].push(c); else if(t>=startToday-30*day) b[3][1].push(c); else b[4][1].push(c); });
  return b.filter(g=>g[1].length);
}
function renderSidebar(){
  const q=(state.search||"").toLowerCase().trim();
  // A blank draft chat isn't listed until it has a message (ChatGPT behavior).
  let list=[...state.chats].filter(c=>c.messages.length).sort((a,b)=>(b.updated||0)-(a.updated||0));
  if(q) list=list.filter(c => (c.title||"").toLowerCase().includes(q) || c.messages.some(m=>((m.display!=null?m.display:m.content)||"").toLowerCase().includes(q)));
  const box=$("#chats");
  if(!list.length){ box.innerHTML = "<div class='grp-label'>"+(q?"No matches":"No chats yet")+"</div>"; return; }
  box.innerHTML = groupChats(list).map(([label,items]) =>
    `<div class="grp-label">${label}</div>` + items.map(chatItemHtml).join("")).join("");
}
function chatItemHtml(c){
  return `<div class="chat-item ${c.id===state.current?'active':''}" data-id="${c.id}" onclick="selectChat('${c.id}')">
    <span class="t">${escapeHtml(c.title)}</span>
    <button class="more" title="Options" onclick="chatMenu(event,'${c.id}')">⋯</button></div>`;
}
function chatMenu(e,id){
  e.stopPropagation(); closeAllMenus();
  const ctx=$("#ctxMenu");
  ctx.innerHTML = `<div class="opt" onclick="startRename('${id}')">${IC.edit}<span>Rename</span></div>
    <div class="opt" onclick="exportChat('${id}')">${IC.copy}<span>Export</span></div>
    <div class="menu-sep"></div>
    <div class="opt danger" onclick="deleteChat('${id}')">${IC.trash}<span>Delete</span></div>`;
  ctx.style.left = Math.min(e.clientX, innerWidth-210) + "px";
  ctx.style.top = (e.clientY+4) + "px"; ctx.classList.add("open");
}
function startRename(id){
  closeAllMenus(); const c=state.chats.find(x=>x.id===id); if(!c) return;
  const item=document.querySelector(`.chat-item[data-id="${id}"]`); if(!item) return;
  item.innerHTML = `<input class="rename" value="${escapeAttr(c.title)}">`;
  const inp=item.querySelector("input"); inp.focus(); inp.select();
  const commit=()=>{ c.title=(inp.value.trim()||c.title); c.updated=Date.now(); saveChats(); renderSidebar(); };
  inp.addEventListener("keydown", ev=>{ if(ev.key==="Enter"){ev.preventDefault();commit();} else if(ev.key==="Escape") renderSidebar(); });
  inp.addEventListener("blur", commit);
}

/* ----------------------------- rendering -------------------------------- */
function renderThread(){
  const main=$("#main"), c=curChat();
  const empty = !c || !c.messages.length;
  main.classList.toggle("empty", empty);
  const t=$("#thread");
  if(empty){
    const u=state.user||{}; const nm=(u.display_name||"").trim().split(/\s+/)[0];
    const hi = nm ? `Hey, ${escapeHtml(nm)}. Ready to dive in?` : "What can I help with?";
    t.innerHTML = `<div class="thread-inner"><div class="empty-hero"><h1>${hi}</h1></div></div>`;
    const ep=$("#emptyPills"); if(ep) ep.innerHTML=pillsHtml();
    updateScrollBtn(); renderNavMarks(); return;
  }
  { const ep=$("#emptyPills"); if(ep) ep.innerHTML=""; }
  t.innerHTML = `<div class="thread-inner">${c.messages.map((m,i)=>rowHtml(m,i,c.messages.length)).join("")}</div>`;
  enhance(t); stick=true; scrollToBottom(); updateScrollBtn(); renderNavMarks();
}
const _pillSvg=(p)=>`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
function pillsHtml(){
  const ex=[
    ["Explain simply","Explain how neural networks learn, in plain language.",'<path d="M9 18h6M10 21h4M12 2a6 6 0 0 0-3.6 10.8c.5.4.9 1 1.1 1.7h5c.2-.7.6-1.3 1.1-1.7A6 6 0 0 0 12 2z"/>'],
    ["Write code","Write a Python function that returns the nth Fibonacci number.",'<path d="M8 9l-3 3 3 3M16 9l3 3-3 3M13 6l-2 12"/>'],
    ["Draft an email","Draft a polite email requesting a deadline extension.",'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'],
    ["Compare ideas","List the pros and cons of remote work.",'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'],
  ];
  return ex.map(e=>`<button class="pill" onclick="useExample('${e[1].replace(/'/g,"\\'")}')">${_pillSvg(e[2])}<span>${e[0]}</span></button>`).join("");
}
function useExample(t){ $("#input").value=t; autoGrow(); updateSendBtn(); $("#input").focus(); }

function rowHtml(m,i,total){
  if(m.role==="user"){
    const file = m.file ? `<div class="file-chip"><span class="ic">📄</span>${escapeHtml(m.file)}</div>` : "";
    return `<div class="row user" data-i="${i}"><div class="bubble-wrap">${file}<div class="bubble">${escapeHtml(m.display!=null?m.display:m.content)}</div>
      <div class="msg-actions"><button class="act" title="Copy" onclick="copyMsg(${i},this)">${IC.copy}</button>
      <button class="act" title="Edit" onclick="editMsg(${i})">${IC.edit}</button></div></div></div>`;
  }
  // single assistant
  const last = i===total-1;
  const mid = m.model || state.model;
  let inner = "";   // no per-message model badge (ChatGPT doesn't show one)
  if(m.thinking || (m._streaming && isReasoning(mid))){
    inner += `<details class="think"${m._streaming?" open":""}><summary>Thoughts</summary><div class="tk">${escapeHtml(m.thinking||"")}</div></details>`;
  }
  const body = m.content ? renderMd(m.content)+(m._streaming?'<span class="cursor"></span>':"")
             : (m._streaming?'<span class="thinking"><i></i><i></i><i></i></span>':"");
  inner += `<div class="content" data-md="1">${body}</div>`;
  if(m.error) inner += `<div class="err-card">⚠️ ${escapeHtml(m.error)}<div class="acts"><button onclick="regen()">Retry</button><button onclick="openModelMenu()">Switch model</button></div></div>`;
  if(!m._streaming && (m.content||m.error)) inner += `<div class="msg-actions">`+
    `<button class="act" title="Copy" onclick="copyMsg(${i},this)">${IC.copy}</button>`+
    `<button class="act like" title="Good response" onclick="likeMsg(1,this)">${IC.like}</button>`+
    `<button class="act dislike" title="Bad response" onclick="likeMsg(-1,this)">${IC.dislike}</button>`+
    `<button class="act" title="Read aloud" onclick="readAloud(${i})">${IC.speak}</button>`+
    (last?`<button class="act" title="Regenerate" onclick="regen()">${IC.regen}</button>`:'')+
    `</div>`;
  return `<div class="row assistant ${last?'last':''}" data-i="${i}"><div class="avatar">L</div><div class="asst">${inner}</div></div>`;
}
function enhance(root){
  root.querySelectorAll('.content[data-md="1"]').forEach(el=>{
    el.querySelectorAll("pre").forEach(wrapCode);
    el.querySelectorAll("pre code").forEach(c=>{ try{ hljs.highlightElement(c); }catch(e){} });
    try{ if(window.renderMathInElement) renderMathInElement(el,{delimiters:[
      {left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false},
      {left:"\\[",right:"\\]",display:true},{left:"\\(",right:"\\)",display:false}],throwOnError:false}); }catch(e){}
  });
}
function wrapCode(pre){
  if(pre.closest(".code-card")) return;
  const code=pre.querySelector("code"); let lang="";
  if(code){ const cl=[...code.classList].find(x=>x.startsWith("language-")); if(cl) lang=cl.slice(9); }
  const card=document.createElement("div"); card.className="code-card";
  const head=document.createElement("div"); head.className="code-head";
  head.innerHTML=`<span>${escapeHtml(lang||"text")}</span><button class="code-copy">${IC.copy} Copy code</button>`;
  pre.parentNode.insertBefore(card,pre); card.appendChild(head); card.appendChild(pre);
  head.querySelector(".code-copy").onclick=()=>{ const btn=head.querySelector(".code-copy");
    navigator.clipboard.writeText(code?code.innerText:pre.innerText);
    btn.innerHTML=IC.check+" Copied"; setTimeout(()=>btn.innerHTML=IC.copy+" Copy code",1200); };
}
function copyMsg(i, el){
  const m=curChat().messages[i]; navigator.clipboard.writeText(m.display!=null&&m.role==="user"?m.display:m.content);
  if(el){ el.innerHTML=IC.check; el.classList.add("ok"); el.title="Copied"; setTimeout(()=>{ el.innerHTML=IC.copy; el.classList.remove("ok"); el.title="Copy"; },1300); }
  else toast("Copied");
}
// Local feedback (no feedback backend): toggle the visual state, clear the sibling.
function likeMsg(val, el){
  if(!el) return; const row=el.closest(".msg-actions"); if(!row) return;
  const up=row.querySelector(".act.like"), dn=row.querySelector(".act.dislike");
  const wasOn=el.classList.contains("on");
  up&&up.classList.remove("on"); dn&&dn.classList.remove("on");
  if(!wasOn){ el.classList.add("on"); toast(val>0?"Thanks for the feedback":"Thanks — noted"); }
}
// Read aloud via the browser Speech Synthesis API (click again to stop).
function readAloud(i){
  if(!("speechSynthesis" in window)){ toast("Read aloud isn't supported in this browser"); return; }
  if(speechSynthesis.speaking){ speechSynthesis.cancel(); return; }
  const m=curChat().messages[i]; if(!m||!m.content) return;
  const text=(m.content||"").replace(/```[\s\S]*?```/g," (code block) ").replace(/[#*`>_~|]/g,"").replace(/\[(.*?)\]\((.*?)\)/g,"$1");
  speechSynthesis.speak(new SpeechSynthesisUtterance(text)); toast("Reading aloud…");
}

/* ----------------------------- edit / regenerate ------------------------ */
function editMsg(i){
  const c=curChat(), m=c.messages[i]; if(!m||m.role!=="user"||generating) return;
  const wrap=document.querySelector(`.row[data-i="${i}"] .bubble-wrap`); if(!wrap) return;
  const cur=m.display!=null?m.display:m.content;
  wrap.innerHTML=`<div class="edit-box"><textarea>${escapeHtml(cur)}</textarea>
    <div class="edit-actions"><button class="btn-ghost" onclick="renderThread()">Cancel</button>
    <button class="btn-primary" onclick="saveEdit(${i})">Send</button></div></div>`;
  const tx=wrap.querySelector("textarea"); tx.focus(); tx.style.height="auto"; tx.style.height=tx.scrollHeight+"px";
}
function saveEdit(i){
  const c=curChat(), m=c.messages[i]; const tx=document.querySelector(`.row[data-i="${i}"] textarea`); if(!tx) return;
  const val=tx.value.trim(); if(!val) return;
  c.messages=c.messages.slice(0,i+1); m.content=val; delete m.display; delete m.file; c.updated=Date.now();
  dispatchRun(c, false);
}
function regen(){
  const c=curChat(); if(!c||generating) return;
  while(c.messages.length && c.messages[c.messages.length-1].role==="assistant") c.messages.pop();
  if(!c.messages.length) return;
  dispatchRun(c, false);
}
function dispatchRun(c, maybeTitle){
  runCompletion(c, maybeTitle);
}

/* ----------------------------- send / stream ---------------------------- */
function sysMsg(){ return {role:"system", content:(state.settings.persona||DEFAULT_PERSONA)}; }
function apiHistory(c, upto){
  const out=[sysMsg()];
  for(let i=0;i<upto;i++){ const m=c.messages[i];
    if(m.role==="user") out.push({role:"user", content:m.content});
    else if(m.content) out.push({role:"assistant", content:m.content});
  }
  return out;
}
async function streamInto(messages, model, ctrl, cb){
  const res = await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({messages, model, max_tokens:state.settings.maxTokens, temperature:state.settings.temperature}), signal:ctrl.signal});
  if(!res.ok){
    let msg="Request failed ("+res.status+").";
    try{ const j=await res.json(); if(j.error) msg=j.error; if(j.quota) updateQuota(j.quota); }catch(e){}
    if(res.status===401){ msg="Your session expired — please sign in again."; setTimeout(showAuth,600); }
    cb.onError(msg); return;
  }
  consumeQuotaLocal();
  const reader=res.body.getReader(); const dec=new TextDecoder(); let buf="";
  while(true){
    const {value,done}=await reader.read(); if(done) break;
    buf+=dec.decode(value,{stream:true}); let idx;
    while((idx=buf.indexOf("\n\n"))>=0){
      const line=buf.slice(0,idx); buf=buf.slice(idx+2);
      if(!line.startsWith("data: ")) continue;
      const o=JSON.parse(line.slice(6));
      if(o.token) cb.onToken(o.token);
      else if(o.thinking) cb.onThink(o.thinking);
      else if(o.error) cb.onError(o.error);
    }
  }
}
async function send(){
  const ta=$("#input"); const text=ta.value.trim();
  if((!text && !pendingFile) || generating) return;
  let c=curChat(); if(!c){ newChat(); c=curChat(); }
  const um={role:"user", content:text};
  if(pendingFile){ um.content=`The user attached a document named "${pendingFile.name}". Content:\n\n${pendingFile.text}\n\n---\n\nUser: ${text||"(please summarize this document.)"}`; um.display=text; um.file=pendingFile.name; }
  c.messages.push(um);
  const firstTurn = c.messages.filter(m=>m.role==="user").length===1;
  if(c.title==="New chat") c.title=((text||("File: "+pendingFile.name)).slice(0,42))||"New chat";
  c.updated=Date.now(); pendingFile=null; renderAttach(); ta.value=""; autoGrow(); updateSendBtn();
  dispatchRun(c, firstTurn);
}
async function runCompletion(c, maybeTitle){
  const bot={role:"assistant", content:"", model:state.model, thinking:"", error:"", _streaming:true};
  c.messages.push(bot); const bi=c.messages.length-1;
  c.updated=Date.now(); saveChats(); renderSidebar(); renderThread(); setGenerating(true);
  const row=document.querySelector(`.row[data-i="${bi}"]`);
  const cEl=row && row.querySelector(".content");
  const ctrl=new AbortController(); aborts=[ctrl];
  // Coalesce token renders to one per animation frame: the markdown is re-parsed at
  // most ~60x/s instead of once per token. Removes the streaming jank on long replies
  // (was O(n^2) — a full re-parse + re-sanitize of the whole message on every token).
  let raf=0;
  const flush=()=>{ raf=0; if(cEl){ cEl.innerHTML=renderMd(bot.content)+'<span class="cursor"></span>'; smartScroll(); } };
  try{
    await streamInto(apiHistory(c, bi), state.model, ctrl, {
      onToken:(t)=>{ bot.content+=t; if(cEl && !raf) raf=requestAnimationFrame(flush); },
      onThink:(t)=>{ bot.thinking+=t; const tk=row&&row.querySelector(".think .tk"); if(tk){ tk.textContent=bot.thinking; smartScroll(); } },
      onError:(e)=>{ bot.error=e; },
    });
  }catch(e){ if(e.name!=="AbortError") bot.error=e.message; }
  if(raf) cancelAnimationFrame(raf);
  bot._streaming=false;
  if(!bot.content.trim() && !bot.error) bot.error="The model returned no text. Try again or pick another model.";
  setGenerating(false); c.updated=Date.now(); saveChats(); renderThread(); renderSidebar();
  if(maybeTitle) autoTitle(c);
}
function setGenerating(on){
  generating=on; const b=$("#sendBtn");
  if(on){ b.disabled=false; b.classList.add("stop"); b.innerHTML=ICON_STOP; b.title="Stop"; }
  else{ b.classList.remove("stop"); b.innerHTML=ICON_SEND; b.title="Send"; updateSendBtn(); }
}
function stopGen(){ aborts.forEach(a=>{ try{a.abort();}catch(e){} }); aborts=[]; }
function updateSendBtn(){ if(!generating) $("#sendBtn").disabled = !($("#input").value.trim() || pendingFile); }

/* ----------------------------- scrolling -------------------------------- */
function nearBottom(){ const t=$("#thread"); return t.scrollHeight - t.scrollTop - t.clientHeight < 120; }
function smartScroll(){ if(stick){ const t=$("#thread"); t.scrollTop=t.scrollHeight; } }
function scrollToBottom(){ const t=$("#thread"); t.scrollTop=t.scrollHeight; stick=true; updateScrollBtn(); }
function updateScrollBtn(){ const t=$("#thread"); const show=!$("#main").classList.contains("empty") && (t.scrollHeight-t.scrollTop-t.clientHeight>200); $("#scrollBtn").classList.toggle("show", show); }
// Right-side prompt-navigation rail: one mark per user turn, jump-to on click (ChatGPT-style, for long chats).
function renderNavMarks(){
  const rail=$("#navMarks"); if(!rail) return;
  const t=$("#thread"), c=curChat();
  const users = c ? c.messages.filter(m=>m.role==="user").length : 0;
  if(!c || users<2){ rail.innerHTML=""; rail.classList.remove("show"); return; }
  const H = t.scrollHeight || 1;
  let html="";
  c.messages.forEach((m,i)=>{
    if(m.role!=="user") return;
    const el=t.querySelector(`.row[data-i="${i}"]`); if(!el) return;
    const top=Math.min(99, Math.max(1, (el.offsetTop/H)*100));
    html+=`<button class="nav-mark" style="top:${top.toFixed(2)}%" title="${escapeAttr((m.display!=null?m.display:m.content||"").slice(0,80))}" onclick="scrollToMsg(${i})"></button>`;
  });
  rail.innerHTML=html; rail.classList.add("show"); updateNavActive();
}
function scrollToMsg(i){ const el=$("#thread").querySelector(`.row[data-i="${i}"]`); if(el){ stick=false; el.scrollIntoView({behavior:"smooth",block:"start"}); } }
function updateNavActive(){
  const t=$("#thread"), rail=$("#navMarks"); if(!rail||!rail.classList.contains("show")) return;
  const marks=[...rail.querySelectorAll(".nav-mark")]; if(!marks.length) return;
  const y=t.scrollTop+t.clientHeight*0.3; let active=marks[0];
  marks.forEach(mk=>{ if(parseFloat(mk.style.top)/100*t.scrollHeight<=y) active=mk; });
  marks.forEach(mk=>mk.classList.toggle("on", mk===active));
}

/* ----------------------------- attachments ------------------------------ */
async function uploadFile(f){
  if(!f) return; toast("Reading "+f.name+" …");
  const fd=new FormData(); fd.append("file", f);
  try{ const d=await (await fetch("/api/extract",{method:"POST",body:fd})).json();
    if(d.error){ toast("⚠️ "+d.error); return; }
    pendingFile={name:d.name, text:d.text}; renderAttach(); updateSendBtn(); toast("Attached "+d.name);
  }catch(e){ toast("⚠️ "+e.message); }
}
function renderAttach(){
  $("#attachRow").innerHTML = pendingFile
    ? `<div class="file-chip"><span class="ic">📄</span>${escapeHtml(pendingFile.name)}
       <button class="icon-btn" style="padding:0 4px" onclick="pendingFile=null;renderAttach();updateSendBtn()">✕</button></div>` : "";
}

/* ----------------------------- titles / export -------------------------- */
async function autoTitle(c){
  if(!c || c.titled) return;
  const u=c.messages.find(m=>m.role==="user");
  const a=c.messages.find(m=>m.role==="assistant");
  const aContent = a ? (a.content || "") : "";
  if(!u || !aContent) return;
  c.titled=true; saveChats();
  const titleModel = (MODELS.find(m=>/flash|lite|mini|small|turbo|1b|3b|8b|9b/i.test(m.id))||{}).id || state.model;
  try{ const d=await (await fetch("/api/title",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({messages:[{role:"user",content:u.display!=null?u.display:u.content},{role:"assistant",content:aContent}], model:titleModel})})).json();
    if(d.title){ c.title=d.title; saveChats(); renderSidebar(); }
  }catch(e){}
}
function exportChat(id){
  closeAllMenus(); const c=state.chats.find(x=>x.id===id)||curChat(); if(!c) return;
  let md=`# ${c.title}\n\n`;
  c.messages.forEach(m=>{
    if(m.role==="user") md += `**You:**\n\n${m.display!=null?m.display:m.content}\n\n---\n\n`;
    else md += `**Assistant (${shortName(m.model||"")}):**\n\n${m.content}\n\n---\n\n`;
  });
  const b=new Blob([md],{type:"text/markdown"}); const u=URL.createObjectURL(b);
  const a=document.createElement("a"); a.href=u; a.download=(c.title.replace(/[^\w]+/g,"_")||"chat")+".md"; a.click(); URL.revokeObjectURL(u);
}

/* ----------------------------- settings / voice ------------------------- */
function saveSettings(){ localStorage.setItem("llm_settings", JSON.stringify(state.settings)); }
function wireSettings(){
  const pe=$("#personaInput");
  pe.value=state.settings.persona;
  pe.oninput=()=>{ state.settings.persona=pe.value; saveSettings(); };
}
function setupVoice(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ $("#micBtn").style.display="none"; return; }
  recog=new SR(); recog.continuous=false; recog.interimResults=true; recog.lang="en-US";
  let base="";
  recog.onresult=e=>{ let t=""; for(let i=e.resultIndex;i<e.results.length;i++) t+=e.results[i][0].transcript; $("#input").value=base+t; autoGrow(); updateSendBtn(); };
  recog.onend=()=>{ recording=false; $("#micBtn").classList.remove("rec"); };
  recog.onerror=()=>{ recording=false; $("#micBtn").classList.remove("rec"); };
  $("#micBtn").onclick=()=>{ if(recording){ recog.stop(); return; } base=$("#input").value?$("#input").value+" ":""; recording=true; $("#micBtn").classList.add("rec"); try{recog.start();}catch(e){} };
}

/* ----------------------------- ui glue ---------------------------------- */
function autoGrow(){ const t=$("#input"); t.style.height="auto"; t.style.height=Math.min(t.scrollHeight,200)+"px"; }
function toast(m){ const t=$("#toast"); t.textContent=m; t.classList.add("show"); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove("show"),2000); }
function closeAllMenus(){ $("#modelMenu").classList.remove("open"); $("#ctxMenu")?.classList.remove("open");
  $("#userMenu")?.classList.remove("open"); $("#userBtn")?.setAttribute("aria-expanded","false"); }
function closeModals(){ document.querySelectorAll(".overlay").forEach(o=>o.classList.remove("open")); }
function openModal(id){ closeModals(); $("#"+id).classList.add("open"); }
function toggleSidebar(){ const sb=$("#sidebar"); sb.classList.toggle("collapsed"); const mobile=innerWidth<760; $("#backdrop").classList.toggle("show", mobile && !sb.classList.contains("collapsed")); }

async function init(){
  const ctx=document.createElement("div"); ctx.className="menu"; ctx.id="ctxMenu"; ctx.style.position="fixed"; document.body.appendChild(ctx);
  applyTheme(state.theme); migrate();
  loadModels();   // fire-and-forget: render the UI instantly; the picker fills in when ready
  if(!state.chats.length) newChat(); else if(!state.current) state.current=state.chats[0].id;
  renderSidebar(); renderThread(); updateSendBtn(); wireSettings(); setupVoice();
  if(innerWidth<760) $("#sidebar").classList.add("collapsed");

  $("#newChatBtn").onclick=newChat; $("#newChatIcon").onclick=newChat;
  $("#sidebarToggle").onclick=toggleSidebar; $("#backdrop").onclick=toggleSidebar;
  $("#modelBtn").onclick=e=>{ e.stopPropagation(); const m=$("#modelMenu"); const open=m.classList.contains("open"); closeAllMenus(); if(!open) m.classList.add("open"); };
  $("#settingsBtn").onclick=()=>{ closeAllMenus(); openModal("settingsModal"); };
  $("#changePwBtn")?.addEventListener("click", changePassword);
  $("#deleteAcctBtn")?.addEventListener("click", ()=>{ $("#deleteConfirm").hidden=false; $("#deleteAcctBtn").hidden=true; });
  $("#delConfirmBtn")?.addEventListener("click", deleteAccount);
  $("#helpBtn").onclick=()=>{ closeAllMenus(); openModal("helpModal"); };
  $("#userBtn").onclick=e=>{ e.stopPropagation(); const open=$("#userMenu").classList.toggle("open"); $("#userBtn").setAttribute("aria-expanded", open?"true":"false"); };
  $("#logoutBtn").onclick=logout;
  $("#scrollBtn").onclick=scrollToBottom;
  $("#attachBtn").onclick=()=>$("#fileInput").click();
  $("#fileInput").onchange=e=>{ uploadFile(e.target.files[0]); e.target.value=""; };
  $("#sendBtn").onclick=()=>{ if(generating) stopGen(); else send(); };
  $("#searchInput").addEventListener("input", e=>{ state.search=e.target.value; renderSidebar(); });
  $("#input").addEventListener("input", ()=>{ autoGrow(); updateSendBtn(); });
  $("#input").addEventListener("keydown", e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); send(); } });
  $("#thread").addEventListener("scroll", ()=>{ stick=nearBottom(); updateScrollBtn(); updateNavActive(); });
  document.querySelectorAll("[data-theme-choice]").forEach(b=>b.onclick=()=>applyTheme(b.dataset.themeChoice));
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=closeModals);
  document.querySelectorAll(".overlay").forEach(o=>o.addEventListener("click", e=>{ if(e.target===o) closeModals(); }));
  document.addEventListener("click", closeAllMenus);

  const ov=$("#dragOverlay"); let dragc=0;
  window.addEventListener("dragover", e=>{ e.preventDefault(); });
  window.addEventListener("dragenter", e=>{ e.preventDefault(); dragc++; ov.classList.add("show"); });
  window.addEventListener("dragleave", ()=>{ dragc--; if(dragc<=0){ dragc=0; ov.classList.remove("show"); } });
  window.addEventListener("drop", e=>{ e.preventDefault(); dragc=0; ov.classList.remove("show"); if(e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]); });
  window.addEventListener("paste", e=>{ const f=[...(e.clipboardData?.files||[])][0]; if(f) uploadFile(f); });

  document.addEventListener("keydown", e=>{
    if(e.key==="Escape"){ if(generating) stopGen(); closeAllMenus(); closeModals(); return; }
    const mod=e.ctrlKey||e.metaKey;
    if(mod && e.key.toLowerCase()==="k"){ e.preventDefault(); $("#searchInput").focus(); }
    else if(mod && e.shiftKey && e.key.toLowerCase()==="o"){ e.preventDefault(); newChat(); }
    else if(mod && e.key==="/"){ e.preventDefault(); openModal("helpModal"); }
  });
}

/* ----------------------------- auth / account --------------------------- */
let _authMode="login", _appStarted=false;

async function checkAuth(){
  try{ const r=await fetch("/api/auth/me"); if(r.ok) return await r.json(); }catch(e){}
  return null;
}
function authError(msg){ const e=$("#authError"); if(!e) return; e.textContent=msg||""; e.hidden=!msg; }
function setAuthMode(mode){
  _authMode=mode; const reg=mode==="register";
  $("#nameField").hidden=!reg; $("#pwHint").hidden=!reg;
  $("#authSubmit").textContent=reg?"Create account":"Sign in";
  $("#authToggleText").textContent=reg?"Already have an account?":"New here?";
  $("#authToggleBtn").textContent=reg?"Sign in":"Create an account";
  $("#authPassword").setAttribute("autocomplete", reg?"new-password":"current-password");
  const fl=$("#authForgotLink"); if(fl) fl.hidden=reg;
  authError("");
}

/* password reset + change/delete account */
let _resetToken="";
function showAuthView(view){
  $("#authForm").hidden = view!=="login";
  $("#authToggle").hidden = view!=="login";
  $("#authForgotLink").hidden = view!=="login" || _authMode==="register";
  $("#forgotForm").hidden = view!=="forgot";
  $("#resetForm").hidden = view!=="reset";
  authError("");
}
async function submitForgot(ev){
  ev.preventDefault();
  const email=$("#forgotEmail").value.trim(); if(!email) return;
  const btn=$("#forgotSubmit"); btn.disabled=true; $("#forgotError").hidden=true;
  try{
    await fetch("/api/auth/password-reset",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email})});
    const n=$("#forgotNote"); n.textContent="If an account exists for that email, a reset link is on its way. Check your inbox (and spam)."; n.hidden=false;
  }catch(e){ const er=$("#forgotError"); er.textContent="Network error. Please try again."; er.hidden=false; }
  finally{ btn.disabled=false; }
}
async function submitReset(ev){
  ev.preventDefault();
  const pw=$("#resetPw").value, pw2=$("#resetPw2").value, er=$("#resetError");
  if(pw.length<8){ er.textContent="Password must be at least 8 characters."; er.hidden=false; return; }
  if(pw!==pw2){ er.textContent="Passwords don't match."; er.hidden=false; return; }
  const btn=$("#resetSubmit"); btn.disabled=true; er.hidden=true;
  try{
    const r=await fetch("/api/auth/password-reset-confirm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:_resetToken,new_password:pw})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){ er.textContent=authMessage(d); er.hidden=false; btn.disabled=false; return; }
    history.replaceState(null,"",location.pathname);
    _resetToken=""; setAuthMode("login"); showAuthView("login"); toast("Password reset — please sign in");
  }catch(e){ er.textContent="Network error. Please try again."; er.hidden=false; }
  finally{ btn.disabled=false; }
}
async function changePassword(){
  const cur=$("#curPw").value, np=$("#newPw").value, np2=$("#newPw2").value;
  const m=$("#acctMsg"); const show=(t,ok)=>{ m.textContent=t; m.className="acct-msg "+(ok?"ok":"err"); m.hidden=false; };
  if(np.length<8){ show("New password must be at least 8 characters.",false); return; }
  if(np!==np2){ show("New passwords don't match.",false); return; }
  const btn=$("#changePwBtn"); btn.disabled=true;
  try{
    const r=await fetch("/api/auth/change-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({current_password:cur,new_password:np})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){ show(authMessage(d),false); } else { show("Password changed.",true); $("#curPw").value="";$("#newPw").value="";$("#newPw2").value=""; }
  }catch(e){ show("Network error.",false); } finally{ btn.disabled=false; }
}
async function deleteAccount(){
  const pw=$("#delPw").value; if(!pw) return;
  const btn=$("#delConfirmBtn"); btn.disabled=true;
  try{
    const r=await fetch("/api/auth/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:pw})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){ toast(authMessage(d)||"Could not delete account"); btn.disabled=false; return; }
    try{ localStorage.clear(); }catch(e){}
    location.reload();
  }catch(e){ toast("Network error."); btn.disabled=false; }
}
function showAuth(){
  document.body.classList.remove("authed"); document.body.classList.add("show-auth");
  $("#authScreen").hidden=false; setTimeout(()=>$("#authEmail").focus(),60);
}
function authMessage(d){
  if(typeof d.detail==="string") return d.detail;
  if(Array.isArray(d.detail) && d.detail[0]?.msg) return d.detail[0].msg.replace(/^Value error,?\s*/i,"");
  return "Something went wrong. Please try again.";
}
async function submitAuth(ev){
  ev.preventDefault();
  const email=$("#authEmail").value.trim(), password=$("#authPassword").value, name=$("#authName").value.trim();
  if(!email||!password){ authError("Please enter your email and password."); return; }
  if(_authMode==="register" && password.length<8){ authError("Password must be at least 8 characters."); return; }
  const btn=$("#authSubmit"); btn.disabled=true; btn.classList.add("loading"); authError("");
  const path=_authMode==="register"?"/api/auth/register":"/api/auth/login";
  const body=_authMode==="register"?{email,password,display_name:name}:{email,password};
  try{
    const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const d=await r.json().catch(()=>({}));
    if(!r.ok){ authError(authMessage(d)); btn.disabled=false; btn.classList.remove("loading"); return; }
    await enterApp(d);
  }catch(e){ authError("Network error. Please try again."); btn.disabled=false; btn.classList.remove("loading"); }
}
async function logout(){ try{ await fetch("/api/auth/logout",{method:"POST"}); }catch(e){} location.reload(); }

function renderUser(){
  const u=state.user||{}; const name=u.display_name||u.email||"You";
  $("#userName").textContent=name;
  $("#userAv").textContent=(name.trim()[0]||"U").toUpperCase();
  $("#accountInfo").textContent=u.email||"";
  updateQuota(state.quota);
}
function updateQuota(q){
  if(q) state.quota=q;
  const el=$("#userQuota"); if(!el) return;
  if(!state.quota){ el.textContent=""; return; }
  if(state.quota.unlimited){ el.textContent="Unlimited"; el.classList.remove("low"); return; }
  const rem=state.quota.remaining??0;
  el.textContent=rem+" message"+(rem===1?"":"s")+" left today";
  el.classList.toggle("low", rem<=3);
}
function consumeQuotaLocal(){
  if(!state.quota || state.quota.unlimited) return;
  state.quota.used=(state.quota.used||0)+1;
  state.quota.remaining=Math.max(0,(state.quota.remaining??0)-1);
  updateQuota(state.quota);
}
async function loadHistory(uid){
  const ck="llm_chats_"+uid;
  let local=[]; try{ local=JSON.parse(localStorage.getItem(ck)||"[]"); }catch(e){}
  if(!local.length){ try{ const legacy=JSON.parse(localStorage.getItem("llm_chats")||"[]"); if(legacy.length) local=legacy; }catch(e){} }
  let server=[]; try{ const d=await (await fetch("/api/chats")).json(); server=d.chats||[]; }catch(e){}
  state.chats=server.length?server:local;
  state.current=localStorage.getItem("llm_current_"+uid) || (state.chats[0]&&state.chats[0].id) || null;
  if(!server.length && local.length) syncDB();   // migrate local chats up to the server
}
async function enterApp(me){
  state.user=me; state.quota=me.quota||null; state.uid=me.id;
  document.body.classList.remove("show-auth"); document.body.classList.add("authed");
  $("#authScreen").hidden=true;
  renderUser();
  await loadHistory(me.id);
  if(!_appStarted){ _appStarted=true; await init(); }
}
async function boot(){
  applyTheme(state.theme);
  $("#authForm").addEventListener("submit", submitAuth);
  $("#authToggleBtn").addEventListener("click", ()=> setAuthMode(_authMode==="login"?"register":"login"));
  $("#authForgotLink")?.addEventListener("click", ()=> showAuthView("forgot"));
  $("#forgotBack")?.addEventListener("click", ()=> { setAuthMode("login"); showAuthView("login"); });
  $("#forgotForm")?.addEventListener("submit", submitForgot);
  $("#resetForm")?.addEventListener("submit", submitReset);
  setAuthMode("login");
  _resetToken = new URLSearchParams(location.search).get("reset_token") || "";
  const me=await checkAuth();
  if(me && !_resetToken){ await enterApp(me); return; }
  showAuth();
  if(_resetToken) showAuthView("reset");
}
boot();
