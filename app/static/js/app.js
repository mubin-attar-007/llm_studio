/* LLM Studio — ChatGPT-style frontend (with settings, compare, thinking, voice) */
const $ = s => document.querySelector(s);
const DEFAULT_PERSONA = "You are a helpful, knowledgeable assistant. Use Markdown (tables, lists, fenced code blocks with language tags, and LaTeX math with $...$ or $$...$$) when useful.";

const IC = {
  copy:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>',
  check:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  edit:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
  regen:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>',
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
  compare: Object.assign({on:false, models:[]}, JSON.parse(localStorage.getItem("llm_compare") || "{}")),
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
    const slow = isReasoning(m.id);
    const cur = m.id === state.model ? " sel" : "";
    return `<div class="opt${cur}" onclick="pickModel('${m.id}')"><span class="opt-name">${escapeHtml(shortName(m.id))}</span><span class="opt-tags"><span class="tag-kind ${m.kind}">${m.kind}</span>${slow?'<span class="tag-slow">thinks</span>':''}</span></div>`;
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
function newChat(){ const c={id:uid(), title:"New chat", messages:[], created:Date.now(), updated:Date.now()}; state.chats.unshift(c); state.current=c.id; pendingFile=null; renderAttach(); saveChats(); renderSidebar(); renderThread(); $("#input").focus(); }
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
  let list=[...state.chats].sort((a,b)=>(b.updated||0)-(a.updated||0));
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
  ctx.innerHTML = `<div class="opt" onclick="startRename('${id}')">${IC.edit} Rename</div>
    <div class="opt" onclick="exportChat('${id}')">${IC.copy} Export</div>
    <div class="opt danger" onclick="deleteChat('${id}')">✕ Delete</div>`;
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
  if(empty){ t.innerHTML = `<div class="thread-inner"><div class="empty-hero"><h1>What can I help with?</h1>${examplesHtml()}</div></div>`; updateScrollBtn(); return; }
  t.innerHTML = `<div class="thread-inner">${c.messages.map((m,i)=>rowHtml(m,i,c.messages.length)).join("")}</div>`;
  enhance(t); stick=true; scrollToBottom(); updateScrollBtn();
}
function examplesHtml(){
  const ex=[["Explain simply","Explain how neural networks learn, in plain language."],
            ["Write code","Write a Python function that returns the nth Fibonacci number."],
            ["Draft an email","Draft a polite email requesting a deadline extension."],
            ["Compare ideas","List the pros and cons of remote work."]];
  return `<div class="examples">${ex.map(e=>`<div class="ex" onclick="useExample('${e[1].replace(/'/g,"\\'")}')"><b>${e[0]}</b><span>${e[1]}</span></div>`).join("")}</div>`;
}
function useExample(t){ $("#input").value=t; autoGrow(); updateSendBtn(); $("#input").focus(); }

function rowHtml(m,i,total){
  if(m.role==="user"){
    const file = m.file ? `<div class="file-chip"><span class="ic">📄</span>${escapeHtml(m.file)}</div>` : "";
    return `<div class="row user" data-i="${i}"><div class="bubble-wrap">${file}<div class="bubble">${escapeHtml(m.display!=null?m.display:m.content)}</div>
      <div class="msg-actions"><button class="act" title="Copy" onclick="copyMsg(${i})">${IC.copy}</button>
      <button class="act" title="Edit" onclick="editMsg(${i})">${IC.edit}</button></div></div></div>`;
  }
  if(m.compare){
    const cols = m.compare.map((e,ci)=>{
      const inner = e.error
        ? `${e.content?renderMd(e.content):""}<div class="err-card">⚠️ ${escapeHtml(e.error)}</div>`
        : (e.content ? renderMd(e.content)+(e._streaming?'<span class="cursor"></span>':"")
                     : (e._streaming?'<span class="thinking"><i></i><i></i><i></i></span>':'<span style="color:var(--text-3)">…</span>'));
      const think = e.thinking ? `<details class="think"><summary>Thoughts</summary><div class="tk">${escapeHtml(e.thinking)}</div></details>` : "";
      return `<div class="cmp-col" data-ci="${ci}"><div class="cmp-col-head">${badgeHtml(e.model)}</div><div class="content" data-md="1">${think}${inner}</div></div>`;
    }).join("");
    return `<div class="row assistant" data-i="${i}"><div class="avatar">L</div><div class="asst"><div class="cmp-cols">${cols}</div></div></div>`;
  }
  // single assistant
  const last = i===total-1;
  const mid = m.model || state.model;
  let inner = `<div class="msg-meta">${badgeHtml(mid)}</div>`;
  if(m.thinking || (m._streaming && isReasoning(mid))){
    inner += `<details class="think"${m._streaming?" open":""}><summary>Thoughts</summary><div class="tk">${escapeHtml(m.thinking||"")}</div></details>`;
  }
  const body = m.content ? renderMd(m.content)+(m._streaming?'<span class="cursor"></span>':"")
             : (m._streaming?'<span class="thinking"><i></i><i></i><i></i></span>':"");
  inner += `<div class="content" data-md="1">${body}</div>`;
  if(m.error) inner += `<div class="err-card">⚠️ ${escapeHtml(m.error)}<div class="acts"><button onclick="regen()">Retry</button><button onclick="openModelMenu()">Switch model</button></div></div>`;
  if(!m._streaming && (m.content||m.error)) inner += `<div class="msg-actions"><button class="act" title="Copy" onclick="copyMsg(${i})">${IC.copy}</button>${last?`<button class="act" title="Regenerate" onclick="regen()">${IC.regen}</button>`:''}</div>`;
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
function copyMsg(i){ const m=curChat().messages[i]; navigator.clipboard.writeText(m.display!=null&&m.role==="user"?m.display:m.content); toast("Copied"); }

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
  if(state.compare.on && state.compare.models.length>=2) runCompare(c, maybeTitle);
  else runCompletion(c, maybeTitle);
}

/* ----------------------------- send / stream ---------------------------- */
function sysMsg(){ return {role:"system", content:(state.settings.persona||DEFAULT_PERSONA)}; }
function apiHistory(c, upto){
  const out=[sysMsg()];
  for(let i=0;i<upto;i++){ const m=c.messages[i];
    if(m.role==="user") out.push({role:"user", content:m.content});
    else if(m.compare){ const f=m.compare.find(x=>x.content); if(f) out.push({role:"assistant", content:f.content}); }
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
    if(res.status===401){ msg="Your session expired — reloading…"; setTimeout(()=>location.reload(),1200); }
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
  try{
    await streamInto(apiHistory(c, bi), state.model, ctrl, {
      onToken:(t)=>{ bot.content+=t; if(cEl){ cEl.innerHTML=renderMd(bot.content)+'<span class="cursor"></span>'; smartScroll(); } },
      onThink:(t)=>{ bot.thinking+=t; const tk=row&&row.querySelector(".think .tk"); if(tk){ tk.textContent=bot.thinking; smartScroll(); } },
      onError:(e)=>{ bot.error=e; },
    });
  }catch(e){ if(e.name!=="AbortError") bot.error=e.message; }
  bot._streaming=false;
  if(!bot.content.trim() && !bot.error) bot.error="The model returned no text. Try again or pick another model.";
  setGenerating(false); c.updated=Date.now(); saveChats(); renderThread(); renderSidebar();
  if(maybeTitle) autoTitle(c);
}
async function runCompare(c, maybeTitle){
  const models=state.compare.models.slice(0,3);
  const bot={role:"assistant", compare: models.map(m=>({model:m, content:"", thinking:"", error:"", _streaming:true}))};
  c.messages.push(bot); const bi=c.messages.length-1;
  c.updated=Date.now(); saveChats(); renderSidebar(); renderThread(); setGenerating(true);
  const msgs=apiHistory(c, bi);
  aborts = models.map(()=>new AbortController());
  await Promise.all(models.map((model,ci)=>{
    const entry=bot.compare[ci];
    const col=document.querySelector(`.row[data-i="${bi}"] .cmp-col[data-ci="${ci}"] .content`);
    return streamInto(msgs, model, aborts[ci], {
      onToken:(t)=>{ entry.content+=t; if(col){ col.innerHTML=renderMd(entry.content)+'<span class="cursor"></span>'; smartScroll(); } },
      onThink:(t)=>{ entry.thinking+=t; },
      onError:(e)=>{ entry.error=e; if(col){ col.innerHTML=renderMd(entry.content)+`<div class="err-card">⚠️ ${escapeHtml(e)}</div>`; } },
    }).catch(e=>{ if(e.name!=="AbortError") entry.error=e.message; });
  }));
  bot.compare.forEach(e=>{ e._streaming=false; if(!e.content.trim() && !e.error) e.error="No text returned."; });
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
  const aContent = a ? (a.content || (a.compare && a.compare[0] && a.compare[0].content) || "") : "";
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
    else if(m.compare) m.compare.forEach(e=> md += `**Assistant (${shortName(e.model)}):**\n\n${e.content||e.error}\n\n---\n\n`);
    else md += `**Assistant (${shortName(m.model||"")}):**\n\n${m.content}\n\n---\n\n`;
  });
  const b=new Blob([md],{type:"text/markdown"}); const u=URL.createObjectURL(b);
  const a=document.createElement("a"); a.href=u; a.download=(c.title.replace(/[^\w]+/g,"_")||"chat")+".md"; a.click(); URL.revokeObjectURL(u);
}

/* ----------------------------- compare UI ------------------------------- */
function saveCompare(){ localStorage.setItem("llm_compare", JSON.stringify(state.compare)); }
function toggleCompare(){
  state.compare.on=!state.compare.on;
  if(state.compare.on && state.compare.models.length<2){
    const ids=MODELS.map(m=>m.id); const seed=[];
    if(state.model) seed.push(state.model);
    const alt=ids.find(id=>id!==state.model && /llama|mistral|gemma|gpt-oss-20b|flash|3b/i.test(id));
    if(alt) seed.push(alt);
    state.compare.models=[...new Set(seed)].slice(0,3);
  }
  saveCompare(); updateCompareUI();
}
function updateCompareUI(){
  $("#compareBtn").classList.toggle("active", state.compare.on);
  $("#compareBtn").title = "Compare models ("+(state.compare.on?"on":"off")+")";
  const bar=$("#compareBar"); bar.classList.toggle("show", state.compare.on);
  if(state.compare.on){
    bar.innerHTML = `<span class="cb-label">Compare:</span>` +
      state.compare.models.map(id=>`<span class="cmp-chip">${escapeHtml(shortName(id))} <span class="x" onclick="removeCompare('${id}')">✕</span></span>`).join("") +
      `<button class="cb-edit" onclick="openCompareModal()">✎ choose models</button>`;
  }
}
function removeCompare(id){ state.compare.models=state.compare.models.filter(x=>x!==id); saveCompare(); updateCompareUI(); }
function openCompareModal(){
  $("#compareList").innerHTML = MODELS.map(m=>{
    const checked = state.compare.models.includes(m.id)?"checked":"";
    return `<label class="cmp-item"><input type="checkbox" ${checked} onchange="toggleCompareModel('${m.id}',this)"><span class="nm">${escapeHtml(shortName(m.id))}</span><span class="tag-kind ${m.kind}">${m.kind}</span></label>`;
  }).join("");
  openModal("compareModal");
}
function toggleCompareModel(id, el){
  if(el.checked){ if(state.compare.models.length>=3){ toast("Pick up to 3"); el.checked=false; return; } if(!state.compare.models.includes(id)) state.compare.models.push(id); }
  else state.compare.models=state.compare.models.filter(x=>x!==id);
  saveCompare(); updateCompareUI();
}

/* ----------------------------- settings / voice ------------------------- */
function saveSettings(){ localStorage.setItem("llm_settings", JSON.stringify(state.settings)); }
function wireSettings(){
  const mt=$("#maxTokensRange"), tp=$("#tempRange"), pe=$("#personaInput");
  mt.value=state.settings.maxTokens; $("#maxTokensVal").textContent=state.settings.maxTokens;
  tp.value=state.settings.temperature; $("#tempVal").textContent=(+state.settings.temperature).toFixed(1);
  pe.value=state.settings.persona;
  mt.oninput=()=>{ state.settings.maxTokens=+mt.value; $("#maxTokensVal").textContent=mt.value; saveSettings(); };
  tp.oninput=()=>{ state.settings.temperature=+tp.value; $("#tempVal").textContent=(+tp.value).toFixed(1); saveSettings(); };
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
  await loadModels();
  if(!state.chats.length) newChat(); else if(!state.current) state.current=state.chats[0].id;
  renderSidebar(); renderThread(); updateSendBtn(); wireSettings(); setupVoice(); updateCompareUI();
  if(innerWidth<760) $("#sidebar").classList.add("collapsed");

  $("#newChatBtn").onclick=newChat; $("#newChatIcon").onclick=newChat;
  $("#sidebarToggle").onclick=toggleSidebar; $("#backdrop").onclick=toggleSidebar;
  $("#modelBtn").onclick=e=>{ e.stopPropagation(); const m=$("#modelMenu"); const open=m.classList.contains("open"); closeAllMenus(); if(!open) m.classList.add("open"); };
  $("#compareBtn").onclick=toggleCompare;
  $("#settingsBtn").onclick=()=>openModal("settingsModal");
  $("#helpBtn").onclick=()=>openModal("helpModal");
  $("#userBtn").onclick=e=>{ e.stopPropagation(); const open=$("#userMenu").classList.toggle("open"); $("#userBtn").setAttribute("aria-expanded", open?"true":"false"); };
  $("#logoutBtn").onclick=logout;
  $("#scrollBtn").onclick=scrollToBottom;
  $("#attachBtn").onclick=()=>$("#fileInput").click();
  $("#fileInput").onchange=e=>{ uploadFile(e.target.files[0]); e.target.value=""; };
  $("#sendBtn").onclick=()=>{ if(generating) stopGen(); else send(); };
  $("#searchInput").addEventListener("input", e=>{ state.search=e.target.value; renderSidebar(); });
  $("#input").addEventListener("input", ()=>{ autoGrow(); updateSendBtn(); });
  $("#input").addEventListener("keydown", e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); send(); } });
  $("#thread").addEventListener("scroll", ()=>{ stick=nearBottom(); updateScrollBtn(); });
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
  authError("");
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
  setAuthMode("login");
  const me=await checkAuth();
  if(me) await enterApp(me); else showAuth();
}
boot();
