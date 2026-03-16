(function(){
'use strict';
if(document.getElementById('__suite__')) return;

// ═══════════════════════════════════════════════════════════════
//  SUITE UNIFICADA — Auto Ativos · Magalu
//  Módulos: Confirma ABA · Auto Descarte · Solicitar Ativos · Auto Expedição
//  created by joao.gmarques
// ═══════════════════════════════════════════════════════════════

const __suiteRoot=document.createElement('div');
__suiteRoot.id='__suite__';
__suiteRoot.style.cssText='display:none!important;position:fixed;top:-9999px;';
if(document.body)document.body.appendChild(__suiteRoot);
else document.addEventListener('DOMContentLoaded',()=>document.body.appendChild(__suiteRoot));

// ═══ SHARED CONFIG ════════════════════════════════════════════
const CFG = {
  API: 'https://gestao-ativos-api.magazineluiza.com.br',
  ORIGIN: '0038',
  SHEETS_URL: 'https://script.google.com/macros/s/AKfycbw-FDLDOSJluow1DH22hxYn_fl3qULbDGlSRyfVgM_KCakEzpexmQ9zopFffqQtNU1Zpw/exec',
  POLL_INTERVAL: 20000,
  CDS_PADRAO: [50,94,300,350,550,590,991,1100,1800,2500,2900,5200],
  ADMIN_BRANCH: 38,
  SIMULAR_CD: false,
};

// ═══ SHARED TOKEN STATE ═══════════════════════════════════════
let _tok=null,_tokTs=0,_tokExp=null,_tokenRenovando=false,_tokenSessaoExpirou=false,_tokenUltimoErro=0;
let _userName=null,_userBranch=null,_userLogin=null,_userFullName=null;

// ═══ SHARED TOKEN FUNCTIONS ═══════════════════════════════════
function extractUserFromToken(token){try{const p=(token||'').replace('Bearer ','').split('.');if(p.length!==3)return null;const pl=JSON.parse(atob(p[1]));if(pl.exp)_tokExp=pl.exp*1000;_userBranch=pl.branch||null;_userLogin=(pl.login||pl.preferred_username||'').toUpperCase();_userFullName=pl.name||'';return pl.name||pl.nome||pl.given_name||pl.preferred_username||pl.sub||pl.email||null;}catch{return null;}}
const NOMES_ACENTOS={'joao':'João','jose':'José','maria':'Maria','antonio':'Antônio','marcos':'Marcos','ana':'Ana','paulo':'Paulo','sebastiao':'Sebastião','fabricio':'Fabrício','vinicius':'Vinícius','vitor':'Vítor','vitoria':'Vitória','patricia':'Patrícia','leticia':'Letícia','lucio':'Lúcio','ines':'Inês','helia':'Hélia','beatriz':'Beatriz','regis':'Régis','sergio':'Sérgio','monica':'Mônica','andreia':'Andréia','everton':'Éverton','emerson':'Émerson','edson':'Édson','gabriel':'Gabriel','henrique':'Henrique','guilherme':'Guilherme','caio':'Caio','julio':'Júlio','celia':'Célia','valeria':'Valéria','debora':'Débora','barbara':'Bárbara','claudia':'Cláudia','flavio':'Flávio','marcio':'Márcio','luciana':'Luciana','cesar':'César','eugenio':'Eugênio','rodrigo':'Rodrigo','cristiano':'Cristiano'};
function accentuateName(r){if(!r)return r;return NOMES_ACENTOS[r.toLowerCase()]||r.charAt(0).toUpperCase()+r.slice(1);}
function getFriendlyName(raw){if(!raw)return null;if(raw.includes('@'))raw=raw.split('@')[0];return accentuateName(raw.split(/[\s._-]/)[0]);}

// ═══ SHARED FETCH/XHR INTERCEPTOR ════════════════════════════
(function(){
  const origFetch=window.fetch;
  window.fetch=function(input,init){
    init=init||{};const h=init.headers||{};
    const auth=h.Authorization||h.authorization||'';
    if(auth){
      const full=auth.startsWith('Bearer ')?auth:'Bearer '+auth;
      if(full!==_tok){
        _tok=full;_tokTs=Date.now();window.__MGT__=_tok;window.__MGTS__=_tokTs;
        _tokenSessaoExpirou=false;_tokenUltimoErro=0;
        const u=extractUserFromToken(full);
        if(u){_userName=getFriendlyName(u);updateWelcome();}
        uiTokenAll();
      }
    }
    return origFetch.apply(this,arguments);
  };
  const origSet=XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader=function(k,v){
    if(k.toLowerCase()==='authorization'&&v){
      const full=v.startsWith('Bearer ')?v:'Bearer '+v;
      if(full!==_tok){
        _tok=full;_tokTs=Date.now();window.__MGT__=_tok;window.__MGTS__=_tokTs;
        _tokenSessaoExpirou=false;_tokenUltimoErro=0;
        const u=extractUserFromToken(full);
        if(u){_userName=getFriendlyName(u);updateWelcome();}
        uiTokenAll();
      }
    }
    return origSet.apply(this,arguments);
  };
})();

// ═══ SHARED SYNC + TOKEN LISTENER ════════════════════════════
function syncTok(){
  const t=window.__MGT__;
  if(t&&t!==_tok){
    _tok=t;_tokTs=window.__MGTS__||Date.now();
    if(_tokenSessaoExpirou){_tokenSessaoExpirou=false;_tokenUltimoErro=0;}
    const u=extractUserFromToken(t);
    if(u){_userName=getFriendlyName(u);updateWelcome();}
    uiTokenAll();
  }
}
window.addEventListener('__mgt__',e=>{
  _tok=e.detail;_tokTs=Date.now();_tokenSessaoExpirou=false;_tokenUltimoErro=0;
  const u=extractUserFromToken(e.detail);
  if(u){_userName=getFriendlyName(u);updateWelcome();}
  uiTokenAll();
});
setInterval(syncTok,800);

function getTok(){return _tok;}
function tokSecs(){
  try{const p=(_tok||'').replace('Bearer ','').split('.');if(p.length!==3)return null;
  const pl=JSON.parse(atob(p[1]));return pl.exp?Math.round((pl.exp*1000-Date.now())/1000):null;}
  catch{return null;}
}
function tokMins(){
  try{const p=(_tok||'').replace('Bearer ','').split('.');if(p.length!==3)return null;
  const pl=JSON.parse(atob(p[1]));return pl.exp?Math.round((pl.exp*1000-Date.now())/60000):null;}
  catch{return null;}
}

// ═══ SHARED updateWelcome — updates ALL modules ═══════════════
function updateWelcome(){
  // ── Descarte
  const dscN=document.getElementById('dsc-welcome-name');
  if(dscN&&_userName){dscN.textContent=_userName;const av=document.getElementById('dsc-welcome-av');if(av)av.textContent=_userName[0].toUpperCase();}
  const dscT=document.getElementById('dsc-welcome-toast');
  if(dscT&&!dscT.dataset.shown&&_userName){dscT.dataset.shown='1';const tn=document.getElementById('dsc-toast-name');if(tn)tn.textContent=_userName;dscT.classList.add('show');setTimeout(()=>dscT.classList.add('hide'),3200);setTimeout(()=>dscT.remove(),3800);}
  // ── Solicitação
  const solN=document.getElementById('sol-welcome-name');
  if(solN&&_userName){solN.textContent=_userName;const av=document.getElementById('sol-welcome-av');if(av)av.textContent=_userName[0].toUpperCase();}
  const solT=document.getElementById('sol-welcome-toast');
  if(solT&&!solT.dataset.shown&&_userName){solT.dataset.shown='1';const tn=document.getElementById('sol-toast-name');if(tn)tn.textContent=_userName;solT.classList.add('show');setTimeout(()=>solT.classList.add('hide'),3200);setTimeout(()=>solT.remove(),3800);}
  // ── Expedição
  const expN=document.getElementById('exp-welcome-name');
  if(expN&&_userName){expN.textContent=_userName;const av=document.getElementById('exp-welcome-av');if(av)av.textContent=_userName[0].toUpperCase();}
  const expT=document.getElementById('exp-welcome-toast');
  if(expT&&!expT.dataset.shown&&_userName){expT.dataset.shown='1';const tn=document.getElementById('exp-toast-name');if(tn)tn.textContent=_userName;expT.classList.add('show');setTimeout(()=>expT.classList.add('hide'),3200);setTimeout(()=>expT.remove(),3800);}
  // ── Confirma ABA
  const cabaN=document.getElementById('caba-welcome-name');
  if(cabaN&&_userName){cabaN.textContent=_userName;const av=document.getElementById('caba-welcome-av');if(av)av.textContent=_userName[0].toUpperCase();}
  const cabaT=document.getElementById('caba-welcome-toast');
  if(cabaT&&!cabaT.dataset.shown&&_userName){cabaT.dataset.shown='1';const tn=document.getElementById('caba-toast-name');if(tn)tn.textContent=_userName;cabaT.classList.add('show');setTimeout(()=>cabaT.classList.add('hide'),3200);setTimeout(()=>cabaT.remove(),3800);}
}

// ═══ SHARED TOKEN RENEWAL ════════════════════════════════════
async function _renovarTokenSilencioso(){
  if(_tokenRenovando)return false;
  if(_tokenSessaoExpirou&&Date.now()-_tokenUltimoErro<5*60*1000)return false;
  _tokenRenovando=true;
  try{
    const code=await new Promise((resolve,reject)=>{
      const state=Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
      const iframe=document.createElement('iframe');
      iframe.style.cssText='display:none;position:fixed;top:-9999px;';
      document.body.appendChild(iframe);
      const timeout=setTimeout(()=>{try{document.body.removeChild(iframe);}catch(_){}reject(new Error('Timeout ao renovar token'));},20000);
      const monitor=setInterval(()=>{
        try{
          const url=iframe.contentWindow.location.href;
          if(url.includes('baap-sso-login')||url.includes('/login')){
            clearInterval(monitor);clearTimeout(timeout);
            try{document.body.removeChild(iframe);}catch(_){}
            reject(new Error('SESSAO_EXPIROU'));return;
          }
          const c=url.match(/code=([a-f0-9-]+)/)?.[1];
          if(c){clearInterval(monitor);clearTimeout(timeout);try{document.body.removeChild(iframe);}catch(_){}resolve(c);}
        }catch(_){}
      },50);
      iframe.src=`https://baap-sso-api.magazineluiza.com.br/auth?application_id=61df0c4efa2156a81962dd3c&url_callback=https://gestaoativos.magazineluiza.com.br&state=${state}`;
    });
    const res=await fetch(`https://baap-sso-api.magazineluiza.com.br/token/${code}`,{credentials:'include',headers:{'accept':'application/json, text/plain, */*'}});
    const data=await res.json();
    if(data?.value?.access_token){
      _tok='Bearer '+data.value.access_token;
      _tokTs=Date.now();window.__MGT__=_tok;window.__MGTS__=_tokTs;
      _tokenSessaoExpirou=false;_tokenUltimoErro=0;
      const u=extractUserFromToken(_tok);
      if(u){_userName=getFriendlyName(u);updateWelcome();}
      uiTokenAll();return true;
    }
  }catch(e){
    if(e.message==='SESSAO_EXPIROU'){
      if(!_tokenSessaoExpirou)uiTokenAll();
      _tokenSessaoExpirou=true;_tokenUltimoErro=Date.now();
    }else{
      _tokenRenovando=false;
      const retry=await _renovarTokenSilencioso();
      if(!retry)_tokenUltimoErro=Date.now();
      return retry;
    }
  }finally{_tokenRenovando=false;}
  return false;
}
async function ensureToken(){const s=tokSecs();if(_tok&&s!==null&&s<120)await _renovarTokenSilencioso();}
setInterval(async()=>{const s=tokSecs();if(_tok&&s!==null&&s<=60)await _renovarTokenSilencioso();},15000);

// ═══ SHARED HELPERS ══════════════════════════════════════════
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pad=(c,n=4)=>String(c).padStart(n,'0');
const norm=c=>(c||'').toString().replace(/\D/g,'').replace(/^0+/,'');

// ═══ SHARED MODAL ════════════════════════════════════════════
function modal(cfg){
  return new Promise(res=>{
    const ov=document.createElement('div');ov.className='aa-ov';
    const m=document.createElement('div');m.className='aa-modal'+(cfg.wide?' '+cfg.wide:'');
    const ico=cfg.icone||(cfg.tipo==='err'?'⚠️':cfg.tipo==='ok'?'✅':'ℹ️');
    const tc=cfg.tipo==='err'?'var(--mg-red)':cfg.tipo==='ok'?'var(--mg-green)':cfg.tipo==='warn'?'var(--mg-orange)':'var(--mg-blue)';
    let h='<div class="aa-m-ico">'+ico+'</div><div class="aa-m-ttl" style="color:'+tc+'">'+cfg.titulo+'</div>';
    if(cfg.mensagem)h+='<div class="aa-m-msg">'+cfg.mensagem+'</div>';
    if(cfg.det)h+='<div class="aa-m-det">'+cfg.det+'</div>';
    if(cfg.html)h+=cfg.html;
    h+='<div class="aa-m-btns">';
    (cfg.btns||[]).forEach(b=>{h+='<button class="aa-mb '+(b.cls||'s')+'" data-v="'+b.v+'">'+b.t+'</button>';});
    h+='</div>';
    m.innerHTML=h;ov.appendChild(m);document.body.appendChild(ov);
    m.querySelectorAll('[data-v]').forEach(btn=>{btn.addEventListener('click',()=>{ov.remove();res(btn.dataset.v);});});
    ov.addEventListener('click',e=>{if(e.target===ov){ov.remove();res(null);}});
  });
}
function prompt2(cfg){
  return new Promise(res=>{
    const ov=document.createElement('div');ov.className='aa-ov';
    const m=document.createElement('div');m.className='aa-modal';
    const ico=cfg.icone||'📝';
    m.innerHTML='<div class="aa-m-ico">'+ico+'</div>'+
      '<div class="aa-m-ttl" style="color:var(--mg-blue)">'+cfg.titulo+'</div>'+
      '<div class="aa-m-msg">'+(cfg.mensagem||'')+'</div>'+
      '<input class="aa-m-inp" id="__aai__" placeholder="'+(cfg.ph||'')+'" />'+
      '<div class="aa-m-btns">'+
        '<button class="aa-mb s" id="__aac__">Cancelar</button>'+
        '<button class="aa-mb p" id="__aao__">Confirmar</button>'+
      '</div>';
    ov.appendChild(m);document.body.appendChild(ov);
    const inp=m.querySelector('#__aai__');setTimeout(()=>inp.focus(),50);
    m.querySelector('#__aac__').addEventListener('click',()=>{ov.remove();res(null);});
    const ok=()=>{ov.remove();res(inp.value.trim()||null);};
    m.querySelector('#__aao__').addEventListener('click',ok);
    inp.addEventListener('keypress',e=>{if(e.key==='Enter')ok();});
  });
}
function listaModal(cfg){
  return new Promise(res=>{
    const ov=document.createElement('div');ov.className='aa-ov';
    const m=document.createElement('div');m.className='aa-modal';m.style.maxWidth='400px';
    let h='<div class="aa-m-ico">'+(cfg.icone||'📋')+'</div>'+
      '<div class="aa-m-ttl" style="color:var(--mg-blue)">'+cfg.titulo+'</div>'+
      '<div style="max-height:250px;overflow-y:auto;margin-bottom:12px;">';
    cfg.itens.forEach((item,i)=>{
      h+='<button class="aa-list-item" data-i="'+i+'"><strong>'+item.t+'</strong><span style="margin-left:8px">'+(item.s||'')+'</span>'+(item.d?'<small>'+item.d+'</small>':'')+'</button>';
    });
    h+='</div><button class="aa-mb s" id="__aalc__">Cancelar</button>';
    m.innerHTML=h;ov.appendChild(m);document.body.appendChild(ov);
    m.querySelectorAll('[data-i]').forEach(btn=>{btn.addEventListener('click',()=>{ov.remove();res(parseInt(btn.dataset.i));});});
    m.querySelector('#__aalc__').addEventListener('click',()=>{ov.remove();res(null);});
  });
}

// ═══ SHARED uiTokenAll ═══════════════════════════════════════
function uiTokenAll(){
  uiTokenDsc();
  uiTokenSol();
  uiTokenExp();
  uiTokenCaba();
}

// ═══ SHARED + PER-MODULE CSS ════════════════════════════════
function injectAllCSS(){
  if(document.getElementById('__suite_css__'))return;
  if(!document.head)return setTimeout(injectAllCSS,10);
  const s=document.createElement('style');
  s.id='__suite_css__';
  s.textContent=`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  /* MELHORIA 7: tons mais escuros para contrastar com o portal branco */
  --mg-bg:       #b8bcc8;
  --mg-panel:    #c8ccd8;
  --mg-s1:       #bfc3cf;
  --mg-s2:       #b2b7c4;
  --mg-s3:       #a6abb9;
  --mg-s4:       #9ba0af;
  --mg-b1:       rgba(0,0,0,0.13);
  --mg-b2:       rgba(0,0,0,0.20);
  --mg-t1:       #0f1120;
  --mg-t2:       #3a4060;
  --mg-t3:       #6b7290;
  --mg-blue:     #0078e6;
  --mg-blue2:    #005bbf;
  --mg-grad:     linear-gradient(90deg,#f5a623 0%,#e8384f 22%,#c026d3 45%,#7c3aed 62%,#0078e6 78%,#00c896 100%);
  --mg-green:    #16a34a;
  --mg-green-lt: rgba(22,163,74,0.15);
  --mg-red:      #dc2626;
  --mg-red-lt:   rgba(220,38,38,0.10);
  --mg-orange:   #d97706;
  --mg-shadow:   0 2px 12px rgba(0,0,0,0.15);
  --mg-shadow-lg:0 12px 48px rgba(0,0,0,0.25),0 2px 8px rgba(0,0,0,0.12);
  --mg-radius:   14px;
  --mg-font:     'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  --mg-mono:     'JetBrains Mono',monospace;
}

/* ═══ SHARED MODAL CSS ═══════════════════════════════════════ */
.aa-ov{
  position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);
  z-index:2147483647;display:flex;align-items:center;justify-content:center;
  animation:ov-in .2s ease;
}
@keyframes ov-in{from{opacity:0}to{opacity:1}}
.aa-modal{
  background:var(--mg-panel);border:1px solid var(--mg-b1);
  border-radius:18px;padding:24px 22px 20px;max-width:400px;width:92%;
  box-shadow:var(--mg-shadow-lg);
  animation:modal-pop .25s cubic-bezier(.34,1.56,.64,1);
  overflow:hidden;position:relative;
}
.aa-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--mg-grad);}
@keyframes modal-pop{from{opacity:0;transform:scale(.92) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
.aa-res-modal{max-width:460px;width:95%;}
.aa-m-ico{font-size:34px;text-align:center;margin-bottom:8px;}
.aa-m-ttl{font-size:15px;font-weight:800;text-align:center;margin-bottom:7px;letter-spacing:-0.3px;}
.aa-m-msg{font-size:11.5px;color:var(--mg-t2);text-align:center;line-height:1.7;margin-bottom:16px;white-space:pre-line;}
.aa-m-btns{display:flex;gap:7px;margin-top:4px;}
.aa-mb{flex:1;padding:11px;border-radius:9px;border:none;font-family:var(--mg-font);font-weight:700;font-size:11px;cursor:pointer;transition:all .18s;}
.aa-mb.p{background:var(--mg-blue);color:#fff;box-shadow:0 2px 10px rgba(0,120,230,0.22);}
.aa-mb.p:hover{background:var(--mg-blue2);transform:translateY(-1px);}
.aa-mb.s{background:var(--mg-s2);border:1px solid var(--mg-b1);color:var(--mg-t2);}
.aa-mb.s:hover{border-color:var(--mg-b2);background:var(--mg-s3);}
.aa-mb.d{background:var(--mg-red-lt);border:1px solid rgba(220,38,38,.2);color:var(--mg-red);}
.aa-res-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:14px;}
.aa-res-cell{background:var(--mg-s1);border:1px solid var(--mg-b1);border-radius:10px;padding:10px 5px;text-align:center;}
.aa-res-val{font-size:22px;font-weight:800;font-family:var(--mg-mono);}
.aa-res-lbl{font-size:8px;color:var(--mg-t3);text-transform:uppercase;letter-spacing:1px;margin-top:2px;font-weight:700;}
.aa-rtable{width:100%;border-collapse:collapse;font-size:10.5px;}
.aa-rtable thead th{text-align:left;color:var(--mg-t3);font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:5px 8px;border-bottom:1px solid var(--mg-b1);}
.aa-rtable tbody td{padding:6px 8px;border-bottom:1px solid var(--mg-b1);}
.aa-rtable tbody tr.ok td{background:rgba(22,163,74,.04);}
.aa-rtable tbody tr.fail td{background:rgba(220,38,38,.04);}
.tag-ok{color:var(--mg-green);font-weight:700;font-size:9.5px;background:var(--mg-green-lt);padding:2px 7px;border-radius:4px;}
.tag-fail{color:var(--mg-red);font-weight:700;font-size:9.5px;background:var(--mg-red-lt);padding:2px 7px;border-radius:4px;}

/* ═══ MODAL FINAL + STARS ═══ */
.aa-final-modal{
  background:var(--mg-panel);border:1px solid var(--mg-b1);
  border-radius:18px;padding:0;max-width:460px;width:95%;
  box-shadow:0 24px 80px rgba(0,0,0,0.22);
  animation:modal-pop .3s cubic-bezier(.34,1.56,.64,1);
  overflow:hidden;
}
.aa-final-header{
  background:linear-gradient(135deg,var(--mg-blue) 0%,#0055c8 100%);
  padding:20px 22px 18px;text-align:center;position:relative;
}
.aa-final-header::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:var(--mg-grad);}
.aa-final-emoji{font-size:36px;margin-bottom:6px;display:block;}
.aa-final-title{font-size:16px;font-weight:800;color:#fff;margin-bottom:3px;}
.aa-final-subtitle{font-size:11px;color:rgba(255,255,255,0.72);font-weight:500;}
.aa-final-name{font-weight:800;color:#fff;}
.aa-final-body{padding:18px 20px;}
.aa-rating-section{text-align:center;padding:12px 0 2px;border-top:1px solid var(--mg-b1);margin-top:8px;}
.aa-rating-label{font-size:10px;color:var(--mg-t2);margin-bottom:8px;font-weight:500;}
.aa-rating{display:inline-flex;flex-direction:row-reverse;gap:3px;}
.aa-rating input{display:none;}
.aa-rating label{
  font-size:28px;cursor:pointer;color:#9aa0b8;
  transition:color .12s ease,transform .18s cubic-bezier(.34,1.56,.64,1);
  display:inline-block;line-height:1;
}
.aa-rating label::before{content:"★";}
.aa-rating label:hover,
.aa-rating label:hover ~ label{color:#fbbf24;transform:scale(1.22);}
.aa-rating input:checked ~ label{color:#f59e0b;}
.aa-rating input:checked + label{animation:star-pop .28s cubic-bezier(.34,1.56,.64,1);}
@keyframes star-pop{0%{transform:scale(0.6);}60%{transform:scale(1.45);}100%{transform:scale(1.22);}}
.aa-rating-thanks{font-size:10px;color:var(--mg-blue);margin-top:7px;min-height:16px;font-weight:600;}
.aa-final-btns{display:flex;gap:7px;margin-top:14px;}

/* APPEAR */


/* ═══════════════════════════════════════════════════════════ */
/* MODULE: AUTO DESCARTE (__dsc__)                             */
/* ═══════════════════════════════════════════════════════════ */
#__dsc__ *,#__dsc__ *::before,#__dsc__ *::after{box-sizing:border-box;}
#__dsc__ ::-webkit-scrollbar{width:4px;}
#__dsc__ ::-webkit-scrollbar-track{background:transparent;}
#__dsc__ ::-webkit-scrollbar-thumb{background:var(--mg-s3);border-radius:10px;}

#__dsc__{
  position:fixed;top:20px;right:20px;
  width:380px;height:auto;max-height:calc(100vh - 40px);
  background:var(--mg-panel);border:1px solid var(--mg-b1);border-radius:16px;
  font-family:var(--mg-font);color:var(--mg-t1);
  z-index:2147483646;display:flex;flex-direction:column;
  box-shadow:var(--mg-shadow-lg);overflow:hidden;will-change:max-height;
  transition:max-height .34s cubic-bezier(.4,0,.2,1),opacity .28s ease,transform .28s cubic-bezier(.4,0,.2,1);
}
#__dsc__.off{opacity:0;pointer-events:none;transform:scale(0.96) translateY(8px);}
#__dsc__::before{
  content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:var(--mg-grad);z-index:5;border-radius:16px 16px 0 0;overflow:hidden;
}
#__dsc__.minimized{max-height:64px !important;border-radius:26px !important;}
#__dsc__.minimized .dsc-body,
#__dsc__.minimized .dsc-log-section,
#__dsc__.minimized .dsc-tok-bar,
#__dsc__.minimized .dsc-welcome-inline{opacity:0;pointer-events:none;}
#__dsc__.minimized .dsc-header{border-bottom:none !important;border-radius:26px !important;}
#__dsc__ .dsc-body,#__dsc__ .dsc-log-section,#__dsc__ .dsc-tok-bar,#__dsc__ .dsc-welcome-inline{transition:opacity .18s ease;}

#__dsc_tab__{
  position:fixed;bottom:24px;right:24px;width:48px;height:48px;
  background:var(--mg-red-btn);border:none;border-radius:50%;
  cursor:pointer;z-index:2147483645;display:none;
  align-items:center;justify-content:center;
  box-shadow:0 4px 20px rgba(0,120,230,0.38);
  transition:transform .22s cubic-bezier(.4,0,.2,1),box-shadow .22s;color:#fff;font-size:18px;
}
#__dsc_tab__:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(0,120,230,0.52);}
@keyframes tab-pop{0%{transform:scale(0.5);opacity:0;}55%{transform:scale(1.35);opacity:1;}75%{transform:scale(0.92);}100%{transform:scale(1);}}
#__dsc_tab__.popping{animation:tab-pop 1.1s cubic-bezier(.34,1.56,.64,1) forwards;}

/* SPINNER */
.dsc-spinner-wrap{width:32px;height:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.dsc-spinner{position:relative;width:60px;height:60px;display:flex;justify-content:center;align-items:center;border-radius:50%;transform:translateX(-38px) scale(0.55);}
.dsc-spinner span{position:absolute;top:50%;left:var(--dsc-left);width:35px;height:7px;background:var(--mg-red-btn);animation:dsc-dominos 1s ease infinite;box-shadow:2px 2px 3px 0px rgba(0,0,0,0.3);}
.dsc-spinner span:nth-child(1){--dsc-left:80px;animation-delay:0.125s;}
.dsc-spinner span:nth-child(2){--dsc-left:70px;animation-delay:0.3s;}
.dsc-spinner span:nth-child(3){left:60px;animation-delay:0.425s;}
.dsc-spinner span:nth-child(4){animation-delay:0.54s;left:50px;}
.dsc-spinner span:nth-child(5){animation-delay:0.665s;left:40px;}
.dsc-spinner span:nth-child(6){animation-delay:0.79s;left:30px;}
.dsc-spinner span:nth-child(7){animation-delay:0.915s;left:20px;}
.dsc-spinner span:nth-child(8){left:10px;}
@keyframes dsc-dominos{50%{opacity:0.7;}75%{transform:rotate(90deg);}80%{opacity:1;}}

/* HEADER */
.dsc-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 16px;border-bottom:1px solid var(--mg-b1);
  flex-shrink:0;cursor:grab;user-select:none;border-radius:16px 16px 0 0;
  background:radial-gradient(ellipse at 0% 0%,rgba(0,120,230,0.06) 0%,transparent 60%),var(--mg-panel);
}
.dsc-header:active{cursor:grabbing;}
.dsc-header-left{display:flex;align-items:center;gap:10px;flex:1;min-width:0;}
.dsc-header-info{display:flex;flex-direction:column;justify-content:center;gap:3px;min-width:0;}
.dsc-header-title{font-size:15px;font-weight:700;letter-spacing:-0.2px;color:var(--mg-t1);line-height:1.2;white-space:nowrap;}
.dsc-header-sub{font-size:10px;color:var(--mg-t3);font-weight:500;line-height:1;}
.dsc-header-btns{display:flex;gap:3px;margin-left:8px;flex-shrink:0;}
.dsc-hbtn{background:none;border:none;color:var(--mg-t3);cursor:pointer;width:30px;height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .18s;font-weight:600;}
.dsc-hbtn:hover{background:var(--mg-s2);color:var(--mg-t1);}
.dsc-hbtn.close-btn:hover{background:var(--mg-red-lt);color:var(--mg-red);}
#dsc-min{position:relative;}
#dsc-min::before,#dsc-min::after{content:'';position:absolute;left:50%;top:50%;border-radius:2px;transition:all .18s ease;}
#dsc-min[data-state='open']::before{width:10px;height:2px;background:currentColor;transform:translate(-50%,-50%);}
#dsc-min[data-state='open']::after{display:none;}
#dsc-min[data-state='closed']::before{width:9px;height:9px;background:transparent;border:1.8px solid currentColor;border-radius:2px;transform:translate(-50%,-50%);}
#dsc-min[data-state='closed']::after{display:none;}

/* WELCOME INLINE */
.dsc-welcome-inline{padding:9px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--mg-b1);flex-shrink:0;background:var(--mg-s1);}
.dsc-welcome-av{width:32px;height:32px;border-radius:50%;background:var(--mg-red-btn);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0;}
.dsc-welcome-txt{font-size:13px;color:var(--mg-t2);font-weight:500;}
.dsc-welcome-name{font-weight:700;font-size:13px;color:var(--mg-blue);}
.dsc-welcome-sub{font-size:10px;color:var(--mg-t3);margin-top:1px;}

/* WELCOME TOAST */
@keyframes toast-enter{0%{opacity:0;transform:translate(-50%,-50%) scale(0.82) translateY(24px);}65%{opacity:1;transform:translate(-50%,-50%) scale(1.04) translateY(-4px);}100%{opacity:1;transform:translate(-50%,-50%) scale(1) translateY(0);}}
@keyframes toast-exit{0%{opacity:1;transform:translate(-50%,-50%) scale(1);}100%{opacity:0;transform:translate(-50%,-50%) scale(0.94) translateY(-20px);}}
.dsc-welcome-toast{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.82) translateY(24px);background:var(--mg-panel);border:1px solid var(--mg-b1);border-radius:20px;padding:28px 44px;text-align:center;z-index:2147483647;opacity:0;pointer-events:none;box-shadow:var(--mg-shadow-lg);overflow:hidden;}
.dsc-welcome-toast::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--mg-grad);}
.dsc-welcome-toast.show{animation:toast-enter .55s cubic-bezier(.34,1.56,.64,1) forwards;}
.dsc-welcome-toast.hide{animation:toast-exit .4s ease-in forwards;}
.dsc-toast-greeting{font-size:13px;color:var(--mg-t2);margin-bottom:4px;font-weight:500;}
.dsc-toast-name{font-size:26px;font-weight:800;color:var(--mg-blue);letter-spacing:-0.5px;}
.dsc-toast-brand{font-size:10px;color:var(--mg-t3);margin-top:8px;letter-spacing:1px;font-weight:600;}

/* TOKEN BAR */
.dsc-tok-bar{display:flex;align-items:center;gap:8px;padding:7px 16px;font-size:11.5px;border-bottom:1px solid var(--mg-b1);flex-shrink:0;background:var(--mg-s1);font-weight:600;transition:color .3s;}
.dsc-tok-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;transition:background .3s,box-shadow .3s;}
.dsc-tok-label{flex-shrink:0;white-space:nowrap;font-size:11px;}
.dsc-tok-track{flex:1;height:4px;background:var(--mg-s3);border-radius:4px;overflow:hidden;min-width:30px;}
.dsc-tok-fill{height:100%;border-radius:4px;width:100%;transition:width 1s linear,background-color .4s;}
.dsc-tok-bar.ok .dsc-tok-dot{background:var(--mg-green);box-shadow:0 0 0 3px rgba(22,163,74,0.22);}
.dsc-tok-bar.ok .dsc-tok-fill{background:var(--mg-green);}
.dsc-tok-bar.ok{color:var(--mg-t2);}
.dsc-tok-bar.w .dsc-tok-dot{background:var(--mg-orange);animation:tok-blink 1.2s infinite;}
.dsc-tok-bar.w .dsc-tok-fill{background:var(--mg-orange);}
.dsc-tok-bar.w{color:var(--mg-orange);}
.dsc-tok-bar.ex .dsc-tok-dot{background:var(--mg-red);animation:tok-blink .7s infinite;}
.dsc-tok-bar.ex .dsc-tok-fill{background:var(--mg-red);}
.dsc-tok-bar.ex{color:var(--mg-red);}
@keyframes tok-blink{0%,100%{opacity:1}50%{opacity:.15}}

/* BODY */
.dsc-body{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:9px;background:var(--mg-bg);}

/* CARDS */
.dsc-card{background:var(--mg-panel);border:1px solid var(--mg-b1);border-radius:11px;padding:11px 13px;transition:border-color .2s,box-shadow .2s;box-shadow:0 1px 3px rgba(0,0,0,0.08);}
.dsc-card:hover{border-color:var(--mg-b2);box-shadow:0 2px 10px rgba(0,0,0,0.12);}
.dsc-card-label{font-size:10.5px;font-weight:700;color:var(--mg-t3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;}

/* TUTORIAL (estilo gemco-desc do solicitar) */
.dsc-tutorial{
  background:rgba(0,120,230,0.07);
  border:1px solid rgba(0,120,230,0.14);
  border-radius:8px;padding:9px 12px;margin-bottom:8px;
  font-size:11.5px;color:var(--mg-t2);line-height:1.6;
}
.dsc-tutorial strong{color:var(--mg-blue);font-weight:700;}
.dsc-tutorial-example{
  display:inline-block;margin-top:4px;font-family:var(--mg-mono);font-size:11px;
  background:var(--mg-panel);border:1px solid rgba(0,120,230,0.18);
  border-radius:5px;padding:3px 9px;color:var(--mg-t1);
}

/* HINTS */
.dsc-hints{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;}
.dsc-hint{font-size:10.5px;color:var(--mg-t3);background:var(--mg-s2);border:1px solid var(--mg-b1);border-radius:5px;padding:3px 9px;font-family:var(--mg-mono);cursor:pointer;transition:all .18s;}
.dsc-hint:hover{border-color:var(--mg-red);color:var(--mg-red);background:var(--mg-red-lt);}

/* TEXTAREA */
.dsc-ta{width:100%;background:var(--mg-s1);border:1.5px solid var(--mg-b1);border-radius:9px;color:var(--mg-t1);font-size:12.5px;font-family:var(--mg-mono);padding:9px 11px;box-sizing:border-box;resize:vertical;outline:none;line-height:1.7;transition:border-color .2s,box-shadow .2s,background .2s;min-height:90px;}
.dsc-ta:focus{border-color:var(--mg-blue);box-shadow:0 0 0 3px rgba(0,120,230,0.12);background:var(--mg-panel);}
.dsc-ta::placeholder{color:var(--mg-t3);}

/* BOTÃO INICIAR */
.dsc-btn-run-wrap{position:relative;display:flex;justify-content:center;align-items:center;border:none;background:transparent;cursor:pointer;width:100%;padding:0;overflow:hidden;border-radius:999px;isolation:isolate;}
.dsc-btn-run-inner{position:relative;z-index:1;letter-spacing:1.5px;font-weight:700;font-size:13px;background:var(--mg-red-btn);border-radius:999px;color:white;padding:11px 20px;font-family:var(--mg-font);width:100%;text-align:center;display:flex;align-items:center;justify-content:center;gap:0;transition:background .22s,transform .15s,box-shadow .22s;box-shadow:0 2px 12px rgba(0,120,230,0.30);}
.dsc-btn-run-wrap:hover .dsc-btn-run-inner{background:var(--mg-red-hover);box-shadow:0 4px 18px rgba(0,120,230,0.38);transform:translateY(-1px);}
.dsc-btn-run-wrap:active .dsc-btn-run-inner{transform:translateY(0);box-shadow:0 1px 6px rgba(0,120,230,0.18);}
.dsc-btn-run-svg{width:0;overflow:hidden;opacity:0;transition:width .25s ease,opacity .25s ease,margin-left .25s ease;flex-shrink:0;display:inline-flex;vertical-align:middle;}
.dsc-btn-run-wrap:hover .dsc-btn-run-svg{width:20px;opacity:1;margin-left:8px;}

/* BOTÃO PARAR */
.dsc-stop-section{padding:0 12px 8px;flex-shrink:0;border-bottom:1px solid var(--mg-b1);display:none;}
.dsc-stop-section.active{display:block;}
.dsc-btn-stop-wrap{position:relative;border-radius:6px;width:100%;height:40px;cursor:pointer;display:none;align-items:center;border:1px solid #cc0000;background-color:#e50000;overflow:hidden;transition:all .3s;box-sizing:border-box;flex-shrink:0;}
.dsc-btn-stop-wrap .dsc-stop-text{transform:translateX(30px);color:#fff;font-weight:600;font-size:11px;font-family:var(--mg-font);letter-spacing:1.5px;transition:all .3s;white-space:nowrap;flex:1;text-align:center;padding-right:40px;}
.dsc-btn-stop-wrap .dsc-stop-icon{position:absolute;right:0;top:0;height:100%;width:36px;background-color:#cc0000;display:flex;align-items:center;justify-content:center;transition:all .3s;}
.dsc-btn-stop-wrap .dsc-stop-svg{width:18px;height:18px;}
.dsc-btn-stop-wrap:hover{background:#cc0000;}
.dsc-btn-stop-wrap:hover .dsc-stop-text{color:transparent;}
.dsc-btn-stop-wrap:hover .dsc-stop-icon{width:100%;}
.dsc-btn-stop-wrap:active .dsc-stop-icon{background-color:#b20000;}

/* ═══ TYPEWRITER ═══ */
.dsc-typewriter-wrap{display:none;flex-direction:column;align-items:center;gap:8px;padding:10px 0;}
.dsc-typewriter-wrap.active{display:flex;}
.dsc-typewriter{
  --blue:#5C86FF;--blue-dark:#275EFE;--key:#fff;
  --paper:#EEF0FD;--text:#D3D4EC;--tool:#FBC56C;--duration:3s;
  position:relative;
  animation:bounce05 var(--duration) linear infinite;
  transform-origin:center bottom;
}
.dsc-typewriter .tw-slide{width:92px;height:20px;border-radius:3px;margin-left:14px;transform:translateX(14px);background:linear-gradient(var(--blue),var(--blue-dark));animation:slide05 var(--duration) ease infinite;}
.dsc-typewriter .tw-slide::before,.dsc-typewriter .tw-slide::after,.dsc-typewriter .tw-slide i::before{content:"";position:absolute;background:var(--tool);}
.dsc-typewriter .tw-slide::before{width:2px;height:8px;top:6px;left:100%;}
.dsc-typewriter .tw-slide::after{left:94px;top:3px;height:14px;width:6px;border-radius:3px;}
.dsc-typewriter .tw-slide i{display:block;position:absolute;right:100%;width:6px;height:4px;top:4px;background:var(--tool);}
.dsc-typewriter .tw-slide i::before{right:100%;top:-2px;width:4px;border-radius:2px;height:14px;}
.dsc-typewriter .tw-paper{position:absolute;left:24px;top:-26px;width:40px;height:46px;border-radius:5px;background:var(--paper);transform:translateY(46px);animation:paper05 var(--duration) linear infinite;}
.dsc-typewriter .tw-paper::before{content:"";position:absolute;left:6px;right:6px;top:7px;border-radius:2px;height:4px;transform:scaleY(0.8);background:var(--text);box-shadow:0 12px 0 var(--text),0 24px 0 var(--text),0 36px 0 var(--text);}
.dsc-typewriter .tw-keyboard{width:120px;height:56px;margin-top:-10px;z-index:1;position:relative;}
.dsc-typewriter .tw-keyboard::before,.dsc-typewriter .tw-keyboard::after{content:"";position:absolute;}
.dsc-typewriter .tw-keyboard::before{top:0;left:0;right:0;bottom:0;border-radius:7px;background:linear-gradient(135deg,var(--blue),var(--blue-dark));transform:perspective(10px) rotateX(2deg);transform-origin:50% 100%;}
.dsc-typewriter .tw-keyboard::after{left:2px;top:25px;width:11px;height:4px;border-radius:2px;box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);animation:keyboard05 var(--duration) linear infinite;}
.dsc-tw-spinner{display:flex;align-items:center;justify-content:center;gap:0;font-size:11px;font-weight:600;color:var(--mg-t2);font-family:var(--mg-font);height:20px;overflow:hidden;width:100%;}
.dsc-tw-spinner-track{position:relative;overflow:hidden;height:20px;-webkit-mask-image:linear-gradient(transparent 0%,#000 20%,#000 80%,transparent 100%);mask-image:linear-gradient(transparent 0%,#000 20%,#000 80%,transparent 100%);}
.dsc-tw-word{display:block;height:20px;line-height:20px;padding-left:5px;color:var(--mg-blue);font-weight:700;animation:tw-spin 4s infinite;}
@keyframes tw-spin{10%{transform:translateY(-102%);}25%{transform:translateY(-100%);}35%{transform:translateY(-202%);}50%{transform:translateY(-200%);}60%{transform:translateY(-302%);}75%{transform:translateY(-300%);}85%{transform:translateY(-402%);}100%{transform:translateY(-400%);}}
@keyframes bounce05{85%,92%,100%{transform:translateY(0);}89%{transform:translateY(-4px);}95%{transform:translateY(2px);}}
@keyframes slide05{5%{transform:translateX(14px);}15%,30%{transform:translateX(6px);}40%,55%{transform:translateX(0);}65%,70%{transform:translateX(-4px);}80%,89%{transform:translateX(-12px);}100%{transform:translateX(14px);}}
@keyframes paper05{5%{transform:translateY(46px);}20%,30%{transform:translateY(34px);}40%,55%{transform:translateY(22px);}65%,70%{transform:translateY(10px);}80%,85%{transform:translateY(0);}92%,100%{transform:translateY(46px);}}
@keyframes keyboard05{
  5%,12%,21%,30%,39%,48%,57%,66%,75%,84%{box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);}
  9%{box-shadow:15px 2px 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);}
  18%{box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 2px 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);}
  27%{box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 12px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);}
  36%{box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 12px 0 var(--key),60px 12px 0 var(--key),68px 12px 0 var(--key),83px 10px 0 var(--key);}
  45%{box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 2px 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);}
  54%{box-shadow:15px 0 0 var(--key),30px 2px 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);}
  63%{box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 12px 0 var(--key);}
  72%{box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 2px 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);}
  81%{box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 12px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);}
}

/* STATUS / PROGRESS */
.dsc-divider{height:1px;background:var(--mg-b1);margin:1px 0;}
.dsc-status{font-size:11.5px;color:var(--mg-t3);text-align:center;padding:5px 0;min-height:24px;transition:color .3s;font-weight:500;}
.dsc-status.on{color:var(--mg-blue);}
.dsc-progress-wrap{height:3px;background:var(--mg-s2);border-radius:4px;overflow:hidden;display:none;}
.dsc-progress-wrap.on{display:block;}
.dsc-progress-bar{height:100%;background:var(--mg-red-btn);border-radius:4px;transition:width .4s cubic-bezier(.4,0,.2,1);width:0%;}

/* LOG */
.dsc-log-section{border-top:1px solid var(--mg-b1);flex-shrink:0;background:var(--mg-panel);}
.dsc-log-header{display:flex;align-items:center;justify-content:space-between;padding:8px 14px 7px;cursor:pointer;user-select:none;}
.dsc-log-title{font-size:10px;font-weight:700;color:var(--mg-t3);text-transform:uppercase;letter-spacing:1.5px;display:flex;align-items:center;gap:7px;}
.dsc-log-count{background:var(--mg-s2);color:var(--mg-blue);font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;border:1px solid rgba(0,120,230,0.12);}
.dsc-log-clear{background:none;border:none;color:var(--mg-t3);font-size:10.5px;cursor:pointer;padding:2px 8px;border-radius:5px;font-family:var(--mg-font);font-weight:600;transition:all .18s;}
.dsc-log-clear:hover{color:var(--mg-red);background:var(--mg-red-lt);}
.dsc-log-body{max-height:120px;overflow-y:auto;padding:3px 12px 10px;}
.dsc-log-entry{font-size:11px;font-family:var(--mg-mono);padding:2px 0 2px 8px;border-left:2px solid;margin-bottom:2px;line-height:1.5;animation:log-in .2s ease;}
@keyframes log-in{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
.dsc-log-entry.info{border-color:rgba(0,120,230,.35);color:#2a6fb8;}
.dsc-log-entry.ok{border-color:rgba(22,163,74,.35);color:var(--mg-green);}
.dsc-log-entry.warn{border-color:rgba(217,119,6,.35);color:var(--mg-orange);}
.dsc-log-entry.err{border-color:rgba(220,38,38,.45);color:var(--mg-red);}

/* MODAL */
.aa-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);z-index:2147483647;display:flex;align-items:center;justify-content:center;animation:ov-in .2s ease;}
@keyframes ov-in{from{opacity:0}to{opacity:1}}
.aa-modal{background:var(--mg-panel);border:1px solid var(--mg-b1);border-radius:18px;padding:24px 22px 20px;max-width:400px;width:92%;box-shadow:var(--mg-shadow-lg);animation:modal-pop .25s cubic-bezier(.34,1.56,.64,1);overflow:hidden;position:relative;}
.aa-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--mg-grad);}
@keyframes modal-pop{from{opacity:0;transform:scale(.92) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
.aa-res-modal{max-width:460px;width:95%;}
.aa-m-ico{font-size:34px;text-align:center;margin-bottom:8px;}
.aa-m-ttl{font-size:15px;font-weight:800;text-align:center;margin-bottom:7px;letter-spacing:-0.3px;}
.aa-m-msg{font-size:11.5px;color:var(--mg-t2);text-align:center;line-height:1.7;margin-bottom:16px;white-space:pre-line;}
.aa-m-btns{display:flex;gap:7px;margin-top:4px;}
.aa-mb{flex:1;padding:11px;border-radius:9px;border:none;font-family:var(--mg-font);font-weight:700;font-size:11px;cursor:pointer;transition:all .18s;}
.aa-mb.p{background:var(--mg-red-btn);color:#fff;box-shadow:0 2px 10px rgba(0,120,230,0.22);}
.aa-mb.p:hover{background:var(--mg-red-hover);transform:translateY(-1px);}
.aa-mb.s{background:var(--mg-s2);border:1px solid var(--mg-b1);color:var(--mg-t2);}
.aa-mb.s:hover{border-color:var(--mg-b2);background:var(--mg-s3);}
.aa-mb.d{background:var(--mg-red-lt);border:1px solid rgba(220,38,38,.2);color:var(--mg-red);}
.aa-res-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:14px;}
.aa-res-cell{background:var(--mg-s1);border:1px solid var(--mg-b1);border-radius:10px;padding:10px 5px;text-align:center;}
.aa-res-val{font-size:22px;font-weight:800;font-family:var(--mg-mono);}
.aa-res-lbl{font-size:8px;color:var(--mg-t3);text-transform:uppercase;letter-spacing:1px;margin-top:2px;font-weight:700;}
.aa-rtable{width:100%;border-collapse:collapse;font-size:10.5px;}
.aa-rtable thead th{text-align:left;color:var(--mg-t3);font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:5px 8px;border-bottom:1px solid var(--mg-b1);}
.aa-rtable tbody td{padding:6px 8px;border-bottom:1px solid var(--mg-b1);}
.aa-rtable tbody tr.ok td{background:rgba(22,163,74,.04);}
.aa-rtable tbody tr.fail td{background:rgba(220,38,38,.04);}
.tag-ok{color:var(--mg-green);font-weight:700;font-size:9.5px;background:var(--mg-green-lt);padding:2px 7px;border-radius:4px;}
.tag-fail{color:var(--mg-red);font-weight:700;font-size:9.5px;background:var(--mg-red-lt);padding:2px 7px;border-radius:4px;}

/* MODAL FINAL */
.aa-final-modal{background:var(--mg-panel);border:1px solid var(--mg-b1);border-radius:18px;padding:0;max-width:460px;width:95%;box-shadow:0 24px 80px rgba(0,0,0,0.22);animation:modal-pop .3s cubic-bezier(.34,1.56,.64,1);overflow:hidden;}
.aa-final-header{background:linear-gradient(135deg,var(--mg-blue) 0%,#0055c8 100%);padding:20px 22px 18px;text-align:center;position:relative;}
.aa-final-header::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:var(--mg-grad);}
.aa-final-emoji{font-size:36px;margin-bottom:6px;display:block;}
.aa-final-title{font-size:16px;font-weight:800;color:#fff;margin-bottom:3px;}
.aa-final-subtitle{font-size:11px;color:rgba(255,255,255,0.72);font-weight:500;}
.aa-final-name{font-weight:800;color:#fff;}
.aa-final-body{padding:18px 20px;}
.aa-rating-section{text-align:center;padding:12px 0 2px;border-top:1px solid var(--mg-b1);margin-top:8px;}
.aa-rating-label{font-size:10px;color:var(--mg-t2);margin-bottom:8px;font-weight:500;}
.aa-rating{display:inline-flex;flex-direction:row-reverse;gap:3px;}
.aa-rating input{display:none;}
.aa-rating label{font-size:28px;cursor:pointer;color:#9aa0b8;transition:color .12s ease,transform .18s cubic-bezier(.34,1.56,.64,1);display:inline-block;line-height:1;}
.aa-rating label::before{content:"★";}
.aa-rating label:hover,.aa-rating label:hover ~ label{color:#fbbf24;transform:scale(1.22);}
.aa-rating input:checked ~ label{color:#f59e0b;}
.aa-rating input:checked + label{animation:star-pop .28s cubic-bezier(.34,1.56,.64,1);}
@keyframes star-pop{0%{transform:scale(0.6);}60%{transform:scale(1.45);}100%{transform:scale(1.22);}}
.aa-rating-thanks{font-size:10px;color:var(--mg-blue);margin-top:7px;min-height:16px;font-weight:600;}
.aa-final-btns{display:flex;gap:7px;margin-top:14px;}

@keyframes panel-appear{from{opacity:0;transform:translateY(16px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);}}
#__dsc__:not(.off){animation:panel-appear .35s cubic-bezier(.34,1.56,.64,1);}

/* ═══════════════════════════════════════════════════════════ */
/* MODULE: SOLICITAR ATIVOS (__sol__)                          */
/* ═══════════════════════════════════════════════════════════ */
#__sol__ *,#__sol__ *::before,#__sol__ *::after{box-sizing:border-box;}
#__sol__ ::-webkit-scrollbar{width:4px;}
#__sol__ ::-webkit-scrollbar-track{background:transparent;}
#__sol__ ::-webkit-scrollbar-thumb{background:var(--mg-s3);border-radius:10px;}

/* ═══ PANEL ═══ */
#__sol__{
  position:fixed;top:20px;right:20px;
  width:380px;
  height:auto;
  max-height:calc(100vh - 40px);
  background:var(--mg-panel);
  border:1px solid var(--mg-b1);border-radius:16px;
  font-family:var(--mg-font);color:var(--mg-t1);
  z-index:2147483646;
  display:flex;flex-direction:column;
  box-shadow:var(--mg-shadow-lg);
  overflow:hidden;
  will-change:max-height;
  transition:max-height .34s cubic-bezier(.4,0,.2,1),
             opacity .28s ease,
             transform .28s cubic-bezier(.4,0,.2,1);
}
#__sol__.off{opacity:0;pointer-events:none;transform:scale(0.96) translateY(8px);}
/* Fix 1: barinha RGB fica DENTRO do border-radius */
#__sol__::before{
  content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:var(--mg-grad);z-index:5;
  border-radius:16px 16px 0 0;
  /* clip garante que não vaza para fora */
  overflow:hidden;
}

/* MINIMIZED — pill compacta, sem cortar nada */
#__sol__.minimized{
  max-height:64px !important;
  border-radius:26px !important;
}
/* esconde tudo menos header */
#__sol__.minimized .sol-body,
#__sol__.minimized .sol-log-section,
#__sol__.minimized .sol-tok-bar,
#__sol__.minimized .sol-welcome-inline{opacity:0;pointer-events:none;}
/* header vira pill: sem borda inferior, borda arredondada completa */
#__sol__.minimized .sol-header{
  border-bottom:none !important;
  border-radius:26px !important;
}
/* transições suaves */
#__sol__ .sol-body,
#__sol__ .sol-log-section,
#__sol__ .sol-tok-bar,
#__sol__ .sol-welcome-inline{
  transition:opacity .18s ease;
  will-change:opacity;
}
#__sol__::before{transition:none;}
#__sol_tab__{
  position:fixed;bottom:24px;right:24px;width:48px;height:48px;
  background:var(--mg-blue);border:none;border-radius:50%;
  cursor:pointer;z-index:2147483645;display:none;
  align-items:center;justify-content:center;
  box-shadow:0 4px 20px rgba(0,120,230,0.38);
  transition:transform .22s cubic-bezier(.4,0,.2,1),box-shadow .22s;color:#fff;font-size:18px;
}
#__sol_tab__:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(0,120,230,0.52);}
/* pulsa ao ser exibido pelo fechar */

#__sol_tab__.popping{animation:tab-pop 1.1s cubic-bezier(.34,1.56,.64,1) forwards;}

/* ═══ HEADER SPINNER — Uiverse.io by satyamchaudharydev (exato, só prefixado) ═══ */
.sol-spinner-wrap{
  width:32px;height:32px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  overflow:hidden;
}
.sol-spinner{
  position:relative;
  width:60px;height:60px;
  display:flex;justify-content:center;align-items:center;
  border-radius:50%;
  transform:translateX(-38px) scale(0.55);
}
.sol-spinner span{
  position:absolute;
  top:50%;
  left:var(--sol-left);
  width:35px;height:7px;
  background:var(--mg-blue);
  animation:sol-dominos 1s ease infinite;
  box-shadow:2px 2px 3px 0px rgba(0,0,0,0.3);
}
.sol-spinner span:nth-child(1){--sol-left:80px;animation-delay:0.125s;}
.sol-spinner span:nth-child(2){--sol-left:70px;animation-delay:0.3s;}
.sol-spinner span:nth-child(3){left:60px;animation-delay:0.425s;}
.sol-spinner span:nth-child(4){animation-delay:0.54s;left:50px;}
.sol-spinner span:nth-child(5){animation-delay:0.665s;left:40px;}
.sol-spinner span:nth-child(6){animation-delay:0.79s;left:30px;}
.sol-spinner span:nth-child(7){animation-delay:0.915s;left:20px;}
.sol-spinner span:nth-child(8){left:10px;}
@keyframes sol-dominos{
  50%{opacity:0.7;}
  75%{transform:rotate(90deg);}
  80%{opacity:1;}
}

/* ═══ HEADER — estrutura com spinner ═══ */
.sol-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 16px;border-bottom:1px solid var(--mg-b1);
  flex-shrink:0;cursor:grab;user-select:none;
  border-radius:16px 16px 0 0;
  position:relative;
  background:
    radial-gradient(ellipse at 0% 0%, rgba(0,120,230,0.07) 0%, transparent 60%),
    radial-gradient(ellipse at 100% 100%, rgba(0,200,150,0.05) 0%, transparent 55%),
    var(--mg-panel);
}
.sol-header:active{cursor:grabbing;}
.sol-header-left{display:flex;align-items:center;gap:10px;flex:1;min-width:0;}

/* Fix 3: logo vai para dentro do bloco de texto, abaixo do título */
.sol-magalu-logo{
  display:flex;flex-direction:column;align-items:flex-start;
  flex-shrink:0;line-height:1;
}
.sol-magalu-logo svg{display:block;}
.sol-logo-bar{height:3px;border-radius:2px;background:var(--mg-grad);}

.sol-header-info{display:flex;flex-direction:column;justify-content:center;gap:3px;min-width:0;}
.sol-header-title-row{display:flex;align-items:center;gap:6px;}
.sol-header-title{font-size:15px;font-weight:700;letter-spacing:-0.2px;color:var(--mg-t1);line-height:1.2;white-space:nowrap;}
/* Fix gear: CSS-drawn spinning gear, sempre visivel */
.sol-header-icon{
  display:inline-flex;align-items:center;justify-content:center;
  width:18px;height:18px;flex-shrink:0;
}
.sol-header-icon svg{
  animation:hdr-spin 4s linear infinite;
  transform-origin:center;
}
@keyframes hdr-spin{0%{transform:rotate(0deg);}100%{transform:rotate(360deg);}}
.sol-header-sub{font-size:10px;color:var(--mg-t3);font-weight:500;line-height:1;}
.sol-header-btns{display:flex;gap:3px;margin-left:8px;flex-shrink:0;}
.sol-hbtn{
  background:none;border:none;color:var(--mg-t3);cursor:pointer;
  width:30px;height:30px;border-radius:7px;
  display:flex;align-items:center;justify-content:center;
  font-size:14px;transition:all .18s;font-weight:600;
}
.sol-hbtn:hover{background:var(--mg-s2);color:var(--mg-t1);}
.sol-hbtn.close-btn:hover{background:var(--mg-red-lt);color:var(--mg-red);}

/* ícone minimizar — linha e quadrado feitos em CSS puro */
#sol-min{position:relative;}
#sol-min::before,#sol-min::after{
  content:'';position:absolute;left:50%;top:50%;
  border-radius:2px;
  transition:all .18s ease;
}
/* estado open: traço horizontal (minimizar) */
#sol-min[data-state='open']::before{
  width:10px;height:2px;
  background:currentColor;
  transform:translate(-50%,-50%);
}
#sol-min[data-state='open']::after{display:none;}
/* estado closed: quadrado (restaurar) */
#sol-min[data-state='closed']::before{
  width:9px;height:9px;
  background:transparent;
  border:1.8px solid currentColor;
  border-radius:2px;
  transform:translate(-50%,-50%);
}
#sol-min[data-state='closed']::after{display:none;}

/* ═══ WELCOME INLINE ═══ */
.sol-welcome-inline{
  padding:9px 16px;display:flex;align-items:center;gap:10px;
  border-bottom:1px solid var(--mg-b1);flex-shrink:0;background:var(--mg-s1);
}
.sol-welcome-av{
  width:32px;height:32px;border-radius:50%;background:var(--mg-blue);
  display:flex;align-items:center;justify-content:center;
  font-size:14px;font-weight:700;color:#fff;flex-shrink:0;
}
.sol-welcome-txt{font-size:13px;color:var(--mg-t2);font-weight:500;}
.sol-welcome-name{font-weight:700;font-size:13px;color:var(--mg-blue);}
.sol-welcome-sub{font-size:10px;color:var(--mg-t3);margin-top:1px;}

/* ═══ WELCOME TOAST ═══ */


.sol-welcome-toast{
  position:fixed;top:50%;left:50%;
  transform:translate(-50%,-50%) scale(0.82) translateY(24px);
  background:var(--mg-panel);border:1px solid var(--mg-b1);
  border-radius:20px;padding:28px 44px;text-align:center;
  z-index:2147483647;opacity:0;pointer-events:none;
  box-shadow:var(--mg-shadow-lg);overflow:hidden;
  /* sem transition — usamos animation pra controle total */
}
.sol-welcome-toast::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--mg-grad);}
.sol-welcome-toast.show{
  animation:toast-enter .55s cubic-bezier(.34,1.56,.64,1) forwards;
}
.sol-welcome-toast.hide{
  animation:toast-exit .4s ease-in forwards;
}
.sol-toast-greeting{font-size:13px;color:var(--mg-t2);margin-bottom:4px;font-weight:500;}
.sol-toast-name{font-size:26px;font-weight:800;color:var(--mg-blue);letter-spacing:-0.5px;}
.sol-toast-brand{font-size:10px;color:var(--mg-t3);margin-top:8px;letter-spacing:1px;font-weight:600;}
.sol-toast-logo{margin:10px auto 0;display:flex;flex-direction:column;align-items:center;gap:3px;}

/* ═══ TOKEN BAR ═══ */
.sol-tok-bar{
  display:flex;align-items:center;gap:8px;
  padding:7px 16px;font-size:11.5px;
  border-bottom:1px solid var(--mg-b1);flex-shrink:0;
  background:var(--mg-s1);font-weight:600;
  transition:color .3s;
}
.sol-tok-dot{
  width:8px;height:8px;border-radius:50%;flex-shrink:0;
  transition:background .3s,box-shadow .3s;
}
.sol-tok-label{flex-shrink:0;white-space:nowrap;font-size:11px;}
.sol-tok-track{
  flex:1;height:4px;background:var(--mg-s3);border-radius:4px;
  overflow:hidden;min-width:30px;
}
.sol-tok-fill{
  height:100%;border-radius:4px;width:100%;
  transition:width 1s linear, background-color .4s;
}
/* States */
.sol-tok-bar.ok .sol-tok-dot{background:var(--mg-green);box-shadow:0 0 0 3px rgba(22,163,74,0.22);}
.sol-tok-bar.ok .sol-tok-fill{background:var(--mg-green);}
.sol-tok-bar.ok{color:var(--mg-t2);}
.sol-tok-bar.w .sol-tok-dot{background:var(--mg-orange);animation:tok-blink 1.2s infinite;}
.sol-tok-bar.w .sol-tok-fill{background:var(--mg-orange);}
.sol-tok-bar.w{color:var(--mg-orange);}
.sol-tok-bar.ex .sol-tok-dot{background:var(--mg-red);animation:tok-blink .7s infinite;}
.sol-tok-bar.ex .sol-tok-fill{background:var(--mg-red);}
.sol-tok-bar.ex{color:var(--mg-red);}


/* ═══ BODY — MELHORIA 5: mais compacto ═══ */
.sol-body{
  flex:1;overflow-y:auto;padding:10px 12px;
  display:flex;flex-direction:column;gap:9px;
  background:var(--mg-bg);
}

/* ═══ CARDS ═══ */
.sol-card{
  background:var(--mg-panel);border:1px solid var(--mg-b1);
  border-radius:11px;padding:11px 13px;
  transition:border-color .2s,box-shadow .2s;
  box-shadow:0 1px 3px rgba(0,0,0,0.08);
}
.sol-card:hover{border-color:var(--mg-b2);box-shadow:0 2px 10px rgba(0,0,0,0.12);}
.sol-card-label{font-size:10.5px;font-weight:700;color:var(--mg-t3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;}

/* ═══ SELETOR MODO ═══ */
.sol-modo-selector{
  position:relative;display:flex;flex-wrap:wrap;
  border-radius:7px;background:var(--mg-s2);
  box-shadow:0 0 0 1px rgba(0,0,0,0.08);
  padding:3px;margin-bottom:10px;
}
.sol-modo-radio{flex:1 1 auto;text-align:center;}
.sol-modo-radio input{display:none;}
.sol-modo-radio .sol-modo-name{
  display:flex;cursor:pointer;align-items:center;justify-content:center;
  border-radius:5px;border:none;padding:7px 0;
  font-size:11.5px;font-weight:500;color:var(--mg-t2);
  font-family:var(--mg-font);
  transition:all .15s ease-in-out;
}
.sol-modo-radio input:checked + .sol-modo-name{
  background:rgba(255,255,255,0.7);font-weight:700;color:var(--mg-blue);
  box-shadow:0 1px 6px rgba(0,0,0,0.12);
  position:relative;
  animation:modo-select .3s ease;
}
.sol-modo-radio:hover .sol-modo-name{background:rgba(255,255,255,0.35);}
@keyframes modo-select{0%{transform:scale(0.95);}50%{transform:scale(1.05);}100%{transform:scale(1);}}
.sol-modo-radio input:checked + .sol-modo-name::before,
.sol-modo-radio input:checked + .sol-modo-name::after{
  content:"";position:absolute;width:4px;height:4px;
  border-radius:50%;background:var(--mg-blue);opacity:0;
  animation:modo-particles .5s ease forwards;
}
.sol-modo-radio input:checked + .sol-modo-name::before{top:-8px;left:50%;transform:translateX(-50%);--direction:-10px;}
.sol-modo-radio input:checked + .sol-modo-name::after{bottom:-8px;left:50%;transform:translateX(-50%);--direction:10px;}
@keyframes modo-particles{0%{opacity:0;transform:translateX(-50%) translateY(0);}50%{opacity:1;}100%{opacity:0;transform:translateX(-50%) translateY(var(--direction));}}

/* ═══ GEMCO DESC — compacto ═══ */
.sol-gemco-desc{
  background:rgba(0,120,230,0.08);
  border:1px solid rgba(0,120,230,0.14);
  border-radius:8px;padding:9px 12px;margin-bottom:8px;
  font-size:11.5px;color:var(--mg-t2);line-height:1.6;
}
.sol-gemco-desc strong{color:var(--mg-blue);font-weight:700;}
.sol-gemco-example{
  display:inline-block;margin-top:4px;font-family:var(--mg-mono);font-size:11px;
  background:var(--mg-panel);border:1px solid rgba(0,120,230,0.2);
  border-radius:5px;padding:3px 9px;color:var(--mg-t1);
}

/* ═══ TEXTAREA ═══ */
.sol-ta{
  width:100%;background:var(--mg-s1);border:1.5px solid var(--mg-b1);border-radius:9px;
  color:var(--mg-t1);font-size:12.5px;font-family:var(--mg-mono);
  padding:9px 11px;box-sizing:border-box;resize:vertical;outline:none;line-height:1.7;
  transition:border-color .2s,box-shadow .2s,background .2s;
  min-height:70px;
}
.sol-ta:focus{border-color:var(--mg-blue);box-shadow:0 0 0 3px rgba(0,120,230,0.12);background:var(--mg-panel);}
.sol-ta::placeholder{color:var(--mg-t3);}
.sol-hints{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px;}
.sol-hint{
  font-size:10.5px;color:var(--mg-t3);background:var(--mg-s2);border:1px solid var(--mg-b1);
  border-radius:5px;padding:3px 9px;font-family:var(--mg-mono);cursor:pointer;transition:all .18s;
}
.sol-hint:hover{border-color:var(--mg-blue);color:var(--mg-blue);background:rgba(0,120,230,0.1);}

/* ═══ INPUTS / SELECTS ═══ */
.sol-row{display:flex;gap:7px;margin-bottom:7px;}
.sol-row:last-child{margin-bottom:0;}
.sol-sel-wrap{flex:1;position:relative;}
.sol-sel{
  width:100%;background:var(--mg-s1);border:1.5px solid var(--mg-b1);
  border-radius:9px;color:var(--mg-t1);font-size:12.5px;
  padding:9px 30px 9px 12px;appearance:none;outline:none;cursor:pointer;
  font-family:var(--mg-font);font-weight:500;transition:border-color .2s,box-shadow .2s;
}
.sol-sel:focus{border-color:var(--mg-blue);box-shadow:0 0 0 3px rgba(0,120,230,0.12);}
.sol-sa{position:absolute;right:11px;top:50%;transform:translateY(-50%);pointer-events:none;color:var(--mg-t3);font-size:10px;}
.sol-inp{
  flex:1;background:var(--mg-s1);border:1.5px solid var(--mg-b1);
  border-radius:9px;color:var(--mg-t1);font-size:12.5px;
  font-family:var(--mg-mono);font-weight:500;
  padding:9px 12px;box-sizing:border-box;outline:none;
  transition:border-color .2s,box-shadow .2s;
}
.sol-inp:focus{border-color:var(--mg-blue);box-shadow:0 0 0 3px rgba(0,120,230,0.12);}
.sol-inp::placeholder{color:var(--mg-t3);}

/* ═══ BOTÃO INICIAR — MELHORIA 3: corrigido ═══ */
.sol-btn-run-wrap{
  position:relative;display:flex;justify-content:center;align-items:center;
  border:none;background:transparent;cursor:pointer;
  width:100%;padding:0;overflow:hidden;border-radius:999px;
  isolation:isolate;
}
.sol-btn-run-inner{
  position:relative;z-index:1;
  letter-spacing:1.5px;font-weight:700;font-size:13px;
  background:var(--mg-blue);border-radius:999px;
  color:white;padding:11px 20px;
  font-family:var(--mg-font);
  width:100%;text-align:center;
  display:flex;align-items:center;justify-content:center;gap:0;
  transition:background .22s, transform .15s, box-shadow .22s;
  box-shadow:0 2px 12px rgba(0,120,230,0.30);
}
.sol-btn-run-wrap:hover .sol-btn-run-inner{
  background:var(--mg-blue2);
  box-shadow:0 4px 18px rgba(0,120,230,0.42);
  transform:translateY(-1px);
}
.sol-btn-run-wrap:active .sol-btn-run-inner{transform:translateY(0);box-shadow:0 1px 6px rgba(0,120,230,0.22);}
/* seta aparece no hover */
.sol-btn-run-svg{
  width:0;overflow:hidden;opacity:0;
  transition:width .25s ease, opacity .25s ease, margin-left .25s ease;
  flex-shrink:0;display:inline-flex;vertical-align:middle;
}
.sol-btn-run-wrap:hover .sol-btn-run-svg{width:20px;opacity:1;margin-left:8px;}

/* ═══ BOTÃO PARAR ═══ */
.sol-stop-section{padding:0 12px 8px;flex-shrink:0;border-bottom:1px solid var(--mg-b1);display:none;}
.sol-stop-section.active{display:block;}
.sol-btn-stop-wrap{
  position:relative;border-radius:6px;width:100%;height:40px;
  cursor:pointer;display:none;align-items:center;
  border:1px solid #cc0000;background-color:#e50000;
  overflow:hidden;transition:all .3s;box-sizing:border-box;flex-shrink:0;
}
.sol-btn-stop-wrap .sol-stop-text{
  transform:translateX(30px);color:#fff;font-weight:600;font-size:11px;
  font-family:var(--mg-font);letter-spacing:1.5px;transition:all .3s;white-space:nowrap;
  flex:1;text-align:center;padding-right:40px;
}
.sol-btn-stop-wrap .sol-stop-icon{
  position:absolute;right:0;top:0;height:100%;width:36px;
  background-color:#cc0000;display:flex;align-items:center;justify-content:center;transition:all .3s;
}
.sol-btn-stop-wrap .sol-stop-icon .sol-stop-svg{width:18px;height:18px;}
.sol-btn-stop-wrap:hover{background:#cc0000;}
.sol-btn-stop-wrap:hover .sol-stop-text{color:transparent;}
.sol-btn-stop-wrap:hover .sol-stop-icon{width:100%;transform:translateX(0);}
.sol-btn-stop-wrap:active .sol-stop-icon{background-color:#b20000;}
.sol-btn-stop-wrap:active{border-color:#b20000;}

/* ═══ TYPEWRITER (Uiverse Nawsome — original) ═══ */
.sol-typewriter-wrap{display:none;flex-direction:column;align-items:center;gap:8px;padding:10px 0;}
.sol-typewriter-wrap.active{display:flex;}
.sol-typewriter{
  --blue:#5C86FF;--blue-dark:#275EFE;--key:#fff;
  --paper:#EEF0FD;--text:#D3D4EC;--tool:#FBC56C;--duration:3s;
  position:relative;
  animation:bounce05 var(--duration) linear infinite;
  transform-origin:center bottom;
}
.sol-typewriter .tw-slide{
  width:92px;height:20px;border-radius:3px;margin-left:14px;transform:translateX(14px);
  background:linear-gradient(var(--blue),var(--blue-dark));
  animation:slide05 var(--duration) ease infinite;
}
.sol-typewriter .tw-slide::before,.sol-typewriter .tw-slide::after,
.sol-typewriter .tw-slide i::before{content:"";position:absolute;background:var(--tool);}
.sol-typewriter .tw-slide::before{width:2px;height:8px;top:6px;left:100%;}
.sol-typewriter .tw-slide::after{left:94px;top:3px;height:14px;width:6px;border-radius:3px;}
.sol-typewriter .tw-slide i{display:block;position:absolute;right:100%;width:6px;height:4px;top:4px;background:var(--tool);}
.sol-typewriter .tw-slide i::before{right:100%;top:-2px;width:4px;border-radius:2px;height:14px;}
.sol-typewriter .tw-paper{
  position:absolute;left:24px;top:-26px;width:40px;height:46px;
  border-radius:5px;background:var(--paper);transform:translateY(46px);
  animation:paper05 var(--duration) linear infinite;
}
.sol-typewriter .tw-paper::before{
  content:"";position:absolute;left:6px;right:6px;top:7px;
  border-radius:2px;height:4px;transform:scaleY(0.8);background:var(--text);
  box-shadow:0 12px 0 var(--text),0 24px 0 var(--text),0 36px 0 var(--text);
}
.sol-typewriter .tw-keyboard{width:120px;height:56px;margin-top:-10px;z-index:1;position:relative;}
.sol-typewriter .tw-keyboard::before,.sol-typewriter .tw-keyboard::after{content:"";position:absolute;}
.sol-typewriter .tw-keyboard::before{
  top:0;left:0;right:0;bottom:0;border-radius:7px;
  background:linear-gradient(135deg,var(--blue),var(--blue-dark));
  transform:perspective(10px) rotateX(2deg);transform-origin:50% 100%;
}
.sol-typewriter .tw-keyboard::after{
  left:2px;top:25px;width:11px;height:4px;border-radius:2px;
  box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);
  animation:keyboard05 var(--duration) linear infinite;
}
/* word spinner (Uiverse kennyotsu) — adaptado ao tema */
.sol-tw-spinner{
  display:flex;align-items:center;justify-content:center;
  gap:0;
  font-size:11px;font-weight:600;color:var(--mg-t2);
  font-family:var(--mg-font);
  height:20px;overflow:hidden;
  width:100%;
}
.sol-tw-spinner-track{
  position:relative;overflow:hidden;height:20px;
  /* fade top/bottom */
  -webkit-mask-image:linear-gradient(transparent 0%,#000 20%,#000 80%,transparent 100%);
  mask-image:linear-gradient(transparent 0%,#000 20%,#000 80%,transparent 100%);
}
.sol-tw-word{
  display:block;height:20px;line-height:20px;
  padding-left:5px;color:var(--mg-blue);font-weight:700;
  animation:tw-spin 4s infinite;
}







/* ═══ STATUS / PROGRESS ═══ */
.sol-divider{height:1px;background:var(--mg-b1);margin:1px 0;}
.sol-status{font-size:11.5px;color:var(--mg-t3);text-align:center;padding:5px 0;min-height:24px;transition:color .3s;font-weight:500;}
.sol-status.on{color:var(--mg-blue);}
.sol-progress-wrap{height:3px;background:var(--mg-s2);border-radius:4px;overflow:hidden;display:none;}
.sol-progress-wrap.on{display:block;}
.sol-progress-bar{height:100%;background:var(--mg-blue);border-radius:4px;transition:width .4s cubic-bezier(.4,0,.2,1);width:0%;}

/* ═══ LOG — compacto ═══ */
.sol-log-section{border-top:1px solid var(--mg-b1);flex-shrink:0;background:var(--mg-panel);}
.sol-log-header{display:flex;align-items:center;justify-content:space-between;padding:8px 14px 7px;cursor:pointer;user-select:none;}
.sol-log-title{font-size:10px;font-weight:700;color:var(--mg-t3);text-transform:uppercase;letter-spacing:1.5px;display:flex;align-items:center;gap:7px;}
.sol-log-count{background:var(--mg-s2);color:var(--mg-blue);font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;border:1px solid rgba(0,120,230,0.12);}
.sol-log-clear{background:none;border:none;color:var(--mg-t3);font-size:10.5px;cursor:pointer;padding:2px 8px;border-radius:5px;font-family:var(--mg-font);font-weight:600;transition:all .18s;}
.sol-log-clear:hover{color:var(--mg-red);background:var(--mg-red-lt);}
.sol-log-body{max-height:120px;overflow-y:auto;padding:3px 12px 10px;}
.sol-log-entry{font-size:11px;font-family:var(--mg-mono);padding:2px 0 2px 8px;border-left:2px solid;margin-bottom:2px;line-height:1.5;animation:log-in .2s ease;}

.sol-log-entry.info{border-color:rgba(0,120,230,.35);color:#2a6fb8;}
.sol-log-entry.ok{border-color:rgba(22,163,74,.35);color:var(--mg-green);}
.sol-log-entry.warn{border-color:rgba(217,119,6,.35);color:var(--mg-orange);}
.sol-log-entry.err{border-color:rgba(220,38,38,.35);color:var(--mg-red);}

/* ═══ MODAL ═══ */
.aa-ov{
  position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);
  z-index:2147483647;display:flex;align-items:center;justify-content:center;
  animation:ov-in .2s ease;
}

.aa-modal{
  background:var(--mg-panel);border:1px solid var(--mg-b1);
  border-radius:18px;padding:24px 22px 20px;max-width:400px;width:92%;
  box-shadow:var(--mg-shadow-lg);
  animation:modal-pop .25s cubic-bezier(.34,1.56,.64,1);
  overflow:hidden;position:relative;
}
.aa-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--mg-grad);}

.aa-res-modal{max-width:460px;width:95%;}
.aa-m-ico{font-size:34px;text-align:center;margin-bottom:8px;}
.aa-m-ttl{font-size:15px;font-weight:800;text-align:center;margin-bottom:7px;letter-spacing:-0.3px;}
.aa-m-msg{font-size:11.5px;color:var(--mg-t2);text-align:center;line-height:1.7;margin-bottom:16px;white-space:pre-line;}
.aa-m-btns{display:flex;gap:7px;margin-top:4px;}
.aa-mb{flex:1;padding:11px;border-radius:9px;border:none;font-family:var(--mg-font);font-weight:700;font-size:11px;cursor:pointer;transition:all .18s;}
.aa-mb.p{background:var(--mg-blue);color:#fff;box-shadow:0 2px 10px rgba(0,120,230,0.22);}
.aa-mb.p:hover{background:var(--mg-blue2);transform:translateY(-1px);}
.aa-mb.s{background:var(--mg-s2);border:1px solid var(--mg-b1);color:var(--mg-t2);}
.aa-mb.s:hover{border-color:var(--mg-b2);background:var(--mg-s3);}
.aa-mb.d{background:var(--mg-red-lt);border:1px solid rgba(220,38,38,.2);color:var(--mg-red);}
.aa-res-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:14px;}
.aa-res-cell{background:var(--mg-s1);border:1px solid var(--mg-b1);border-radius:10px;padding:10px 5px;text-align:center;}
.aa-res-val{font-size:22px;font-weight:800;font-family:var(--mg-mono);}
.aa-res-lbl{font-size:8px;color:var(--mg-t3);text-transform:uppercase;letter-spacing:1px;margin-top:2px;font-weight:700;}
.aa-rtable{width:100%;border-collapse:collapse;font-size:10.5px;}
.aa-rtable thead th{text-align:left;color:var(--mg-t3);font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:5px 8px;border-bottom:1px solid var(--mg-b1);}
.aa-rtable tbody td{padding:6px 8px;border-bottom:1px solid var(--mg-b1);}
.aa-rtable tbody tr.ok td{background:rgba(22,163,74,.04);}
.aa-rtable tbody tr.fail td{background:rgba(220,38,38,.04);}
.tag-ok{color:var(--mg-green);font-weight:700;font-size:9.5px;background:var(--mg-green-lt);padding:2px 7px;border-radius:4px;}
.tag-fail{color:var(--mg-red);font-weight:700;font-size:9.5px;background:var(--mg-red-lt);padding:2px 7px;border-radius:4px;}

/* ═══ MODAL FINAL + STARS ═══ */
.aa-final-modal{
  background:var(--mg-panel);border:1px solid var(--mg-b1);
  border-radius:18px;padding:0;max-width:460px;width:95%;
  box-shadow:0 24px 80px rgba(0,0,0,0.22);
  animation:modal-pop .3s cubic-bezier(.34,1.56,.64,1);
  overflow:hidden;
}
.aa-final-header{
  background:linear-gradient(135deg,var(--mg-blue) 0%,#0055c8 100%);
  padding:20px 22px 18px;text-align:center;position:relative;
}
.aa-final-header::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:var(--mg-grad);}
.aa-final-emoji{font-size:36px;margin-bottom:6px;display:block;}
.aa-final-title{font-size:16px;font-weight:800;color:#fff;margin-bottom:3px;}
.aa-final-subtitle{font-size:11px;color:rgba(255,255,255,0.72);font-weight:500;}
.aa-final-name{font-weight:800;color:#fff;}
.aa-final-body{padding:18px 20px;}
.aa-rating-section{text-align:center;padding:12px 0 2px;border-top:1px solid var(--mg-b1);margin-top:8px;}
.aa-rating-label{font-size:10px;color:var(--mg-t2);margin-bottom:8px;font-weight:500;}
.aa-rating{display:inline-flex;flex-direction:row-reverse;gap:3px;}
.aa-rating input{display:none;}
.aa-rating label{
  font-size:28px;cursor:pointer;color:#9aa0b8;
  transition:color .12s ease,transform .18s cubic-bezier(.34,1.56,.64,1);
  display:inline-block;line-height:1;
}
.aa-rating label::before{content:"★";}
.aa-rating label:hover,
.aa-rating label:hover ~ label{color:#fbbf24;transform:scale(1.22);}
.aa-rating input:checked ~ label{color:#f59e0b;}
.aa-rating input:checked + label{animation:star-pop .28s cubic-bezier(.34,1.56,.64,1);}

.aa-rating-thanks{font-size:10px;color:var(--mg-blue);margin-top:7px;min-height:16px;font-weight:600;}
.aa-final-btns{display:flex;gap:7px;margin-top:14px;}

/* APPEAR */

#__sol__:not(.off){animation:panel-appear .35s cubic-bezier(.34,1.56,.64,1);}

/* ═══════════════════════════════════════════════════════════ */
/* MODULE: AUTO EXPEDIÇÃO (__aa__)                             */
/* ═══════════════════════════════════════════════════════════ */
#__aa__ *,#__aa__ *::before,#__aa__ *::after{box-sizing:border-box;}
#__aa__ ::-webkit-scrollbar{width:4px;}
#__aa__ ::-webkit-scrollbar-track{background:transparent;}
#__aa__ ::-webkit-scrollbar-thumb{background:var(--mg-s3);border-radius:10px;}

/* ═══ PANEL ═══ */
#__aa__{
  position:fixed;top:20px;right:20px;
  width:380px;height:auto;
  max-height:calc(100vh - 40px);
  background:var(--mg-panel);
  border:1px solid var(--mg-b1);border-radius:16px;
  font-family:var(--mg-font);color:var(--mg-t1);
  z-index:2147483646;
  display:flex;flex-direction:column;
  box-shadow:var(--mg-shadow-lg);
  overflow:hidden;
  will-change:max-height;
  transition:max-height .34s cubic-bezier(.4,0,.2,1),
             opacity .28s ease,
             transform .28s cubic-bezier(.4,0,.2,1);
}
#__aa__.off{opacity:0;pointer-events:none;transform:scale(0.96) translateY(8px);}
#__aa__::before{
  content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:var(--mg-grad);z-index:5;
  border-radius:16px 16px 0 0;
  overflow:hidden;
}
#__aa__.minimized{max-height:64px !important;border-radius:26px !important;}
#__aa__.minimized .sol-body,
#__aa__.minimized .sol-log-section,
#__aa__.minimized .sol-tok-bar,
#__aa__.minimized .sol-welcome-inline{opacity:0;pointer-events:none;}
#__aa__.minimized .sol-header{border-bottom:none !important;border-radius:26px !important;}
#__aa__ .sol-body,
#__aa__ .sol-log-section,
#__aa__ .sol-tok-bar,
#__aa__ .sol-welcome-inline{transition:opacity .18s ease;will-change:opacity;}

/* FAB */
#__aa_tab__{
  position:fixed;bottom:24px;right:24px;width:48px;height:48px;
  background:var(--mg-blue);border:none;border-radius:50%;
  cursor:pointer;z-index:2147483645;display:none;
  align-items:center;justify-content:center;
  box-shadow:0 4px 20px rgba(0,120,230,0.38);
  transition:transform .22s cubic-bezier(.4,0,.2,1),box-shadow .22s;color:#fff;font-size:18px;
}
#__aa_tab__:hover{transform:scale(1.1);box-shadow:0 6px 28px rgba(0,120,230,0.52);}

#__aa_tab__.popping{animation:tab-pop 1.1s cubic-bezier(.34,1.56,.64,1) forwards;}

/* ═══ SPINNER DOMINO ═══ */
.sol-spinner-wrap{width:32px;height:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.sol-spinner{position:relative;width:60px;height:60px;display:flex;justify-content:center;align-items:center;border-radius:50%;transform:translateX(-38px) scale(0.55);}
.sol-spinner span{position:absolute;top:50%;left:var(--sol-left);width:35px;height:7px;background:var(--mg-blue);animation:sol-dominos 1s ease infinite;box-shadow:2px 2px 3px 0px rgba(0,0,0,0.3);}
.sol-spinner span:nth-child(1){--sol-left:80px;animation-delay:0.125s;}
.sol-spinner span:nth-child(2){--sol-left:70px;animation-delay:0.3s;}
.sol-spinner span:nth-child(3){left:60px;animation-delay:0.425s;}
.sol-spinner span:nth-child(4){animation-delay:0.54s;left:50px;}
.sol-spinner span:nth-child(5){animation-delay:0.665s;left:40px;}
.sol-spinner span:nth-child(6){animation-delay:0.79s;left:30px;}
.sol-spinner span:nth-child(7){animation-delay:0.915s;left:20px;}
.sol-spinner span:nth-child(8){left:10px;}
@keyframes sol-dominos{50%{opacity:0.7;}75%{transform:rotate(90deg);}80%{opacity:1;}}

/* ═══ HEADER ═══ */
.sol-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 16px;border-bottom:1px solid var(--mg-b1);
  flex-shrink:0;cursor:grab;user-select:none;
  border-radius:16px 16px 0 0;position:relative;
  background:radial-gradient(ellipse at 0% 0%,rgba(0,120,230,0.07) 0%,transparent 60%),
    radial-gradient(ellipse at 100% 100%,rgba(0,200,150,0.05) 0%,transparent 55%),var(--mg-panel);
}
.sol-header:active{cursor:grabbing;}
.sol-header-left{display:flex;align-items:center;gap:10px;flex:1;min-width:0;}
.sol-header-info{display:flex;flex-direction:column;justify-content:center;gap:3px;min-width:0;}
.sol-header-title-row{display:flex;align-items:center;gap:6px;}
.sol-header-title{font-size:15px;font-weight:700;letter-spacing:-0.2px;color:var(--mg-t1);line-height:1.2;white-space:nowrap;}
.sol-header-sub{font-size:10px;color:var(--mg-t3);font-weight:500;line-height:1;}
.sol-header-btns{display:flex;gap:3px;margin-left:8px;flex-shrink:0;}
.sol-hbtn{background:none;border:none;color:var(--mg-t3);cursor:pointer;width:30px;height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .18s;font-weight:600;}
.sol-hbtn:hover{background:var(--mg-s2);color:var(--mg-t1);}
.sol-hbtn.close-btn:hover{background:var(--mg-red-lt);color:var(--mg-red);}
#sol-min{position:relative;}
#sol-min::before,#sol-min::after{content:'';position:absolute;left:50%;top:50%;border-radius:2px;transition:all .18s ease;}
#sol-min[data-state='open']::before{width:10px;height:2px;background:currentColor;transform:translate(-50%,-50%);}
#sol-min[data-state='open']::after{display:none;}
#sol-min[data-state='closed']::before{width:9px;height:9px;background:transparent;border:1.8px solid currentColor;border-radius:2px;transform:translate(-50%,-50%);}
#sol-min[data-state='closed']::after{display:none;}

/* ═══ MAGALU LOGO BAR ═══ */
.sol-magalu-logo{display:flex;flex-direction:column;align-items:flex-start;flex-shrink:0;line-height:1;gap:0;}
.sol-magalu-logo svg{display:block;}
.sol-logo-bar{height:3px;border-radius:2px;background:var(--mg-grad);}

/* ═══ WELCOME INLINE ═══ */
.sol-welcome-inline{padding:9px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--mg-b1);flex-shrink:0;background:var(--mg-s1);}
.sol-welcome-av{width:32px;height:32px;border-radius:50%;background:var(--mg-blue);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0;}
.sol-welcome-txt{font-size:13px;color:var(--mg-t2);font-weight:500;}
.sol-welcome-name{font-weight:700;font-size:13px;color:var(--mg-blue);}
.sol-welcome-sub{font-size:10px;color:var(--mg-t3);margin-top:1px;}

/* ═══ WELCOME TOAST ═══ */


.sol-welcome-toast{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.82) translateY(24px);background:var(--mg-panel);border:1px solid var(--mg-b1);border-radius:20px;padding:28px 44px;text-align:center;z-index:2147483647;opacity:0;pointer-events:none;box-shadow:var(--mg-shadow-lg);overflow:hidden;}
.sol-welcome-toast::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--mg-grad);}
.sol-welcome-toast.show{animation:toast-enter .55s cubic-bezier(.34,1.56,.64,1) forwards;}
.sol-welcome-toast.hide{animation:toast-exit .4s ease-in forwards;}
.sol-toast-greeting{font-size:13px;color:var(--mg-t2);margin-bottom:4px;font-weight:500;}
.sol-toast-name{font-size:26px;font-weight:800;color:var(--mg-blue);letter-spacing:-0.5px;}
.sol-toast-brand{font-size:10px;color:var(--mg-t3);margin-top:8px;letter-spacing:1px;font-weight:600;}
.sol-toast-logo{margin:10px auto 0;display:flex;flex-direction:column;align-items:center;gap:3px;}

/* ═══ TOKEN BAR ═══ */
.sol-tok-bar{display:flex;align-items:center;gap:8px;padding:7px 16px;font-size:11.5px;border-bottom:1px solid var(--mg-b1);flex-shrink:0;background:var(--mg-s1);font-weight:600;transition:color .3s;}
.sol-tok-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;transition:background .3s,box-shadow .3s;}
.sol-tok-label{flex-shrink:0;white-space:nowrap;font-size:11px;}
.sol-tok-track{flex:1;height:4px;background:var(--mg-s3);border-radius:4px;overflow:hidden;min-width:30px;}
.sol-tok-fill{height:100%;border-radius:4px;width:100%;transition:width 1s linear,background-color .4s;}
.sol-tok-bar.ok .sol-tok-dot{background:var(--mg-green);box-shadow:0 0 0 3px rgba(22,163,74,0.22);}
.sol-tok-bar.ok .sol-tok-fill{background:var(--mg-green);}
.sol-tok-bar.ok{color:var(--mg-t2);}
.sol-tok-bar.w .sol-tok-dot{background:var(--mg-orange);animation:tok-blink 1.2s infinite;}
.sol-tok-bar.w .sol-tok-fill{background:var(--mg-orange);}
.sol-tok-bar.w{color:var(--mg-orange);}
.sol-tok-bar.ex .sol-tok-dot{background:var(--mg-red);animation:tok-blink .7s infinite;}
.sol-tok-bar.ex .sol-tok-fill{background:var(--mg-red);}
.sol-tok-bar.ex{color:var(--mg-red);}


/* ═══ BODY ═══ */
.sol-body{flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:9px;background:var(--mg-bg);}

/* ═══ CARDS ═══ */
.sol-card{background:var(--mg-panel);border:1px solid var(--mg-b1);border-radius:11px;padding:11px 13px;transition:border-color .2s,box-shadow .2s;box-shadow:0 1px 3px rgba(0,0,0,0.08);}
.sol-card:hover{border-color:var(--mg-b2);box-shadow:0 2px 10px rgba(0,0,0,0.12);}
.sol-card-label{font-size:10.5px;font-weight:700;color:var(--mg-t3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;}

/* ═══ MODO SELECTOR (pills) ═══ */
.sol-modo-selector{position:relative;display:flex;flex-wrap:wrap;border-radius:7px;background:var(--mg-s2);box-shadow:0 0 0 1px rgba(0,0,0,0.08);padding:3px;margin-bottom:10px;}
.sol-modo-radio{flex:1 1 auto;text-align:center;}
.sol-modo-radio input{display:none;}
.sol-modo-radio .sol-modo-name{display:flex;cursor:pointer;align-items:center;justify-content:center;border-radius:5px;border:none;padding:7px 0;font-size:11.5px;font-weight:500;color:var(--mg-t2);font-family:var(--mg-font);transition:all .15s ease-in-out;}
.sol-modo-radio input:checked + .sol-modo-name{background:rgba(255,255,255,0.7);font-weight:700;color:var(--mg-blue);box-shadow:0 1px 6px rgba(0,0,0,0.12);position:relative;animation:modo-select .3s ease;}
.sol-modo-radio:hover .sol-modo-name{background:rgba(255,255,255,0.35);}
@keyframes modo-select{0%{transform:scale(0.95);}50%{transform:scale(1.05);}100%{transform:scale(1);}}
.sol-modo-radio input:checked + .sol-modo-name::before,.sol-modo-radio input:checked + .sol-modo-name::after{content:"";position:absolute;width:4px;height:4px;border-radius:50%;background:var(--mg-blue);opacity:0;animation:modo-particles .5s ease forwards;}
.sol-modo-radio input:checked + .sol-modo-name::before{top:-8px;left:50%;transform:translateX(-50%);--direction:-10px;}
.sol-modo-radio input:checked + .sol-modo-name::after{bottom:-8px;left:50%;transform:translateX(-50%);--direction:10px;}
@keyframes modo-particles{0%{opacity:0;transform:translateX(-50%) translateY(0);}50%{opacity:1;}100%{opacity:0;transform:translateX(-50%) translateY(var(--direction));}}

/* ═══ MODO DESC ═══ */
.sol-modo-desc{background:rgba(0,120,230,0.08);border:1px solid rgba(0,120,230,0.14);border-radius:8px;padding:9px 12px;margin-bottom:8px;font-size:11.5px;color:var(--mg-t2);line-height:1.6;}
.sol-modo-desc strong{color:var(--mg-blue);font-weight:700;}
.sol-gemco-example{display:inline-block;margin-top:4px;font-family:var(--mg-mono);font-size:11px;background:var(--mg-panel);border:1px solid rgba(0,120,230,0.2);border-radius:5px;padding:3px 9px;color:var(--mg-t1);}

/* ═══ TEXTAREA ═══ */
.sol-ta{width:100%;background:var(--mg-s1);border:1.5px solid var(--mg-b1);border-radius:9px;color:var(--mg-t1);font-size:12.5px;font-family:var(--mg-mono);padding:9px 11px;box-sizing:border-box;resize:vertical;outline:none;line-height:1.7;transition:border-color .2s,box-shadow .2s,background .2s;min-height:70px;}
.sol-ta:focus{border-color:var(--mg-blue);box-shadow:0 0 0 3px rgba(0,120,230,0.12);background:var(--mg-panel);}
.sol-ta::placeholder{color:var(--mg-t3);}

/* ═══ BOTÃO INICIAR ═══ */
.sol-btn-run-wrap{position:relative;display:flex;justify-content:center;align-items:center;border:none;background:transparent;cursor:pointer;width:100%;padding:0;overflow:hidden;border-radius:999px;isolation:isolate;}
.sol-btn-run-inner{position:relative;z-index:1;letter-spacing:1.5px;font-weight:700;font-size:13px;background:var(--mg-blue);border-radius:999px;color:white;padding:11px 20px;font-family:var(--mg-font);width:100%;text-align:center;display:flex;align-items:center;justify-content:center;gap:0;transition:background .22s,transform .15s,box-shadow .22s;box-shadow:0 2px 12px rgba(0,120,230,0.30);}
.sol-btn-run-wrap:hover .sol-btn-run-inner{background:var(--mg-blue2);box-shadow:0 4px 18px rgba(0,120,230,0.42);transform:translateY(-1px);}
.sol-btn-run-wrap:active .sol-btn-run-inner{transform:translateY(0);box-shadow:0 1px 6px rgba(0,120,230,0.22);}
.sol-btn-run-svg{width:0;overflow:hidden;opacity:0;transition:width .25s ease,opacity .25s ease,margin-left .25s ease;flex-shrink:0;display:inline-flex;vertical-align:middle;}
.sol-btn-run-wrap:hover .sol-btn-run-svg{width:20px;opacity:1;margin-left:8px;}

/* ═══ BOTÃO PARAR ═══ */
.sol-stop-section{padding:0 0 8px;flex-shrink:0;display:none;}
.sol-stop-section.active{display:block;}
.sol-btn-stop-wrap{position:relative;border-radius:6px;width:100%;height:40px;cursor:pointer;display:flex;align-items:center;border:1px solid #cc0000;background-color:#e50000;overflow:hidden;transition:all .3s;box-sizing:border-box;flex-shrink:0;}
.sol-btn-stop-wrap .sol-stop-text{transform:translateX(30px);color:#fff;font-weight:600;font-size:11px;font-family:var(--mg-font);letter-spacing:1.5px;transition:all .3s;white-space:nowrap;flex:1;text-align:center;padding-right:40px;}
.sol-btn-stop-wrap .sol-stop-icon{position:absolute;right:0;top:0;height:100%;width:36px;background-color:#cc0000;display:flex;align-items:center;justify-content:center;transition:all .3s;}
.sol-btn-stop-wrap .sol-stop-icon .sol-stop-svg{width:18px;height:18px;}
.sol-btn-stop-wrap:hover{background:#cc0000;}
.sol-btn-stop-wrap:hover .sol-stop-text{color:transparent;}
.sol-btn-stop-wrap:hover .sol-stop-icon{width:100%;transform:translateX(0);}
.sol-btn-stop-wrap:active .sol-stop-icon{background-color:#b20000;}
.sol-btn-stop-wrap:active{border-color:#b20000;}

/* ═══ TYPEWRITER ═══ */
.sol-typewriter-wrap{display:none;flex-direction:column;align-items:center;gap:8px;padding:10px 0;}
.sol-typewriter-wrap.active{display:flex;}
.sol-typewriter{--blue:#5C86FF;--blue-dark:#275EFE;--key:#fff;--paper:#EEF0FD;--text:#D3D4EC;--tool:#FBC56C;--duration:3s;position:relative;animation:bounce05 var(--duration) linear infinite;transform-origin:center bottom;}
.sol-typewriter .tw-slide{width:92px;height:20px;border-radius:3px;margin-left:14px;transform:translateX(14px);background:linear-gradient(var(--blue),var(--blue-dark));animation:slide05 var(--duration) ease infinite;}
.sol-typewriter .tw-slide::before,.sol-typewriter .tw-slide::after,.sol-typewriter .tw-slide i::before{content:"";position:absolute;background:var(--tool);}
.sol-typewriter .tw-slide::before{width:2px;height:8px;top:6px;left:100%;}
.sol-typewriter .tw-slide::after{left:94px;top:3px;height:14px;width:6px;border-radius:3px;}
.sol-typewriter .tw-slide i{display:block;position:absolute;right:100%;width:6px;height:4px;top:4px;background:var(--tool);}
.sol-typewriter .tw-slide i::before{right:100%;top:-2px;width:4px;border-radius:2px;height:14px;}
.sol-typewriter .tw-paper{position:absolute;left:24px;top:-26px;width:40px;height:46px;border-radius:5px;background:var(--paper);transform:translateY(46px);animation:paper05 var(--duration) linear infinite;}
.sol-typewriter .tw-paper::before{content:"";position:absolute;left:6px;right:6px;top:7px;border-radius:2px;height:4px;transform:scaleY(0.8);background:var(--text);box-shadow:0 12px 0 var(--text),0 24px 0 var(--text),0 36px 0 var(--text);}
.sol-typewriter .tw-keyboard{width:120px;height:56px;margin-top:-10px;z-index:1;position:relative;}
.sol-typewriter .tw-keyboard::before,.sol-typewriter .tw-keyboard::after{content:"";position:absolute;}
.sol-typewriter .tw-keyboard::before{top:0;left:0;right:0;bottom:0;border-radius:7px;background:linear-gradient(135deg,var(--blue),var(--blue-dark));transform:perspective(10px) rotateX(2deg);transform-origin:50% 100%;}
.sol-typewriter .tw-keyboard::after{left:2px;top:25px;width:11px;height:4px;border-radius:2px;box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);animation:keyboard05 var(--duration) linear infinite;}
.sol-tw-spinner{display:flex;align-items:center;justify-content:center;gap:0;font-size:11px;font-weight:600;color:var(--mg-t2);font-family:var(--mg-font);height:20px;overflow:hidden;width:100%;}
.sol-tw-spinner-track{position:relative;overflow:hidden;height:20px;-webkit-mask-image:linear-gradient(transparent 0%,#000 20%,#000 80%,transparent 100%);mask-image:linear-gradient(transparent 0%,#000 20%,#000 80%,transparent 100%);}
.sol-tw-word{display:block;height:20px;line-height:20px;padding-left:5px;color:var(--mg-blue);font-weight:700;animation:tw-spin 4s infinite;}






/* ═══ STATUS / PROGRESS ═══ */
.sol-divider{height:1px;background:var(--mg-b1);margin:1px 0;}
.sol-status{font-size:11.5px;color:var(--mg-t3);text-align:center;padding:5px 0;min-height:24px;transition:color .3s;font-weight:500;}
.sol-status.on{color:var(--mg-blue);}
.sol-progress-wrap{height:3px;background:var(--mg-s2);border-radius:4px;overflow:hidden;display:none;}
.sol-progress-wrap.on{display:block;}
.sol-progress-bar{height:100%;background:var(--mg-blue);border-radius:4px;transition:width .4s cubic-bezier(.4,0,.2,1);width:0%;}

/* ═══ BOTÃO E-MAILS ═══ */
.sol-btn-email{width:100%;padding:9px;border-radius:9px;border:1.5px solid var(--mg-b1);background:var(--mg-s1);color:var(--mg-t2);font-family:var(--mg-font);font-size:12px;font-weight:600;cursor:pointer;transition:all .18s;}
.sol-btn-email:hover{border-color:var(--mg-b2);color:var(--mg-t1);background:var(--mg-s2);}

/* ═══ LOG ═══ */
.sol-log-section{border-top:1px solid var(--mg-b1);flex-shrink:0;background:var(--mg-panel);}
.sol-log-header{display:flex;align-items:center;justify-content:space-between;padding:8px 14px 7px;cursor:pointer;user-select:none;}
.sol-log-title{font-size:10px;font-weight:700;color:var(--mg-t3);text-transform:uppercase;letter-spacing:1.5px;display:flex;align-items:center;gap:7px;}
.sol-log-count{background:var(--mg-s2);color:var(--mg-blue);font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;border:1px solid rgba(0,120,230,0.12);}
.sol-log-clear{background:none;border:none;color:var(--mg-t3);font-size:10.5px;cursor:pointer;padding:2px 8px;border-radius:5px;font-family:var(--mg-font);font-weight:600;transition:all .18s;}
.sol-log-clear:hover{color:var(--mg-red);background:var(--mg-red-lt);}
.sol-log-body{max-height:120px;overflow-y:auto;padding:3px 12px 10px;}
.sol-log-entry{font-size:11px;font-family:var(--mg-mono);padding:2px 0 2px 8px;border-left:2px solid;margin-bottom:2px;line-height:1.5;animation:log-in .2s ease;}

.sol-log-entry.info{border-color:rgba(0,120,230,.35);color:#2a6fb8;}
.sol-log-entry.ok{border-color:rgba(22,163,74,.35);color:var(--mg-green);}
.sol-log-entry.warn{border-color:rgba(217,119,6,.35);color:var(--mg-orange);}
.sol-log-entry.err{border-color:rgba(220,38,38,.35);color:var(--mg-red);}

/* ═══ MODAL ═══ */
.aa-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);z-index:2147483647;display:flex;align-items:center;justify-content:center;animation:ov-in .2s ease;}

.aa-modal{background:var(--mg-panel);border:1px solid var(--mg-b1);border-radius:18px;padding:24px 22px 20px;max-width:400px;width:92%;box-shadow:var(--mg-shadow-lg);animation:modal-pop .25s cubic-bezier(.34,1.56,.64,1);overflow:hidden;position:relative;}
.aa-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--mg-grad);}

.aa-res-modal{max-width:460px;width:95%;}
.aa-m-ico{font-size:34px;text-align:center;margin-bottom:8px;}
.aa-m-ttl{font-size:15px;font-weight:800;text-align:center;margin-bottom:7px;letter-spacing:-0.3px;}
.aa-m-msg{font-size:11.5px;color:var(--mg-t2);text-align:center;line-height:1.7;margin-bottom:16px;white-space:pre-line;}
.aa-m-det{background:var(--mg-s1);border:1px solid var(--mg-b1);border-radius:7px;padding:8px 10px;font-size:10.5px;font-family:var(--mg-mono);color:var(--mg-t3);margin-bottom:14px;max-height:80px;overflow-y:auto;white-space:pre-wrap;}
.aa-m-inp{width:100%;padding:10px 11px;background:var(--mg-s1);border:1.5px solid var(--mg-b1);border-radius:8px;color:var(--mg-t1);font-size:13px;font-family:var(--mg-mono);margin-bottom:13px;box-sizing:border-box;outline:none;transition:border-color .2s;}
.aa-m-inp:focus{border-color:var(--mg-blue);box-shadow:0 0 0 3px rgba(0,120,230,0.12);}
.aa-m-btns{display:flex;gap:7px;margin-top:4px;}
.aa-mb{flex:1;padding:11px;border-radius:9px;border:none;font-family:var(--mg-font);font-weight:700;font-size:11px;cursor:pointer;transition:all .18s;}
.aa-mb.p{background:var(--mg-blue);color:#fff;box-shadow:0 2px 10px rgba(0,120,230,0.22);}
.aa-mb.p:hover{background:var(--mg-blue2);transform:translateY(-1px);}
.aa-mb.s{background:var(--mg-s2);border:1px solid var(--mg-b1);color:var(--mg-t2);}
.aa-mb.s:hover{border-color:var(--mg-b2);background:var(--mg-s3);}
.aa-mb.d{background:var(--mg-red-lt);border:1px solid rgba(220,38,38,.2);color:var(--mg-red);}
.aa-res-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:14px;}
.aa-res-cell{background:var(--mg-s1);border:1px solid var(--mg-b1);border-radius:10px;padding:10px 5px;text-align:center;}
.aa-res-val{font-size:22px;font-weight:800;font-family:var(--mg-mono);}
.aa-res-lbl{font-size:8px;color:var(--mg-t3);text-transform:uppercase;letter-spacing:1px;margin-top:2px;font-weight:700;}
.aa-rtable{width:100%;border-collapse:collapse;font-size:10.5px;}
.aa-rtable thead th{text-align:left;color:var(--mg-t3);font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:5px 8px;border-bottom:1px solid var(--mg-b1);}
.aa-rtable tbody td{padding:6px 8px;border-bottom:1px solid var(--mg-b1);}
.aa-rtable tbody tr.ok td{background:rgba(22,163,74,.04);}
.aa-rtable tbody tr.fail td{background:rgba(220,38,38,.04);}
.tag-ok{color:var(--mg-green);font-weight:700;font-size:9.5px;background:var(--mg-green-lt);padding:2px 7px;border-radius:4px;}
.tag-fail{color:var(--mg-red);font-weight:700;font-size:9.5px;background:var(--mg-red-lt);padding:2px 7px;border-radius:4px;}
.aa-res-tip{font-size:11px;color:var(--mg-t2);text-align:center;margin-bottom:12px;line-height:1.5;}
.aa-list-item{padding:10px 12px;border-radius:8px;border:1px solid var(--mg-b1);background:var(--mg-s1);color:var(--mg-t1);cursor:pointer;text-align:left;font-family:var(--mg-font);font-size:12.5px;transition:all .15s;width:100%;box-sizing:border-box;margin-bottom:5px;}
.aa-list-item:hover{border-color:var(--mg-b2);background:var(--mg-s2);}
.aa-list-item strong{color:var(--mg-blue);}
.aa-list-item span{color:var(--mg-t3);font-size:11px;}
.aa-list-item small{display:block;color:var(--mg-t3);font-size:10.5px;font-family:var(--mg-mono);margin-top:2px;}

/* ═══ MODAL FINAL + STARS ═══ */
.aa-final-modal{background:var(--mg-panel);border:1px solid var(--mg-b1);border-radius:18px;padding:0;max-width:460px;width:95%;box-shadow:0 24px 80px rgba(0,0,0,0.22);animation:modal-pop .3s cubic-bezier(.34,1.56,.64,1);overflow:hidden;}
.aa-final-header{background:linear-gradient(135deg,var(--mg-blue) 0%,#0055c8 100%);padding:20px 22px 18px;text-align:center;position:relative;}
.aa-final-header::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:var(--mg-grad);}
.aa-final-emoji{font-size:36px;margin-bottom:6px;display:block;}
.aa-final-title{font-size:16px;font-weight:800;color:#fff;margin-bottom:3px;}
.aa-final-subtitle{font-size:11px;color:rgba(255,255,255,0.72);font-weight:500;}
.aa-final-body{padding:18px 20px;}
.aa-final-sec{background:var(--mg-s1);border:1px solid var(--mg-b1);border-radius:8px;padding:10px 12px;margin-bottom:8px;font-size:12px;}
.aa-final-row{display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(0,0,0,0.06);}
.aa-final-row:last-child{border-bottom:none;}
.aa-final-k{color:var(--mg-t3);}
.aa-final-v{font-weight:600;color:var(--mg-t1);}
.aa-rating-section{text-align:center;padding:12px 0 2px;border-top:1px solid var(--mg-b1);margin-top:8px;}
.aa-rating-label{font-size:10px;color:var(--mg-t2);margin-bottom:8px;font-weight:500;}
.aa-rating{display:inline-flex;flex-direction:row-reverse;gap:3px;}
.aa-rating input{display:none;}
.aa-rating label{font-size:28px;cursor:pointer;color:#9aa0b8;transition:color .12s ease,transform .18s cubic-bezier(.34,1.56,.64,1);display:inline-block;line-height:1;}
.aa-rating label::before{content:"★";}
.aa-rating label:hover,.aa-rating label:hover ~ label{color:#fbbf24;transform:scale(1.22);}
.aa-rating input:checked ~ label{color:#f59e0b;}
.aa-rating input:checked + label{animation:star-pop .28s cubic-bezier(.34,1.56,.64,1);}

.aa-rating-thanks{font-size:10px;color:var(--mg-blue);margin-top:7px;min-height:16px;font-weight:600;}
.aa-final-btns{display:flex;gap:7px;margin-top:14px;}

/* APPEAR */

#__aa__:not(.off){animation:panel-appear .35s cubic-bezier(.34,1.56,.64,1);}

/* ═══════════════════════════════════════════════════════════ */
/* MODULE: CONFIRMA ABA (__caba__)                             */
/* ═══════════════════════════════════════════════════════════ */
#__caba__ *,#__caba__ *::before,#__caba__ *::after{box-sizing:border-box;}#__caba__ ::-webkit-scrollbar{width:5px;}#__caba__ ::-webkit-scrollbar-track{background:transparent;}#__caba__ ::-webkit-scrollbar-thumb{background:var(--mg-s3);border-radius:10px;}
#__caba__{position:fixed;top:16px;right:16px;width:540px;max-height:calc(100vh - 32px);background:var(--mg-panel);border:1px solid var(--mg-b1);border-radius:16px;font-family:var(--mg-font);color:var(--mg-t1);z-index:2147483646;display:flex;flex-direction:column;box-shadow:var(--mg-shadow-lg);overflow:hidden;transition:max-height .34s,opacity .28s,transform .28s;}
#__caba__.off{opacity:0;pointer-events:none;transform:scale(0.96) translateY(8px);}#__caba__::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--mg-grad);z-index:5;border-radius:16px 16px 0 0;overflow:hidden;}
#__caba__.minimized{max-height:64px!important;border-radius:26px!important;}#__caba__.minimized .caba-body,#__caba__.minimized .caba-log-section,#__caba__.minimized .sol-tok-bar,#__caba__.minimized .sol-welcome-inline{opacity:0;pointer-events:none;}#__caba__.minimized .sol-header{border-bottom:none!important;border-radius:26px!important;}
#__caba__ .caba-body,#__caba__ .caba-log-section,#__caba__ .sol-tok-bar,#__caba__ .sol-welcome-inline{transition:opacity .18s ease;}
#__caba_tab__{position:fixed;bottom:24px;right:24px;width:48px;height:48px;background:var(--mg-blue);border:none;border-radius:50%;cursor:pointer;z-index:2147483645;display:none;align-items:center;justify-content:center;box-shadow:0 4px 20px rgba(0,120,230,0.38);transition:transform .22s,box-shadow .22s;color:#fff;font-size:18px;}#__caba_tab__:hover{transform:scale(1.1);}#__caba_tab__.popping{animation:tab-pop 1.1s cubic-bezier(.34,1.56,.64,1) forwards;}
.sol-spinner-wrap{width:32px;height:32px;flex-shrink:0;display:flex;align-items:center;justify-content:center;overflow:hidden;}.sol-spinner{position:relative;width:60px;height:60px;display:flex;justify-content:center;align-items:center;border-radius:50%;transform:translateX(-38px) scale(0.55);}.sol-spinner span{position:absolute;top:50%;left:var(--sol-left);width:35px;height:7px;background:var(--mg-blue);animation:sol-dominos 1s ease infinite;box-shadow:2px 2px 3px 0px rgba(0,0,0,0.3);}.sol-spinner span:nth-child(1){--sol-left:80px;animation-delay:0.125s;}.sol-spinner span:nth-child(2){--sol-left:70px;animation-delay:0.3s;}.sol-spinner span:nth-child(3){left:60px;animation-delay:0.425s;}.sol-spinner span:nth-child(4){animation-delay:0.54s;left:50px;}.sol-spinner span:nth-child(5){animation-delay:0.665s;left:40px;}.sol-spinner span:nth-child(6){animation-delay:0.79s;left:30px;}.sol-spinner span:nth-child(7){animation-delay:0.915s;left:20px;}.sol-spinner span:nth-child(8){left:10px;}@keyframes sol-dominos{50%{opacity:0.7;}75%{transform:rotate(90deg);}80%{opacity:1;}}
.sol-header{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--mg-b1);flex-shrink:0;cursor:grab;user-select:none;border-radius:16px 16px 0 0;position:relative;background:radial-gradient(ellipse at 0% 0%,rgba(0,120,230,0.07) 0%,transparent 60%),radial-gradient(ellipse at 100% 100%,rgba(0,200,150,0.05) 0%,transparent 55%),var(--mg-panel);}.sol-header:active{cursor:grabbing;}.sol-header-left{display:flex;align-items:center;gap:10px;flex:1;}.sol-header-info{display:flex;flex-direction:column;gap:3px;}.sol-header-title{font-size:15px;font-weight:700;letter-spacing:-0.2px;}.sol-header-sub{font-size:10px;color:var(--mg-t3);font-weight:500;}.sol-header-btns{display:flex;gap:3px;margin-left:8px;flex-shrink:0;}.sol-hbtn{background:none;border:none;color:var(--mg-t3);cursor:pointer;width:30px;height:30px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .18s;font-weight:600;}.sol-hbtn:hover{background:var(--mg-s2);color:var(--mg-t1);}.sol-hbtn.close-btn:hover{background:var(--mg-red-lt);color:var(--mg-red);}#caba-min{position:relative;}#caba-min::before,#caba-min::after{content:'';position:absolute;left:50%;top:50%;border-radius:2px;transition:all .18s ease;}#caba-min[data-state='open']::before{width:10px;height:2px;background:currentColor;transform:translate(-50%,-50%);}#caba-min[data-state='open']::after{display:none;}#caba-min[data-state='closed']::before{width:9px;height:9px;background:transparent;border:1.8px solid currentColor;border-radius:2px;transform:translate(-50%,-50%);}#caba-min[data-state='closed']::after{display:none;}
.sol-welcome-inline{padding:9px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--mg-b1);flex-shrink:0;background:var(--mg-s1);}.sol-welcome-av{width:32px;height:32px;border-radius:50%;background:var(--mg-blue);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0;}.sol-welcome-txt{font-size:13px;color:var(--mg-t2);font-weight:500;}.sol-welcome-name{font-weight:700;color:var(--mg-blue);}.sol-welcome-sub{font-size:10px;color:var(--mg-t3);margin-top:1px;}
.caba-welcome-toast{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0.82) translateY(24px);background:var(--mg-panel);border:1px solid var(--mg-b1);border-radius:20px;padding:28px 44px;text-align:center;z-index:2147483647;opacity:0;pointer-events:none;box-shadow:var(--mg-shadow-lg);overflow:hidden;}.caba-welcome-toast::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--mg-grad);}.caba-welcome-toast.show{animation:toast-enter .55s cubic-bezier(.34,1.56,.64,1) forwards;}.caba-welcome-toast.hide{animation:toast-exit .4s ease-in forwards;}
.sol-tok-bar{display:flex;align-items:center;gap:8px;padding:7px 16px;font-size:11.5px;border-bottom:1px solid var(--mg-b1);flex-shrink:0;background:var(--mg-s1);font-weight:600;transition:color .3s;}.sol-tok-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;transition:background .3s,box-shadow .3s;}.sol-tok-label{flex-shrink:0;white-space:nowrap;font-size:11px;}.sol-tok-track{flex:1;height:4px;background:var(--mg-s3);border-radius:4px;overflow:hidden;min-width:30px;}.sol-tok-fill{height:100%;border-radius:4px;width:100%;transition:width 1s linear,background-color .4s;}.sol-tok-bar.ok .sol-tok-dot{background:var(--mg-green);box-shadow:0 0 0 3px rgba(22,163,74,0.22);}.sol-tok-bar.ok .sol-tok-fill{background:var(--mg-green);}.sol-tok-bar.ok{color:var(--mg-t2);}.sol-tok-bar.w .sol-tok-dot{background:var(--mg-orange);animation:tok-blink 1.2s infinite;}.sol-tok-bar.w .sol-tok-fill{background:var(--mg-orange);}.sol-tok-bar.w{color:var(--mg-orange);}.sol-tok-bar.ex .sol-tok-dot{background:var(--mg-red);animation:tok-blink .7s infinite;}.sol-tok-bar.ex .sol-tok-fill{background:var(--mg-red);}.sol-tok-bar.ex{color:var(--mg-red);}
.caba-body{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:var(--mg-bg);}.caba-card{background:var(--mg-panel);border:1px solid var(--mg-b1);border-radius:12px;padding:14px 16px;box-shadow:0 1px 3px rgba(0,0,0,0.08);}.caba-card-label{font-size:12px;font-weight:700;color:var(--mg-t3);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;display:flex;align-items:center;gap:6px;}
.caba-ico{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;flex-shrink:0;}.caba-ico.blue{color:var(--mg-blue);}.caba-ico.green{color:var(--mg-green);}.caba-ico.orange{color:var(--mg-orange);}.caba-ico.muted{color:var(--mg-t3);}
.caba-cd-list{display:flex;flex-direction:column;gap:7px;}.caba-cd-item{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-radius:10px;cursor:pointer;background:var(--mg-s1);border:1px solid var(--mg-b1);transition:all .18s;}.caba-cd-item:hover{border-color:var(--mg-blue);background:rgba(0,120,230,0.06);}.caba-cd-name{font-size:14px;font-weight:700;display:flex;align-items:center;gap:8px;}.caba-cd-badge{font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;}.caba-cd-badge.pending{background:var(--mg-orange);color:#fff;}.caba-cd-badge.ok{background:var(--mg-green);color:#fff;}.caba-cd-badge.none{background:var(--mg-s3);color:#fff;}
.caba-back{font-size:12px;color:var(--mg-blue);cursor:pointer;font-weight:600;display:flex;align-items:center;gap:4px;margin-bottom:6px;}.caba-back:hover{text-decoration:underline;}.caba-empty{text-align:center;padding:24px 10px;color:var(--mg-t3);font-size:13px;font-weight:500;}.caba-empty-icon{margin-bottom:8px;}.caba-loading{text-align:center;padding:20px;color:var(--mg-t3);font-size:12px;font-weight:600;}@keyframes caba-pulse{0%,100%{opacity:0.4}50%{opacity:1}}.caba-loading span{animation:caba-pulse 1.2s infinite;}
.caba-acc{border:1px solid var(--mg-b1);border-radius:10px;overflow:hidden;margin-bottom:6px;background:var(--mg-panel);}.caba-acc-header{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;cursor:pointer;transition:background .15s;user-select:none;}.caba-acc-header:hover{background:rgba(0,120,230,0.04);}.caba-acc-left{display:flex;align-items:center;gap:8px;flex:1;min-width:0;}.caba-acc-id{font-size:14px;font-weight:700;}.caba-acc-date{font-size:10.5px;color:var(--mg-t3);font-weight:500;}.caba-acc-right{display:flex;align-items:center;gap:8px;}.caba-acc-summary{font-size:10px;font-weight:700;padding:3px 10px;border-radius:12px;}.caba-acc-summary.complete{background:var(--mg-green-lt);color:var(--mg-green);}.caba-acc-summary.partial{background:rgba(0,120,230,0.1);color:var(--mg-blue);}.caba-acc-summary.pending{background:rgba(217,119,6,0.12);color:var(--mg-orange);}.caba-acc-chevron{transition:transform .2s;color:var(--mg-t3);}.caba-acc.open .caba-acc-chevron{transform:rotate(180deg);}.caba-acc-body{display:none;padding:0 14px 14px;border-top:1px solid var(--mg-b1);}.caba-acc.open .caba-acc-body{display:block;}
.caba-fil{background:var(--mg-s1);border:1px solid var(--mg-b1);border-radius:9px;padding:11px 13px;margin-top:8px;}.caba-fil-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}.caba-fil-num{font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;}.caba-fil-badge{font-size:10px;font-weight:700;padding:3px 10px;border-radius:10px;display:flex;align-items:center;gap:4px;}.caba-fil-badge.pendente{background:rgba(217,119,6,0.15);color:var(--mg-orange);}.caba-fil-badge.recebido{background:rgba(0,120,230,0.12);color:var(--mg-blue);}.caba-fil-badge.enviado{background:var(--mg-green-lt);color:var(--mg-green);}.caba-fil-user{font-size:10.5px;color:var(--mg-t3);display:flex;align-items:center;gap:4px;margin-top:3px;font-weight:500;}
.caba-asset{font-size:12px;color:var(--mg-t2);line-height:1.7;padding:5px 0;border-bottom:1px solid rgba(0,0,0,0.05);}.caba-asset:last-child{border-bottom:none;}.caba-asset-name{font-weight:600;color:var(--mg-t1);font-size:13px;}.caba-asset-cat{font-size:10px;color:var(--mg-t3);}.caba-asset-meta{font-size:11px;color:var(--mg-t3);font-family:var(--mg-mono);}
.caba-status-bar{padding:10px 14px;border-radius:9px;margin:8px 0;font-size:12px;font-weight:600;display:flex;align-items:center;gap:8px;}.caba-status-bar.green{background:var(--mg-green-lt);border:1px solid rgba(22,163,74,0.2);color:var(--mg-green);}.caba-status-bar.blue{background:rgba(0,120,230,0.08);border:1px solid rgba(0,120,230,0.18);color:var(--mg-blue);}.caba-status-bar.orange{background:rgba(217,119,6,0.08);border:1px solid rgba(217,119,6,0.18);color:var(--mg-orange);}
.caba-btn{padding:10px 16px;border-radius:9px;border:none;font-family:var(--mg-font);font-weight:700;font-size:12px;cursor:pointer;transition:all .18s;width:100%;text-align:center;}.caba-btn.primary{background:var(--mg-blue);color:#fff;box-shadow:0 2px 10px rgba(0,120,230,0.22);}.caba-btn.primary:hover{background:var(--mg-blue2);transform:translateY(-1px);}.caba-btn.success{background:var(--mg-green);color:#fff;}.caba-btn.success:hover{background:#15803d;transform:translateY(-1px);}.caba-btn.ghost{background:var(--mg-s2);color:var(--mg-t2);border:1px solid var(--mg-b1);}.caba-btn.ghost:hover{border-color:var(--mg-b2);}.caba-btn.sm{padding:7px 12px;font-size:10.5px;width:auto;border-radius:7px;}.caba-btn:disabled{opacity:0.5;cursor:not-allowed;transform:none!important;}
.caba-search{display:flex;align-items:center;gap:8px;margin-bottom:10px;background:var(--mg-s1);border:1.5px solid var(--mg-b1);border-radius:9px;padding:0 12px;transition:border-color .2s;}.caba-search:focus-within{border-color:var(--mg-blue);box-shadow:0 0 0 3px rgba(0,120,230,0.12);}.caba-search input{border:none;background:none;outline:none;font-family:var(--mg-font);font-size:12.5px;padding:9px 0;flex:1;color:var(--mg-t1);font-weight:500;}.caba-search input::placeholder{color:var(--mg-t3);}
.caba-log-section{border-top:1px solid var(--mg-b1);flex-shrink:0;background:var(--mg-panel);}.caba-log-header{display:flex;align-items:center;justify-content:space-between;padding:8px 14px 7px;cursor:pointer;user-select:none;}.caba-log-title{font-size:10px;font-weight:700;color:var(--mg-t3);text-transform:uppercase;letter-spacing:1.5px;display:flex;align-items:center;gap:7px;}.caba-log-count{background:var(--mg-s2);color:var(--mg-blue);font-size:10px;font-weight:700;padding:1px 7px;border-radius:10px;}.caba-log-clear{background:none;border:none;color:var(--mg-t3);font-size:10.5px;cursor:pointer;padding:2px 8px;border-radius:5px;font-family:var(--mg-font);font-weight:600;transition:all .18s;}.caba-log-clear:hover{color:var(--mg-red);background:var(--mg-red-lt);}.caba-log-body{max-height:90px;overflow-y:auto;padding:3px 12px 10px;}.caba-log-entry{font-size:11px;font-family:var(--mg-mono);padding:2px 0 2px 8px;border-left:2px solid;margin-bottom:2px;line-height:1.5;animation:log-in .2s ease;}.caba-log-entry.info{border-color:rgba(0,120,230,.35);color:#2a6fb8;}.caba-log-entry.ok{border-color:rgba(22,163,74,.35);color:var(--mg-green);}.caba-log-entry.warn{border-color:rgba(217,119,6,.35);color:var(--mg-orange);}.caba-log-entry.err{border-color:rgba(220,38,38,.35);color:var(--mg-red);}
#__caba__:not(.off){animation:panel-appear .35s cubic-bezier(.34,1.56,.64,1);}
.caba-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);z-index:2147483647;display:flex;align-items:center;justify-content:center;animation:ov-in .2s ease;}
.caba-modal{background:var(--mg-panel);border:1px solid var(--mg-b1);border-radius:18px;padding:24px 22px 20px;max-width:400px;width:92%;box-shadow:var(--mg-shadow-lg);animation:modal-pop .25s cubic-bezier(.34,1.56,.64,1);overflow:hidden;position:relative;}
.caba-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--mg-grad);}

.caba-m-ico{font-size:34px;text-align:center;margin-bottom:8px;}.caba-m-ttl{font-size:15px;font-weight:800;text-align:center;margin-bottom:7px;letter-spacing:-0.3px;}.caba-m-msg{font-size:11.5px;color:var(--mg-t2);text-align:center;line-height:1.7;margin-bottom:16px;white-space:pre-line;}.caba-m-btns{display:flex;gap:7px;margin-top:4px;}
.caba-mb{flex:1;padding:11px;border-radius:9px;border:none;font-family:var(--mg-font);font-weight:700;font-size:11.5px;cursor:pointer;transition:all .18s;}.caba-mb.p{background:var(--mg-blue);color:#fff;box-shadow:0 2px 10px rgba(0,120,230,0.22);}.caba-mb.p:hover{background:var(--mg-blue2);transform:translateY(-1px);}.caba-mb.s{background:var(--mg-s2);border:1px solid var(--mg-b1);color:var(--mg-t2);}.caba-mb.s:hover{border-color:var(--mg-b2);background:var(--mg-s3);}.caba-mb.g{background:var(--mg-green);color:#fff;}.caba-mb.g:hover{background:#15803d;transform:translateY(-1px);}
.caba-final-modal{background:var(--mg-panel);border:1px solid var(--mg-b1);border-radius:18px;padding:0;max-width:420px;width:94%;box-shadow:0 24px 80px rgba(0,0,0,0.22);animation:modal-pop .3s cubic-bezier(.34,1.56,.64,1);overflow:hidden;}
.caba-final-header{background:linear-gradient(135deg,var(--mg-blue) 0%,#0055c8 100%);padding:20px 22px 18px;text-align:center;position:relative;}.caba-final-header::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:var(--mg-grad);}
.caba-final-emoji{font-size:36px;margin-bottom:6px;display:block;}.caba-final-title{font-size:16px;font-weight:800;color:#fff;margin-bottom:3px;}.caba-final-subtitle{font-size:11px;color:rgba(255,255,255,0.72);font-weight:500;}.caba-final-name{font-weight:800;color:#fff;}.caba-final-body{padding:18px 20px;}
.caba-rating-section{text-align:center;padding:12px 0 2px;border-top:1px solid var(--mg-b1);margin-top:8px;}.caba-rating-label{font-size:10px;color:var(--mg-t2);margin-bottom:8px;font-weight:500;}.caba-rating{display:inline-flex;flex-direction:row-reverse;gap:3px;}.caba-rating input{display:none;}.caba-rating label{font-size:28px;cursor:pointer;color:#9aa0b8;transition:color .12s ease,transform .18s cubic-bezier(.34,1.56,.64,1);display:inline-block;line-height:1;}.caba-rating label::before{content:"★";}.caba-rating label:hover,.caba-rating label:hover~label{color:#fbbf24;transform:scale(1.22);}.caba-rating input:checked~label{color:#f59e0b;}.caba-rating input:checked+label{animation:star-pop .28s cubic-bezier(.34,1.56,.64,1);}.caba-rating-thanks{font-size:10px;color:var(--mg-blue);margin-top:7px;min-height:16px;font-weight:600;}.caba-final-btns{display:flex;gap:7px;margin-top:14px;}
`;
  document.head.appendChild(s);
}

// ═══════════════════════════════════════════════════════════════
//  MODULE: AUTO DESCARTE (__dsc__)
// ═══════════════════════════════════════════════════════════════

// ─── DSC State + injector API ─────────────────────────────────
const API='https://gestao-ativos-api.magazineluiza.com.br';
const S={running:false,stop:false,results:[],startTime:null};

// ═══ API — delega pro injector.js (world: MAIN) ═══════
function cmdInjector(cmd,payload){
  return new Promise(function(resolve,reject){
    const id='cmd_'+Math.random().toString(36).slice(2);
    function handler(e){
      if(e.detail.id!==id)return;
      window.removeEventListener('__dsc_cmd_res__',handler);
      if(e.detail.error)reject(new Error(e.detail.error));
      else resolve(e.detail.data);
    }
    window.addEventListener('__dsc_cmd_res__',handler);
    window.dispatchEvent(new CustomEvent('__dsc_cmd__',{detail:{id,cmd,payload}}));
    setTimeout(()=>{
      window.removeEventListener('__dsc_cmd_res__',handler);
      reject(new Error('Timeout na comunicação com injector'));
    },30000);
  });
}

async function buscarAtivo(serial,placa,branch){
  return cmdInjector('buscar',{serial,placa,branch});
}


// ─── DSC Parse + Logic ────────────────────────────────────────
function parseLinhas(text){
  const result=[];
  text.split('\n').forEach(function(line){
    line=line.trim();if(!line)return;
    const parts=line.split(/\s+/);
    if(parts.length>=2){
      result.push({placa:parts[0],serial:parts[1],raw:line});
    } else if(parts.length===1){
      const v=parts[0];
      if(/^\d{1,8}$/.test(v)){result.push({placa:v,serial:'',raw:line});}
      else{result.push({placa:'',serial:v,raw:line});}
    }
  });
  return result;
}

// ═══ LÓGICA PRINCIPAL ════════════════════════════════
async function startDsc(){
  const raw=document.getElementById('dsc-ta').value||'';
  const branch='0038';
  const linhas=parseLinhas(raw);

  if(!getTok()){
    await modal({tipo:'err',icone:'🔐',titulo:'Token não capturado',mensagem:'Faça qualquer ação no site primeiro.',btns:[{t:'Ok',v:'ok',cls:'p'}]});return;
  }
  if(!linhas.length){
    await modal({tipo:'err',icone:'📝',titulo:'Lista vazia',mensagem:'Informe ao menos um ativo:\n244927 BE091410100011215858',btns:[{t:'Ok',v:'ok',cls:'p'}]});return;
  }

  logDsc(`Buscando ${linhas.length} ativo(s)...`,'info');
  setStDsc('Buscando ativos...');setProgDsc(5);
  const encontrados=[];
  const naoEncontrados=[];

  for(let i=0;i<linhas.length;i++){
    if(S.stop)break;
    const l=linhas[i];
    setStDsc(`Buscando ${i+1}/${linhas.length}...`);
    setProgDsc(5+Math.round(i/linhas.length*40));
    const _lbl=l.placa&&l.serial?`placa+serial: ${l.placa} / ${l.serial}`:l.placa?`placa: ${l.placa}`:`serial: ${l.serial}`;
    logDsc(`Buscando ${_lbl}`,'info');
    try{
      const res=await buscarAtivo(l.serial,l.placa,branch.padStart(4,'0'));
      if(res){
        const {itemCode,asset,modo}=res;
        encontrados.push({
          itemCode:String(itemCode),
          assetId:asset.assetId,
          description:asset.description||'—',
          plateNumber:asset.plateNumber||l.placa||'',
          serialNumber:asset.serialNumber||l.serial||'',
          username:asset.username||null,
          netBookValue:asset.netBookValue||0,
          acquisitionDate:asset.acquisitionDate||null,
          modo:modo,rawLine:l.raw
        });
        logDsc(`✓ Encontrado: ${asset.description||'?'} (${modo})`,'ok');
      }else{
        naoEncontrados.push(l);
        logDsc(`✗ Não encontrado: "${l.raw}"`,'err');
      }
    }catch(e){
      naoEncontrados.push(l);
      logDsc(`✗ Erro ao buscar "${l.raw}": ${e.message}`,'err');
    }
    await sleep(150);
  }

  if(S.stop){setStDsc('Interrompido.',false);S.running=false;showBtns(false);showWorkingDsc(false);return;}

  if(!encontrados.length){
    await modal({tipo:'err',icone:'🔍',titulo:'Nenhum ativo encontrado',mensagem:'Nenhum dos ativos informados foi localizado no sistema.',btns:[{t:'Ok',v:'ok',cls:'p'}]});
    setStDsc('Pronto.',false);setProgDsc(null);S.running=false;showBtns(false);showWorkingDsc(false);return;
  }

  let tabHtml='<table class="aa-rtable"><thead><tr><th>Patrimônio</th><th>Serial</th><th>Descrição</th><th>Encontrado por</th></tr></thead><tbody>';
  encontrados.forEach(function(a){
    tabHtml+=`<tr class="ok"><td>${a.plateNumber||'—'}</td><td style="font-size:10px">${a.serialNumber||'—'}</td><td>${a.description}</td><td><span class="tag-ok">${a.modo}</span></td></tr>`;
  });
  if(naoEncontrados.length){
    naoEncontrados.forEach(function(n){
      tabHtml+=`<tr class="fail"><td>${n.placa||'—'}</td><td style="font-size:10px">${n.serial||'—'}</td><td style="color:var(--mg-red)">Não encontrado</td><td><span class="tag-fail">—</span></td></tr>`;
    });
  }
  tabHtml+='</tbody></table>';

  const conf=await modal({
    icone:'🗑️',tipo:'warn',titulo:'Confirmar Descarte',wide:'aa-res-modal',
    html:`<div class="aa-res-sum">
      <div class="aa-res-cell"><div class="aa-res-val" style="color:var(--mg-blue)">${linhas.length}</div><div class="aa-res-lbl">Total</div></div>
      <div class="aa-res-cell"><div class="aa-res-val" style="color:var(--mg-green)">${encontrados.length}</div><div class="aa-res-lbl">Encontrados</div></div>
      <div class="aa-res-cell"><div class="aa-res-val" style="color:${naoEncontrados.length?'var(--mg-red)':'var(--mg-green)'}">${naoEncontrados.length}</div><div class="aa-res-lbl">Não achou</div></div>
    </div>
    <div style="font-size:10.5px;color:var(--mg-t3);text-align:center;margin-bottom:10px">CD${branch} · Descrição: "itens que não chegaram ao cd${branch}"</div>
    <div style="max-height:220px;overflow-y:auto;border:1px solid var(--mg-b1);border-radius:8px;margin-bottom:12px;">${tabHtml}</div>`,
    btns:[{t:'Cancelar',v:'n',cls:'d'},{t:`Descartar ${encontrados.length} ativo(s)`,v:'s',cls:'p'}]
  });
  if(conf!=='s'){setStDsc('Cancelado.',false);setProgDsc(null);S.running=false;showBtns(false);showWorkingDsc(false);return;}

  const solicitationBody={};
  encontrados.forEach(function(a){
    const key=String(a.itemCode);
    if(!solicitationBody[key])solicitationBody[key]=[];
    solicitationBody[key].push({
      assetId:a.assetId,description:a.description,
      plateNumber:a.plateNumber||'',serialNumber:a.serialNumber||'',
      username:a.username||null,netBookValue:a.netBookValue||0,
      acquisitionDate:a.acquisitionDate||null
    });
  });

  setStDsc('Criando solicitação de descarte...');setProgDsc(80);
  logDsc('Enviando solicitação de descarte...','info');
  try{
    const solId=await cmdInjector('descartar',{solicitationBody,branch});
    logDsc(`Solicitação criada #${solId} ✓`,'ok');
    S.results.push({solId,qtd:encontrados.length,status:'ok'});
    setProgDsc(100);setTimeout(()=>setProgDsc(null),600);
    setStDsc('Descarte finalizado!',false);
    await modalResultado(solId,encontrados,naoEncontrados,branch);
  }catch(e){
    logDsc(`ERRO ao criar descarte: ${e.message}`,'err');
    await modal({tipo:'err',icone:'❌',titulo:'Erro ao criar descarte',mensagem:e.message,btns:[{t:'Ok',v:'ok',cls:'p'}]});
    setStDsc('Erro.',false);setProgDsc(null);
  }
  S.running=false;showBtns(false);showWorkingDsc(false);
}

async function modalResultado(solId,encontrados,naoEncontrados,branch){
  return new Promise(res=>{
    const ov=document.createElement('div');ov.className='aa-ov';
    const m=document.createElement('div');m.className='aa-final-modal aa-res-modal';
    const nome=_userName||'usuário';
    const allOk=naoEncontrados.length===0;

    let tab='<table class="aa-rtable"><thead><tr><th>Patrimônio</th><th>Serial</th><th>Descrição</th><th>Status</th></tr></thead><tbody>';
    encontrados.forEach(function(a){
      tab+=`<tr class="ok"><td>${a.plateNumber||'—'}</td><td style="font-size:10px">${a.serialNumber||'—'}</td><td>${a.description}</td><td><span class="tag-ok">Descartado</span></td></tr>`;
    });
    naoEncontrados.forEach(function(n){
      tab+=`<tr class="fail"><td>${n.placa||'—'}</td><td style="font-size:10px">${n.serial||'—'}</td><td style="color:var(--mg-red)">Não encontrado</td><td><span class="tag-fail">Pulado</span></td></tr>`;
    });
    tab+='</tbody></table>';

    m.innerHTML=
      '<div class="aa-final-header">'+
        '<span class="aa-final-emoji">'+(allOk?'🎉':'⚠️')+'</span>'+
        '<div class="aa-final-title">Finalizado, <span class="aa-final-name">'+nome+'</span>! '+(allOk?'🎉':'')+'</div>'+
        '<div class="aa-final-subtitle">Aqui está o resultado de todos os ativos descartados.</div>'+
      '</div>'+
      '<div class="aa-final-body">'+
        '<div class="aa-res-sum">'+
          '<div class="aa-res-cell"><div class="aa-res-val" style="color:var(--mg-blue)">'+(encontrados.length+naoEncontrados.length)+'</div><div class="aa-res-lbl">Total</div></div>'+
          '<div class="aa-res-cell"><div class="aa-res-val" style="color:var(--mg-green)">'+encontrados.length+'</div><div class="aa-res-lbl">Descartados</div></div>'+
          '<div class="aa-res-cell"><div class="aa-res-val" style="color:'+(naoEncontrados.length?'var(--mg-red)':'var(--mg-green)')+'">'+naoEncontrados.length+'</div><div class="aa-res-lbl">Pulados</div></div>'+
        '</div>'+
        '<div style="font-size:9.5px;color:var(--mg-t3);text-align:center;margin-bottom:10px;font-weight:600">Sol. #'+solId+' · CD'+branch+'</div>'+
        '<div style="max-height:190px;overflow-y:auto;border:1px solid var(--mg-b1);border-radius:10px;margin-bottom:4px;">'+tab+'</div>'+
        '<div class="aa-rating-section">'+
          '<div class="aa-rating-label">Como foi a sua experiência?</div>'+
          '<div class="aa-rating" id="aa-stars">'+
            '<input type="radio" id="dsc-star5" name="aa-rating" value="5"><label for="dsc-star5"></label>'+
            '<input type="radio" id="dsc-star4" name="aa-rating" value="4"><label for="dsc-star4"></label>'+
            '<input type="radio" id="dsc-star3" name="aa-rating" value="3"><label for="dsc-star3"></label>'+
            '<input type="radio" id="dsc-star2" name="aa-rating" value="2"><label for="dsc-star2"></label>'+
            '<input type="radio" id="dsc-star1" name="aa-rating" value="1"><label for="dsc-star1"></label>'+
          '</div>'+
          '<div class="aa-rating-thanks" id="aa-rating-thanks"></div>'+
        '</div>'+
        '<div class="aa-final-btns">'+
          '<button class="aa-mb s" data-v="copy">📋 Copiar</button>'+
          '<button class="aa-mb p" data-v="close">Fechar</button>'+
        '</div>'+
      '</div>';

    ov.appendChild(m);document.body.appendChild(ov);
    const msgs=['😞 Vamos melhorar!','😐 Obrigado.','🙂 Valeu!','😊 Que bom!','🥳 Arrasou!'];
    m.querySelectorAll('#aa-stars input').forEach(inp=>{
      inp.addEventListener('change',()=>{
        const th=document.getElementById('aa-rating-thanks');
        if(th)th.textContent=msgs[parseInt(inp.value)-1]||'Obrigado!';
      });
    });
    m.querySelectorAll('[data-v]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        ov.remove();
        if(btn.dataset.v==='copy'){
          const lines=[
            `DESCARTE - ${new Date().toLocaleString('pt-BR')}`,
            `Solicitação: #${solId} · CD${branch}`,
            `Total: ${encontrados.length+naoEncontrados.length} | Descartados: ${encontrados.length} | Pulados: ${naoEncontrados.length}`,''
          ];
          encontrados.forEach(a=>lines.push(`OK  ${a.plateNumber||'—'}  ${a.serialNumber||'—'}  ${a.description}`));
          naoEncontrados.forEach(n=>lines.push(`NÃO ENCONTRADO  ${n.placa||'—'}  ${n.serial||'—'}`));
          navigator.clipboard.writeText(lines.join('\n'));
        }
        res(btn.dataset.v);
      });
    });
    ov.addEventListener('click',e=>{if(e.target===ov){ov.remove();res('close');}});
  });
}

// ─── DSC uiToken ─────────────────────────────────────────────
function uiTokenDsc(){
  const el=document.getElementById('dsc-tok');
  const tx=document.getElementById('dsc-tok-txt');
  const fill=document.getElementById('dsc-tok-fill');
  if(!el||!tx)return;
  if(!getTok()){el.className='dsc-tok-bar w';tx.textContent='Aguardando token...';if(fill){fill.style.transition='none';fill.style.width='0%';}return;}
  if(_tokenSessaoExpirou){el.className='dsc-tok-bar ex';tx.textContent='Sessão expirou';if(fill){fill.style.transition='none';fill.style.width='0%';}return;}
  const s=tokSecs();const maxSec=300;
  const pct=s!==null?Math.min(100,Math.max(0,(s/maxSec)*100)):100;
  if(s!==null&&s<=60){
    el.className='dsc-tok-bar ex';tx.textContent=s<=0?'Renovando...':s+'s restantes';
    if(fill){fill.style.transition='width 1s linear';fill.style.width=pct+'%';}
  } else if(s!==null&&s<=180){
    el.className='dsc-tok-bar w';tx.textContent=Math.ceil(s/60)+'min restantes';
    if(fill){fill.style.transition='width 5s linear';fill.style.width=pct+'%';}
  } else {
    el.className='dsc-tok-bar ok';tx.textContent=(s!==null?Math.ceil(s/60):5)+'min · Token ativo';
    if(fill){fill.style.transition='width 5s linear';fill.style.width=pct+'%';}
  }
}


// ─── DSC buildPanel ──────────────────────────────────────────
function buildPanel_dsc(){
  if(document.getElementById('__dsc__'))return;
  if(!document.body)return setTimeout(buildPanel,10);

  const toast=document.createElement('div');
  toast.id='dsc-welcome-toast';toast.className='dsc-welcome-toast';
  toast.innerHTML='<div class="dsc-toast-greeting">Bem-vindo de volta,</div><div class="dsc-toast-name" id="dsc-toast-name">'+(_userName||'...')+'</div><div class="dsc-toast-brand">Auto Descarte — Gestão de Ativos</div>';
  document.body.appendChild(toast);
  if(_userName){
    toast.dataset.shown='1';
    document.getElementById('dsc-toast-name').textContent=_userName;
    requestAnimationFrame(()=>{toast.classList.add('show');setTimeout(()=>toast.classList.add('hide'),3200);setTimeout(()=>toast.remove(),3800);});
  }

  const root=document.createElement('div');
  root.id='__dsc__';
  root.innerHTML=
    '<div class="dsc-header" id="dsc-drag-handle">'+
      '<div class="dsc-header-left">'+
        '<div class="dsc-spinner-wrap"><div class="dsc-spinner"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div></div>'+
        '<div class="dsc-header-info">'+
          '<div class="dsc-header-title">Auto Descarte</div>'+
          '<div class="dsc-header-sub">created by joao.gmarques</div>'+
        '</div>'+
      '</div>'+
      '<div class="dsc-header-btns">'+
        '<button class="dsc-hbtn" id="dsc-min" title="Minimizar"></button>'+
        '<button class="dsc-hbtn close-btn" id="dsc-close" title="Fechar">✕</button>'+
      '</div>'+
    '</div>'+

    '<div class="dsc-welcome-inline" id="dsc-welcome-wrap">'+
      '<div class="dsc-welcome-av" id="dsc-welcome-av">?</div>'+
      '<div>'+
        '<div class="dsc-welcome-txt">Olá, <span class="dsc-welcome-name" id="dsc-welcome-name">usuário</span></div>'+
        '<div class="dsc-welcome-sub">Painel de descartes ativo</div>'+
      '</div>'+
    '</div>'+

    '<div class="dsc-tok-bar w" id="dsc-tok">'+
      '<div class="dsc-tok-dot"></div>'+
      '<span class="dsc-tok-label" id="dsc-tok-txt">Aguardando token...</span>'+
      '<div class="dsc-tok-track"><div class="dsc-tok-fill" id="dsc-tok-fill" style="width:0%"></div></div>'+
    '</div>'+

    '<div class="dsc-body">'+
      '<div class="dsc-card">'+
        '<div class="dsc-card-label">Ativos para descartar</div>'+
        '<div class="dsc-tutorial">'+
          'Informe o <strong>nº de patrimônio</strong> e o <strong>número de série</strong> por linha, separados por espaço.'+
          '<br><span class="dsc-tutorial-example">211769 183561 &nbsp;→&nbsp; patrimônio, série</span>'+
          '<br><span class="dsc-tutorial-example">BE0914101000112 &nbsp;→&nbsp; só o serial</span>'+
        '</div>'+
        '<textarea class="dsc-ta" id="dsc-ta" rows="5" placeholder="211769 183561&#10;282440 BE091410100011215858&#10;123456&#10;BE091410100011215858"></textarea>'+

      '</div>'+

      '<div class="dsc-typewriter-wrap" id="dsc-typewriter">'+
        '<div class="dsc-typewriter">'+
          '<div class="tw-slide"><i></i></div>'+
          '<div class="tw-paper"></div>'+
          '<div class="tw-keyboard"></div>'+
        '</div>'+
        '<div class="dsc-tw-spinner">'+
          'Processando'+
          '<div class="dsc-tw-spinner-track">'+
            '<span class="dsc-tw-word">descarte...</span>'+
            '<span class="dsc-tw-word">ativos...</span>'+
            '<span class="dsc-tw-word">patrimônio...</span>'+
            '<span class="dsc-tw-word">confirmação...</span>'+
            '<span class="dsc-tw-word">descarte...</span>'+
          '</div>'+
        '</div>'+
      '</div>'+

      '<button class="dsc-btn-run-wrap" id="dsc-run">'+
        '<div class="dsc-btn-run-inner">'+
          'INICIAR DESCARTE'+
          '<svg class="dsc-btn-run-svg" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">'+
            '<path d="M11.6801 14.62L14.2401 12.06L11.6801 9.5" stroke="white" stroke-width="2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>'+
            '<path d="M4 12.0601H14.17" stroke="white" stroke-width="2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>'+
            '<path d="M12 4C16.42 4 20 7 20 12C20 17 16.42 20 12 20" stroke="white" stroke-width="2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>'+
          '</svg>'+
        '</div>'+
      '</button>'+

      '<div class="dsc-divider"></div>'+
      '<div class="dsc-status" id="dsc-st">Pronto para iniciar.</div>'+
      '<div class="dsc-progress-wrap" id="dsc-pw"><div class="dsc-progress-bar" id="dsc-pb"></div></div>'+
    '</div>'+

    '<div class="dsc-stop-section" id="dsc-stop-section">'+
      '<div class="dsc-btn-stop-wrap" id="dsc-stop">'+
        '<span class="dsc-stop-text">Parar</span>'+
        '<span class="dsc-stop-icon">'+
          '<svg class="dsc-stop-svg" height="512" viewBox="0 0 512 512" width="512" xmlns="http://www.w3.org/2000/svg">'+
            '<path d="M112,112l20,320c.95,18.49,14.4,32,32,32H348c17.67,0,30.87-13.51,32-32l20-320" style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"/>'+
            '<line style="stroke:#fff;stroke-linecap:round;stroke-miterlimit:10;stroke-width:32px" x1="80" x2="432" y1="112" y2="112"/>'+
            '<path d="M192,112V72h0a23.93,23.93,0,0,1,24-24h80a23.93,23.93,0,0,1,24,24h0v40" style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"/>'+
          '</svg>'+
        '</span>'+
      '</div>'+
    '</div>'+

    '<div class="dsc-log-section">'+
      '<div class="dsc-log-header" id="dsc-lh">'+
        '<span class="dsc-log-title">Logs <span class="dsc-log-count" id="dsc-lc">0</span></span>'+
        '<button class="dsc-log-clear" id="dsc-lclr">limpar</button>'+
      '</div>'+
      '<div class="dsc-log-body" id="dsc-lb"><div class="dsc-log-entry info">Aguardando...</div></div>'+
    '</div>';

  document.body.appendChild(root);

  const tab=document.createElement('button');
  tab.id='__dsc_tab__';tab.innerHTML='🗑️';
  document.body.appendChild(tab);

  // DRAG
  let isDragging=false,dragOffX=0,dragOffY=0;
  const handle=document.getElementById('dsc-drag-handle');
  handle.addEventListener('mousedown',e=>{
    if(e.target.closest('.dsc-hbtn'))return;
    isDragging=true;const r=root.getBoundingClientRect();
    dragOffX=e.clientX-r.left;dragOffY=e.clientY-r.top;document.body.style.userSelect='none';
  });
  document.addEventListener('mousemove',e=>{
    if(!isDragging)return;
    let x=e.clientX-dragOffX,y=e.clientY-dragOffY;
    x=Math.max(0,Math.min(x,window.innerWidth-root.offsetWidth));
    y=Math.max(0,Math.min(y,window.innerHeight-60));
    root.style.left=x+'px';root.style.top=y+'px';root.style.right='auto';
  });
  document.addEventListener('mouseup',()=>{if(isDragging){isDragging=false;document.body.style.userSelect='';}});

  // CLOSE
  document.getElementById('dsc-close').onclick=e=>{
    e.stopPropagation();root.classList.add('off');tab.style.display='flex';
    tab.classList.remove('popping');void tab.offsetWidth;tab.classList.add('popping');
    setTimeout(()=>tab.classList.remove('popping'),1200);
  };
  tab.onclick=()=>{root.classList.remove('off');tab.style.display='none';};

  // MINIMIZE
  const minBtn=document.getElementById('dsc-min');
  minBtn.setAttribute('data-state','open');
  let mini=false;
  minBtn.onclick=e=>{
    e.stopPropagation();mini=!mini;
    root.classList.toggle('minimized',mini);
    minBtn.setAttribute('data-state',mini?'closed':'open');
    minBtn.title=mini?'Restaurar':'Minimizar';
  };

  // RUN / STOP
  document.getElementById('dsc-run').onclick=()=>{
    if(S.running)return;
    S.running=true;S.stop=false;S.results=[];S.startTime=Date.now();
    showBtns(true);showWorkingDsc(true);startDsc();
  };
  document.getElementById('dsc-stop').onclick=()=>{S.stop=true;setStDsc('Parando...');logDsc('Interrompido pelo usuário.','warn');};

  // LOG
  let logOpen=true;
  document.getElementById('dsc-lh').onclick=()=>{logOpen=!logOpen;document.getElementById('dsc-lb').style.display=logOpen?'':'none';};
  document.getElementById('dsc-lclr').onclick=e=>{e.stopPropagation();document.getElementById('dsc-lb').innerHTML='';_lc=0;document.getElementById('dsc-lc').textContent='0';};

  if(_userName)updateWelcome();
  uiTokenDsc();
  setInterval(uiTokenDsc,5000);
}

// ─── DSC helpers ─────────────────────────────────────────────
function showWorkingDsc(show){
  const tw=document.getElementById('dsc-typewriter');
  if(tw)tw.classList.toggle('active',show);
}

function showBtns(running){
  const runBtn=document.getElementById('dsc-run');
  const stopSec=document.getElementById('dsc-stop-section');
  const stopBtn=document.getElementById('dsc-stop');
  if(!runBtn||!stopSec||!stopBtn)return;
  runBtn.style.display=running?'none':'';
  stopSec.classList.toggle('active',running);
  stopBtn.style.display=running?'flex':'none';
}

function setStDsc(t,on){const el=document.getElementById('dsc-st');if(!el)return;el.textContent=t;el.className='dsc-status'+(on!==false?' on':'');}
function setProgDsc(p){const w=document.getElementById('dsc-pw'),b=document.getElementById('dsc-pb');if(!w||!b)return;if(p===null){w.classList.remove('on');return;}w.classList.add('on');b.style.width=p+'%';}
let _lc=0;
function logDsc(msg,type){
  type=type||'info';const lb=document.getElementById('dsc-lb');if(!lb)return;
  _lc++;const lc=document.getElementById('dsc-lc');if(lc)lc.textContent=_lc;
  const t=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const d=document.createElement('div');d.className='dsc-log-entry '+type;
  d.textContent=t+'  '+msg;lb.appendChild(d);lb.scrollTop=lb.scrollHeight;
  if(lb.children.length>200)lb.removeChild(lb.children[0]);
}




// ═══════════════════════════════════════════════════════════════
//  MODULE: SOLICITAR ATIVOS (__sol__)
// ═══════════════════════════════════════════════════════════════

// ─── SOL State + API ──────────────────────────────────────────
// ═══ HELPERS ══════════════════════════════════════════
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const pad=(c,n=4)=>String(c).padStart(n,'0');
const norm=c=>(c||'').toString().replace(/\D/g,'').replace(/^0+/,'');

// ═══ STATE ════════════════════════════════════════════
const API='https://gestao-ativos-api.magazineluiza.com.br';
const S={running:false,stop:false,results:[],startTime:null};

// ═══ API ══════════════════════════════════════════════
async function _refresh401Sol(){logSol('Token 401 - renovando...','warn');await _renovarTokenSilencioso();}
async function reqSol(method,ep,body,retry){
  retry=retry||0;await ensureToken();
  const auth=getTok();if(!auth)throw new Error('Token nao capturado.');
  const opts={method,headers:{'Content-Type':'application/json','Authorization':auth}};
  if(body)opts.body=JSON.stringify(body);
  const res=await fetch(API+ep,opts);
  if(res.status>=200&&res.status<300){const t=await res.text();try{return JSON.parse(t);}catch{return t;}}
  if(res.status===401&&retry<3){await _refresh401Sol();return reqSol(method,ep,body,retry+1);}
  const txt=await res.text().catch(()=>'');
  throw new Error('HTTP '+res.status+': '+txt.slice(0,120));
}

// ─── SOL magaluBrandBlock ─────────────────────────────────────
// ═══ LOGO BLOCK ═══════════════════════════════════════
function magaluBrandBlock(size){
  const isLg=size==='lg';
  // Fonte oficial Magalu é arredondada — usamos a mais próxima disponível
  // sm: ao lado de "by joao.gmarques" no header; lg: destaque no toast
  const fs=isLg?24:16;
  // largura real de "Magalu" em rounded black ≈ fs * 3.2
  const textW=Math.round(fs*3.25);
  const svgH=Math.round(fs*1.25);
  // SVG com overflow:visible pra não cortar descenders
  const svg=`<svg width="${textW}" height="${svgH}" viewBox="0 0 ${textW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible;"><text x="0" y="${svgH-2}" font-family="'Nunito','Varela Round','Arial Rounded MT Bold','Arial Black',Arial,sans-serif" font-size="${fs}" font-weight="900" fill="#0f1120" letter-spacing="-0.5">Magalu</text></svg>`;
  // barra cola direto no SVG, gap:0
  return `<div class="sol-magalu-logo" style="gap:0;">${svg}<div class="sol-logo-bar" style="width:${textW}px;margin-top:2px;"></div></div>`;
}


// ─── SOL uiToken ─────────────────────────────────────────────
// ═══ TOKEN UI — MELHORIA 4: baseado em 5 minutos reais ═══
function uiTokenSol(){
  const el=document.getElementById('sol-tok');
  const tx=document.getElementById('sol-tok-txt');
  const fill=document.getElementById('sol-tok-fill');
  if(!el||!tx)return;

  if(!getTok()){
    el.className='sol-tok-bar w';
    tx.textContent='Aguardando token...';
    if(fill){fill.style.transition='none';fill.style.width='0%';}
    return;
  }
  if(_tokenSessaoExpirou){
    el.className='sol-tok-bar ex';
    tx.textContent='Sessão expirou';
    if(fill){fill.style.transition='none';fill.style.width='0%';}
    return;
  }

  const s=tokSecs();
  // token de 5 minutos = 300s
  const maxSec=300;
  const pct=s!==null?Math.min(100,Math.max(0,(s/maxSec)*100)):100;

  if(s!==null&&s<=60){
    // vermelho: último minuto
    el.className='sol-tok-bar ex';
    tx.textContent=s<=0?'Renovando...':s+'s restantes';
    if(fill){fill.style.transition='width 1s linear';fill.style.width=pct+'%';}
  } else if(s!==null&&s<=180){
    // laranja/amarelo: menos de 3 minutos
    el.className='sol-tok-bar w';
    const m=Math.ceil(s/60);
    tx.textContent=m+'min restantes';
    if(fill){fill.style.transition='width 5s linear';fill.style.width=pct+'%';}
  } else {
    // verde: ok
    el.className='sol-tok-bar ok';
    const m=s!==null?Math.ceil(s/60):5;
    tx.textContent=m+'min · Token ativo';
    if(fill){fill.style.transition='width 5s linear';fill.style.width=pct+'%';}
  }
}

// ─── SOL buildPanel ──────────────────────────────────────────
// ═══ PAINEL ═══════════════════════════════════════════
function buildPanel_sol(){
  if(document.getElementById('__sol__'))return;
  if(!document.body)return setTimeout(buildPanel,10);

  // Toast
  const toast=document.createElement('div');
  toast.id='sol-welcome-toast';toast.className='sol-welcome-toast';
  toast.innerHTML=
    '<div class="sol-toast-greeting">Bem-vindo de volta,</div>'+
    '<div class="sol-toast-name" id="sol-toast-name">'+(_userName||'...')+'</div>'+
    '<div class="sol-toast-brand">Gestão de Ativos</div>'+
    '<div class="sol-toast-logo">'+magaluBrandBlock('lg')+'</div>';
  document.body.appendChild(toast);
  if(_userName){
    toast.dataset.shown='1';
    document.getElementById('sol-toast-name').textContent=_userName;
    requestAnimationFrame(()=>{
      toast.classList.add('show');
      setTimeout(()=>toast.classList.add('hide'),3200);
      setTimeout(()=>toast.remove(),3800);
    });
  }

  const root=document.createElement('div');
  root.id='__sol__';
  root.innerHTML=
    // HEADER — spinner CSS + "Solicitar Ativos" + created by
    '<div class="sol-header" id="sol-drag-handle">'+
      '<div class="sol-header-left">'+
        '<div class="sol-spinner-wrap">'+
          '<div class="sol-spinner">'+
            '<span></span><span></span><span></span><span></span>'+
            '<span></span><span></span><span></span><span></span>'+
          '</div>'+
        '</div>'+
        '<div class="sol-header-info">'+
          '<div class="sol-header-title-row">'+
            '<div class="sol-header-title">Solicitar Ativos</div>'+
          '</div>'+
          '<div class="sol-header-sub">created by joao.gmarques</div>'+
        '</div>'+
      '</div>'+
      '<div class="sol-header-btns">'+
        '<button class="sol-hbtn" id="sol-min" title="Minimizar"></button>'+
        '<button class="sol-hbtn close-btn" id="sol-close" title="Fechar">✕</button>'+
      '</div>'+
    '</div>'+

    '<div class="sol-welcome-inline" id="sol-welcome-wrap">'+
      '<div class="sol-welcome-av" id="sol-welcome-av">?</div>'+
      '<div>'+
        '<div class="sol-welcome-txt">Olá, <span class="sol-welcome-name" id="sol-welcome-name">usuário</span></div>'+
        '<div class="sol-welcome-sub">Painel de solicitações ativo</div>'+
      '</div>'+
    '</div>'+

    '<div class="sol-tok-bar w" id="sol-tok">'+
      '<div class="sol-tok-dot"></div>'+
      '<span class="sol-tok-label" id="sol-tok-txt">Aguardando token...</span>'+
      '<div class="sol-tok-track"><div class="sol-tok-fill" id="sol-tok-fill" style="width:0%"></div></div>'+
    '</div>'+

    '<div class="sol-body">'+

      '<div class="sol-card">'+
        '<div class="sol-card-label">Modo de execução</div>'+
        '<div class="sol-modo-selector">'+
          '<label class="sol-modo-radio">'+
            '<input type="radio" name="sol-modo" id="sol-modo-unico" checked/>'+
            '<span class="sol-modo-name">Gemco Único</span>'+
          '</label>'+
          '<label class="sol-modo-radio">'+
            '<input type="radio" name="sol-modo" id="sol-modo-filial"/>'+
            '<span class="sol-modo-name">Gemco por Filial</span>'+
          '</label>'+
        '</div>'+
        '<div class="sol-gemco-desc" id="sol-modo-desc">'+
          'Informe a <strong>filial</strong> e a <strong>quantidade</strong> por linha. O gemco base será aplicado a todas as filiais.'+
          '<br><span class="sol-gemco-example">550 1 &nbsp;→&nbsp; filial 550, qtd 1</span>'+
        '</div>'+
        '<div class="sol-card-label">Filiais + quantidade</div>'+
        '<textarea class="sol-ta" id="sol-ta" rows="4" placeholder="550 1&#10;350 2&#10;123 3"></textarea>'+
      '</div>'+

      '<div class="sol-card">'+
        '<div class="sol-card-label">Configuração</div>'+
        '<div class="sol-gemco-wrap" id="sol-gemco-wrap">'+
          '<div class="sol-row"><input class="sol-inp" id="sol-gemco" placeholder="Gemco base (ex: 2936932)"/></div>'+
        '</div>'+
        '<div class="sol-row">'+
          '<div class="sol-sel-wrap">'+
            '<select class="sol-sel" id="sol-origin">'+
              '<option value="0038">Origem: CD38</option>'+
              '<option value="0991">Origem: CD991</option>'+
            '</select>'+
            '<span class="sol-sa">▾</span>'+
          '</div>'+
        '</div>'+
      '</div>'+

      // Typewriter original Uiverse Nawsome + word spinner kennyotsu
      '<div class="sol-typewriter-wrap" id="sol-typewriter">'+
        '<div class="sol-typewriter">'+
          '<div class="tw-slide"><i></i></div>'+
          '<div class="tw-paper"></div>'+
          '<div class="tw-keyboard"></div>'+
        '</div>'+
        '<div class="sol-tw-spinner">'+
          'Processando'+
          '<div class="sol-tw-spinner-track">'+
            '<span class="sol-tw-word">solicitação...</span>'+
            '<span class="sol-tw-word">ativos...</span>'+
            '<span class="sol-tw-word">CD de origem...</span>'+
            '<span class="sol-tw-word">confirmação...</span>'+
            '<span class="sol-tw-word">solicitação...</span>'+
          '</div>'+
        '</div>'+
      '</div>'+

      '<button class="sol-btn-run-wrap" id="sol-run">'+
        '<div class="sol-btn-run-inner">'+
          'INICIAR'+
          '<svg class="sol-btn-run-svg" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">'+
            '<path d="M11.6801 14.62L14.2401 12.06L11.6801 9.5" stroke="white" stroke-width="2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>'+
            '<path d="M4 12.0601H14.17" stroke="white" stroke-width="2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>'+
            '<path d="M12 4C16.42 4 20 7 20 12C20 17 16.42 20 12 20" stroke="white" stroke-width="2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>'+
          '</svg>'+
        '</div>'+
      '</button>'+

      '<div class="sol-divider"></div>'+
      '<div class="sol-status" id="sol-st">Pronto para iniciar.</div>'+
      '<div class="sol-progress-wrap" id="sol-pw"><div class="sol-progress-bar" id="sol-pb"></div></div>'+

    '</div>'+

    '<div class="sol-stop-section" id="sol-stop-section">'+
      '<div class="sol-btn-stop-wrap" id="sol-stop">'+
        '<span class="sol-stop-text">Parar</span>'+
        '<span class="sol-stop-icon">'+
          '<svg class="sol-stop-svg" height="512" viewBox="0 0 512 512" width="512" xmlns="http://www.w3.org/2000/svg">'+
            '<path d="M112,112l20,320c.95,18.49,14.4,32,32,32H348c17.67,0,30.87-13.51,32-32l20-320" style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"/>'+
            '<line style="stroke:#fff;stroke-linecap:round;stroke-miterlimit:10;stroke-width:32px" x1="80" x2="432" y1="112" y2="112"/>'+
            '<path d="M192,112V72h0a23.93,23.93,0,0,1,24-24h80a23.93,23.93,0,0,1,24,24h0v40" style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"/>'+
            '<line style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px" x1="256" x2="256" y1="176" y2="400"/>'+
            '<line style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px" x1="184" x2="192" y1="176" y2="400"/>'+
            '<line style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px" x1="328" x2="320" y1="176" y2="400"/>'+
          '</svg>'+
        '</span>'+
      '</div>'+
    '</div>'+

    '<div class="sol-log-section">'+
      '<div class="sol-log-header" id="sol-lh">'+
        '<span class="sol-log-title">Logs <span class="sol-log-count" id="sol-lc">0</span></span>'+
        '<button class="sol-log-clear" id="sol-lclr">limpar</button>'+
      '</div>'+
      '<div class="sol-log-body" id="sol-lb"><div class="sol-log-entry info">Aguardando...</div></div>'+
    '</div>';

  document.body.appendChild(root);

  const tab=document.createElement('button');
  tab.id='__sol_tab__';tab.innerHTML='📤';
  document.body.appendChild(tab);

  // DRAG
  let isDragging=false,dragOffX=0,dragOffY=0;
  const handle=document.getElementById('sol-drag-handle');
  handle.addEventListener('mousedown',e=>{
    if(e.target.closest('.sol-hbtn'))return;
    isDragging=true;
    const r=root.getBoundingClientRect();
    dragOffX=e.clientX-r.left;dragOffY=e.clientY-r.top;
    document.body.style.userSelect='none';
  });
  document.addEventListener('mousemove',e=>{
    if(!isDragging)return;
    let x=e.clientX-dragOffX,y=e.clientY-dragOffY;
    x=Math.max(0,Math.min(x,window.innerWidth-root.offsetWidth));
    y=Math.max(0,Math.min(y,window.innerHeight-60));
    root.style.left=x+'px';root.style.top=y+'px';root.style.right='auto';
  });
  document.addEventListener('mouseup',()=>{if(isDragging){isDragging=false;document.body.style.userSelect='';}});

  // CLOSE — com animação de pop no FAB
  document.getElementById('sol-close').onclick=e=>{
    e.stopPropagation();
    root.classList.add('off');
    tab.style.display='flex';
    tab.classList.remove('popping');
    void tab.offsetWidth; // reflow para reiniciar animação
    tab.classList.add('popping');
    setTimeout(()=>tab.classList.remove('popping'),1200);
  };
  tab.onclick=()=>{root.classList.remove('off');tab.style.display='none';};

  // MINIMIZE — ícones CSS puro, sem SVG
  const minBtn=document.getElementById('sol-min');
  minBtn.setAttribute('data-state','open');
  let mini=false;
  minBtn.onclick=e=>{
    e.stopPropagation();
    mini=!mini;
    root.classList.toggle('minimized',mini);
    minBtn.setAttribute('data-state',mini?'closed':'open');
    minBtn.title=mini?'Restaurar':'Minimizar';
  };

  // MODO
  function setModo(unico){
    document.getElementById('sol-modo-unico').checked=unico;
    document.getElementById('sol-modo-filial').checked=!unico;
    document.getElementById('sol-gemco-wrap').style.display=unico?'':'none';
    const ta=document.getElementById('sol-ta');
    const desc=document.getElementById('sol-modo-desc');
    if(unico){
      ta.placeholder='550 1\n350 2\n123 3';
      desc.innerHTML='Informe a <strong>filial</strong> e a <strong>quantidade</strong> por linha. O gemco base será aplicado a todas as filiais.<br><span class="sol-gemco-example">550 1 &nbsp;→&nbsp; filial 550, qtd 1</span>';
    }else{
      ta.placeholder='550 1 2936932\n350 2 1234567\n123 3 9876543';
      desc.innerHTML='Informe <strong>filial</strong>, <strong>quantidade</strong> e <strong>gemco</strong> por linha.<br><span class="sol-gemco-example">550 1 2936932 &nbsp;→&nbsp; filial, qtd, gemco</span>';
    }
  }
  document.getElementById('sol-modo-unico').addEventListener('change',()=>setModo(true));
  document.getElementById('sol-modo-filial').addEventListener('change',()=>setModo(false));

  document.getElementById('sol-run').onclick=start;
  document.getElementById('sol-stop').onclick=()=>{S.stop=true;setStSol('Parando...');logSol('Interrompido pelo usuário.','warn');};

  let logOpen=true;
  document.getElementById('sol-lh').onclick=()=>{logOpen=!logOpen;document.getElementById('sol-lb').style.display=logOpen?'':'none';};
  document.getElementById('sol-lclr').onclick=e=>{e.stopPropagation();document.getElementById('sol-lb').innerHTML='';_lc=0;document.getElementById('sol-lc').textContent='0';};
  if(_userName)updateWelcome();
  uiTokenSol();
  setInterval(uiTokenSol,5000);
}

// ─── SOL logic + start ───────────────────────────────────────
function setStSol(t,on){const el=document.getElementById('sol-st');if(!el)return;el.textContent=t;el.className='sol-status'+(on!==false?' on':'');}
function setProgSol(p){
  const w=document.getElementById('sol-pw'),b=document.getElementById('sol-pb');
  if(!w||!b)return;
  if(p===null){w.classList.remove('on');return;}
  w.classList.add('on');b.style.width=p+'%';
}
let _lc=0;
function logSol(msg,type){
  type=type||'info';
  const lb=document.getElementById('sol-lb');if(!lb)return;
  _lc++;const lc=document.getElementById('sol-lc');if(lc)lc.textContent=_lc;
  const t=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const d=document.createElement('div');d.className='sol-log-entry '+type;
  d.textContent=t+'  '+msg;lb.appendChild(d);lb.scrollTop=lb.scrollHeight;
  if(lb.children.length>200)lb.removeChild(lb.children[0]);
}


function modalFinal(oks,fails,gemcoLabel,origin){
  return new Promise(res=>{
    const ov=document.createElement('div');ov.className='aa-ov';
    const m=document.createElement('div');m.className='aa-final-modal aa-res-modal';
    const nome=_userName||'usuário';const allOk=fails.length===0;

    let tab='<table class="aa-rtable"><thead><tr><th>Filial</th><th>Itens</th><th>Sol.</th><th>Status</th></tr></thead><tbody>';
    [...oks,...fails].forEach(r=>{
      const itens=r.assets.map(a=>'<span style="font-size:9px;color:var(--mg-t2)">'+a.itemCode+' x'+a.amount+'</span>').join('<br>');
      tab+='<tr class="'+(r.status==='ok'?'ok':'fail')+'"><td><strong>'+r.filial+'</strong></td><td>'+itens+'</td><td style="font-size:9.5px">'+(r.solId||'—')+'</td><td>'+(r.status==='ok'?'<span class="tag-ok">OK</span>':'<span class="tag-fail">Falhou</span>')+'</td></tr>';
      if(r.status==='fail')tab+='<tr class="fail"><td colspan="4" style="font-size:9px;color:var(--mg-red);padding:2px 8px 5px">'+r.motivo+'</td></tr>';
    });
    tab+='</tbody></table>';

    m.innerHTML=
      '<div class="aa-final-header">'+
        '<span class="aa-final-emoji">'+(allOk?'🎉':'⚠️')+'</span>'+
        '<div class="aa-final-title">Finalizamos, <span class="aa-final-name">'+nome+'</span>! '+(allOk?'🎉':'')+'</div>'+
        '<div class="aa-final-subtitle">Aqui está o resultado de todos os ativos solicitados.</div>'+
      '</div>'+
      '<div class="aa-final-body">'+
        '<div class="aa-res-sum">'+
          '<div class="aa-res-cell"><div class="aa-res-val" style="color:var(--mg-blue)">'+S.results.length+'</div><div class="aa-res-lbl">Total</div></div>'+
          '<div class="aa-res-cell"><div class="aa-res-val" style="color:var(--mg-green)">'+oks.length+'</div><div class="aa-res-lbl">Sucesso</div></div>'+
          '<div class="aa-res-cell"><div class="aa-res-val" style="color:'+(fails.length?'var(--mg-red)':'var(--mg-green)')+'">'+fails.length+'</div><div class="aa-res-lbl">Falhas</div></div>'+
        '</div>'+
        '<div style="font-size:9.5px;color:var(--mg-t3);text-align:center;margin-bottom:10px;font-weight:600">Gemco: '+gemcoLabel+' · Origem: CD'+norm(origin)+'</div>'+
        '<div style="max-height:190px;overflow-y:auto;border:1px solid var(--mg-b1);border-radius:10px;margin-bottom:4px;">'+tab+'</div>'+
        '<div class="aa-rating-section">'+
          '<div class="aa-rating-label">Como foi a sua experiência?</div>'+
          '<div class="aa-rating" id="aa-stars">'+
            '<input type="radio" id="star5" name="aa-rating" value="5"><label for="star5"></label>'+
            '<input type="radio" id="star4" name="aa-rating" value="4"><label for="star4"></label>'+
            '<input type="radio" id="star3" name="aa-rating" value="3"><label for="star3"></label>'+
            '<input type="radio" id="star2" name="aa-rating" value="2"><label for="star2"></label>'+
            '<input type="radio" id="star1" name="aa-rating" value="1"><label for="star1"></label>'+
          '</div>'+
          '<div class="aa-rating-thanks" id="aa-rating-thanks"></div>'+
        '</div>'+
        '<div class="aa-final-btns">'+
          '<button class="aa-mb s" data-v="copy">📋 Copiar</button>'+
          '<button class="aa-mb p" data-v="close">Fechar</button>'+
        '</div>'+
      '</div>';

    ov.appendChild(m);document.body.appendChild(ov);
    const msgs=['😞 Vamos melhorar!','😐 Obrigado.','🙂 Valeu!','😊 Que bom!','🥳 Arrasou!'];
    m.querySelectorAll('#aa-stars input').forEach(inp=>{
      inp.addEventListener('change',()=>{
        const th=document.getElementById('aa-rating-thanks');
        if(th)th.textContent=msgs[parseInt(inp.value)-1]||'Obrigado!';
      });
    });
    m.querySelectorAll('[data-v]').forEach(btn=>{btn.addEventListener('click',()=>{ov.remove();res(btn.dataset.v);});});
    ov.addEventListener('click',e=>{if(e.target===ov){ov.remove();res('close');}});
  });
}

function parseFilialsSol(text,modoGemcoPorFilial){
  const result=[];
  text.split('\n').forEach(line=>{
    line=line.trim();if(!line||line.startsWith('#'))return;
    if(modoGemcoPorFilial){
      const m=line.match(/^(\d+)\s+(\d+)\s+(\d+)$/);
      if(m){result.push({filial:m[1],filialPad:pad(m[1]),qtd:parseInt(m[2]),gemco:m[3]});return;}
      const m2=line.match(/^(\d+)\s+(\d{5,})$/);
      if(m2){result.push({filial:m2[1],filialPad:pad(m2[1]),qtd:1,gemco:m2[2]});return;}
    }else{
      const m=line.match(/^(\d+)\s+(\d+)$/);
      if(m){result.push({filial:m[1],filialPad:pad(m[1]),qtd:parseInt(m[2])});return;}
      const m2=line.match(/^(\d+)$/);
      if(m2){result.push({filial:m2[1],filialPad:pad(m2[1]),qtd:1});}
    }
  });
  return result;
}

function showWorkingSol(show){
  const tw=document.getElementById('sol-typewriter');
  if(tw)tw.classList.toggle('active',show);
}

async function startSol(){
  const raw=document.getElementById('sol-ta').value||'';
  const origin=document.getElementById('sol-origin').value||'0038';
  const modoUnico=document.getElementById('sol-modo-unico').checked;
  const modoPorFilial=!modoUnico;
  const jobs=parseFilialsSol(raw,modoPorFilial);
  let gemcoUnico='';
  if(modoUnico){
    gemcoUnico=(document.getElementById('sol-gemco').value||'').trim();
    if(!gemcoUnico){await modal({tipo:'err',icone:'🔍',titulo:'Gemco não informado',mensagem:'Informe o código Gemco do produto.',btns:[{t:'Ok',v:'ok',cls:'p'}]});return;}
  }
  if(!getTok()){await modal({tipo:'err',icone:'🔐',titulo:'Token não capturado',mensagem:'Faça qualquer ação no site primeiro.',btns:[{t:'Ok',v:'ok',cls:'p'}]});return;}
  if(!jobs.length){
    const ex=modoPorFilial?'550 1 2936932\n350 2 1234567':'550 1\n350 2';
    await modal({tipo:'err',icone:'📝',titulo:'Nenhuma filial',mensagem:'Informe ao menos uma filial:\n'+ex,btns:[{t:'Ok',v:'ok',cls:'p'}]});return;
  }
  if(modoPorFilial){
    const semGemco=jobs.filter(j=>!j.gemco);
    if(semGemco.length){await modal({tipo:'err',icone:'🔍',titulo:'Gemco ausente',mensagem:'Sem Gemco:\n'+semGemco.map(j=>'Filial '+j.filial).join('\n'),btns:[{t:'Ok',v:'ok',cls:'p'}]});return;}
  }
  const gruposMap={};const gruposOrdem=[];
  jobs.forEach(j=>{
    const key=j.filialPad;
    if(!gruposMap[key]){gruposMap[key]={filial:j.filial,filialPad:j.filialPad,assets:[]};gruposOrdem.push(key);}
    const gemco=modoUnico?gemcoUnico:j.gemco;
    const existing=gruposMap[key].assets.find(a=>a.itemCode===gemco);
    if(existing)existing.amount+=j.qtd;else gruposMap[key].assets.push({itemCode:gemco,amount:j.qtd});
  });
  const grupos=gruposOrdem.map(k=>gruposMap[k]);
  const preview=grupos.slice(0,5).map(g=>'· CD'+g.filial+': '+g.assets.map(a=>'Gemco '+a.itemCode+' x'+a.amount).join(', ')).join('\n')+(grupos.length>5?'\n... e mais '+(grupos.length-5):'');
  const agrupouLabel=grupos.length<jobs.length?' ('+jobs.length+' linhas → '+grupos.length+' sols)':'';
  const conf=await modal({icone:'📤',tipo:'info',titulo:'Confirmar Solicitações',mensagem:'Origem: CD'+norm(origin)+'\nSolicitações: '+grupos.length+agrupouLabel+'\n\n'+preview,btns:[{t:'Cancelar',v:'n',cls:'d'},{t:'Iniciar',v:'s',cls:'p'}]});
  if(conf!=='s')return;

  Object.assign(S,{running:true,stop:false,results:[],startTime:Date.now()});
  document.getElementById('sol-run').style.display='none';
  document.getElementById('sol-stop-section').classList.add('active');
  document.getElementById('sol-stop').style.display='flex';
  showWorkingSol(true);setProgSol(5);
  logSol('Iniciando '+grupos.length+' solicitações','info');

  for(let i=0;i<grupos.length;i++){
    if(S.stop)break;
    const grupo=grupos[i];
    setStSol('Solicitação '+(i+1)+'/'+grupos.length+' — Filial '+grupo.filial);
    setProgSol(5+Math.round(i/grupos.length*88));
    logSol('Filial '+grupo.filial+'...','info');
    try{
      const criada=await reqSol('POST','/v1/solicitations/branch',{origin:'',destiny:grupo.filialPad,receivingBranch:{code:'',complement:'',number:'',postalCode:'',publicPlace:''},observation:''});
      if(!criada||!criada.solicitationId)throw new Error('API não retornou solicitationId');
      const solId=criada.solicitationId;
      await reqSol('POST','/v1/solicitations/branch/'+solId+'/asset',{assets:grupo.assets});
      await reqSol('PATCH','/v1/solicitations/branch/'+solId,{observation:'',origin:origin,status:'CREATED'});
      S.results.push({filial:grupo.filial,assets:grupo.assets,solId,status:'ok'});
      logSol('OK Filial '+grupo.filial+' — Sol #'+solId,'ok');
    }catch(e){
      S.results.push({filial:grupo.filial,assets:grupo.assets,solId:null,status:'fail',motivo:e.message});
      logSol('ERRO Filial '+grupo.filial+': '+e.message,'err');
      const d=await modal({tipo:'err',titulo:'Erro — Filial '+grupo.filial,mensagem:e.message+'\n\nO que deseja fazer?',btns:[{t:'Parar',v:'stop',cls:'d'},{t:'Pular',v:'skip',cls:'s'},{t:'Tentar novamente',v:'retry',cls:'p'}]});
      if(d==='stop'){S.stop=true;break;}
      if(d==='retry'){i--;continue;}
    }
    await sleep(600);
  }

  S.running=false;
  document.getElementById('sol-run').style.display='';
  document.getElementById('sol-stop-section').classList.remove('active');
  document.getElementById('sol-stop').style.display='none';
  showWorkingSol(false);
  setProgSol(100);setTimeout(()=>setProgSol(null),600);
  setStSol(S.stop?'Interrompido.':'Concluído! 🎉',false);

  const oks=S.results.filter(r=>r.status==='ok');
  const fails=S.results.filter(r=>r.status==='fail');
  const gemcoLabel=modoPorFilial?'(por filial)':gemcoUnico;
  const v=await modalFinal(oks,fails,gemcoLabel,origin);
  if(v==='copy'){
    const lines=['SOLICITAÇÕES — '+new Date().toLocaleString('pt-BR'),'Gemco: '+gemcoLabel+' | Origem: CD'+norm(origin),'Total: '+S.results.length+' | OK: '+oks.length+' | Falhas: '+fails.length,''];
    S.results.forEach(r=>{
      const itens=r.assets.map(a=>a.itemCode+' x'+a.amount).join(', ');
      lines.push(r.status==='ok'?'OK Filial '+r.filial+' ['+itens+'] Sol#'+r.solId:'ERRO Filial '+r.filial+' ['+itens+'] '+r.motivo);
    });
    navigator.clipboard.writeText(lines.join('\n'));
  }
}


// ═══════════════════════════════════════════════════════════════
//  MODULE: AUTO EXPEDIÇÃO (__aa__)
// ═══════════════════════════════════════════════════════════════

// ─── EXP Helpers + State ─────────────────────────────────────
// ═══ HELPERS ══════════════════════════════════════════
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=c=>(c||'').toString().replace(/\D/g,'').replace(/^0+/,'');
const pad=(c,n=4)=>String(c).padStart(n,'0');

// ═══ PARSE FILIAIS ════════════════════════════════════
function parseFilaisExp(text){
  return text.split('\n').map(l=>l.trim()).filter(Boolean).flatMap(line=>{
    let filial,prod,qtd=1;
    if(line.includes(',')){const[a,b,c]=line.split(',').map(s=>s.trim());filial=a;prod=b||'TC500';qtd=parseInt(c)||1;}
    else if(/\sx\s*\d+/i.test(line)){const m=line.match(/^(\d+)\s*-\s*(.+?)\s*x\s*(\d+)/i);if(m){filial=m[1];prod=m[2].trim();qtd=parseInt(m[3])||1;}}
    else if(line.split('-').length===3){const[a,b,c]=line.split('-').map(s=>s.trim());filial=a;prod=b;qtd=parseInt(c)||1;}
    else if(line.includes('-')){const[a,b]=line.split('-').map(s=>s.trim());filial=a;prod=b||'TC500';}
    else if(/^\d+$/.test(line)){filial=line;prod='TC500';}
    if(!filial)return[];
    return[{filial:norm(filial),filialPad:pad(filial),prod:(prod||'TC500').toUpperCase().trim(),qtd}];
  });
}

// ═══ CONFIG & STATE ═══════════════════════════════════
const C={API:'https://gestao-ativos-api.magazineluiza.com.br',OC:'0038',OID:'0038',RET:3,RD:1200};
const S={running:false,stop:false,jobs:[],results:{},sentItems:[],sepFiliais:[],jobsOk:[],sepAssets:[],
  cargaId:null,cargaOk:false,freight:null,depDate:null,
  confOk:0,confErr:0,confFilOk:[],confFilErr:[],tracks:{},
  nfeOk:false,nfeSucess:[],nfeFail:[],startTime:null,modo:null};
function setRes(f,p,status,motivo='',qtd=0){S.results[norm(f)+'::'+p.toUpperCase().trim()]={f:norm(f),p:p.toUpperCase().trim(),status,motivo,qtd};}

// ─── EXP API ─────────────────────────────────────────────────
// ═══ API ══════════════════════════════════════════════
async function _refresh401Exp(){
  logExp('Token expirou (401) — renovando...','warn');
  const ok=await _renovarTokenSilencioso();
  if(ok)return;
  if(!document.querySelector('.aa-ov')){
    const v=await modal({tipo:'warn',icone:'🔑',titulo:'Token expirado',mensagem:'Não foi possível renovar automaticamente.\nClique em qualquer menu do site e depois clique em Pronto.',btns:[{t:'Pronto',v:'ok',cls:'p'},{t:'Cancelar',v:'cancel',cls:'d'}]});
    if(v==='cancel')throw new Error('Processo cancelado: token expirado');
    syncTok();
  }
}
async function reqExp(method,ep,body=null,retry=0){
  await ensureToken();
  const auth=getTok();
  if(!auth)throw new Error('Token não capturado — faça qualquer ação no site.');
  const res=await fetch(C.API+ep,{method,headers:{'Content-Type':'application/json','Authorization':auth},body:body?JSON.stringify(body):null});
  if(res.status>=200&&res.status<300){const t=await res.text();return t?JSON.parse(t):{};}
  if(res.status===404)return null;
  if(res.status===401&&retry<C.RET){await _refresh401Exp();return reqExp(method,ep,body,retry+1);}
  const e=await res.text().catch(()=>'');throw new Error(`HTTP ${res.status}: ${e.slice(0,120)}`);
}
const yr=()=>new Date().getFullYear();
const A={
  sols:bc=>reqExp('GET',`/v1/expedition/solicitations?offset=1&limit=1000&branchCode=${bc}&status=CREATED,CREATING,IN_SEPARATION,PARTIAL_SHIPPING,PENDING&startDate=${yr()}-01-01&endDate=${yr()}-12-31&originCode=${C.OC}`),
  solDet:id=>reqExp('GET',`/v1/solicitations/solicitation-detail/${id}`),
  envSep:(sid,ic,q)=>reqExp('POST','/v1/separation',{solicitationBranchAssetId:sid,itemCode:ic,qntdSolicitation:q}),
  sepAsset:(aid,bd)=>reqExp('POST','/v1/separation/asset',{assetId:String(aid),branchDestinyId:Number(bd),branchOriginId:String(C.OC),qtd:0}),
  listSep:()=>reqExp('GET',`/v1/expedition/separateds/items?originId=${C.OID}`),
  detSep:(ids,ic)=>reqExp('GET',`/v1/expedition/separateds/assets?solicitationsBranchAssetIds=${Array.isArray(ids)?ids.join(','):ids}&itemCode=${ic}`),
  criarCarga:(bid,assets)=>reqExp('POST','/v1/expedition/load',{branchId:bid,loadAsset:assets}),
  addCarga:(lid,bid,assets)=>reqExp('PUT',`/v1/expedition/load/${lid}`,{branchId:bid,loadAsset:assets}),
  listarCargas:()=>reqExp('GET',`/v1/expedition/loads?offset=1&limit=20&status=PENDING,CREATED,HAS_NF,NF_ERROR&startDate=${yr()}-01-01&endDate=${yr()}-12-31&originCode=${C.OC}`),
  enviarCarga:(id,tp,dt)=>reqExp('PUT',`/v1/expedition/load/address/${id}`,{departureDate:dt,freightType:tp}),
  filsCarga:id=>reqExp('GET',`/v1/expedition/load/${id}/conference/branches`),
  itensBranch:(lid,bid)=>reqExp('GET',`/v1/expedition/load/${lid}/conference/branch/${bid}/items?originId=${C.OID}`),
  conferir:(lid,aid,tr)=>reqExp('PUT','/v1/expedition/load/conference',{loadId:lid,assetId:aid,trackingNumber:tr||''}),
  nfe:(lid,did)=>reqExp('POST','/v1/expedition/load/invoice',{loadId:lid,destinyId:did,originId:C.OID}),
  detCarga:id=>reqExp('GET',`/v1/expedition/load/${id}`),
};

// ─── EXP uiToken ─────────────────────────────────────────────
function uiTokenExp(){
  const el=document.getElementById('exp-tok');
  const tx=document.getElementById('exp-tok-txt');
  const fill=document.getElementById('exp-tok-fill');
  if(!el||!tx)return;
  if(!getTok()){
    el.className='sol-tok-bar w';
    tx.textContent='Aguardando token...';
    if(fill){fill.style.transition='none';fill.style.width='0%';}
    return;
  }
  if(_tokenSessaoExpirou){
    el.className='sol-tok-bar ex';
    tx.textContent='Sessão expirou — clique em qualquer menu';
    if(fill){fill.style.transition='none';fill.style.width='0%';}
    return;
  }
  const s=tokSecs();
  const maxSec=300;
  const pct=s!==null?Math.min(100,Math.max(0,(s/maxSec)*100)):100;
  if(s!==null&&s<=60){
    el.className='sol-tok-bar ex';
    tx.textContent=s<=0?'Renovando...':s+'s restantes';
    if(fill){fill.style.transition='width 1s linear';fill.style.width=pct+'%';}
  }else if(s!==null&&s<=180){
    el.className='sol-tok-bar w';
    tx.textContent=Math.ceil(s/60)+'min restantes';
    if(fill){fill.style.transition='width 5s linear';fill.style.width=pct+'%';}
  }else{
    el.className='sol-tok-bar ok';
    tx.textContent=(s!==null?Math.ceil(s/60):5)+'min · Token ativo';
    if(fill){fill.style.transition='width 5s linear';fill.style.width=pct+'%';}
  }
}

// ─── EXP buildPanel ──────────────────────────────────────────
// ═══ PAINEL ═══════════════════════════════════════════
function buildPanel_exp(){
  if(document.getElementById('__aa__'))return;
  if(!document.body)return setTimeout(buildPanel,10);

  // Toast
  const toast=document.createElement('div');
  toast.id='exp-welcome-toast';toast.className='sol-welcome-toast';
  toast.innerHTML=
    '<div class="sol-toast-greeting">Bem-vindo de volta,</div>'+
    '<div class="sol-toast-name" id="sol-toast-name">'+(_userName||'...')+'</div>'+
    '<div class="sol-toast-brand">Auto Ativos · Magalu</div>'+
    '<div class="sol-toast-logo">'+magaluBrandBlock('lg')+'</div>';
  document.body.appendChild(toast);
  if(_userName){
    toast.dataset.shown='1';
    document.getElementById('exp-toast-name').textContent=_userName;
    requestAnimationFrame(()=>{
      toast.classList.add('show');
      setTimeout(()=>toast.classList.add('hide'),3200);
      setTimeout(()=>toast.remove(),3800);
    });
  }

  const root=document.createElement('div');
  root.id='__aa__';
  root.innerHTML=
    '<div class="sol-header" id="sol-drag-handle">'+
      '<div class="sol-header-left">'+
        '<div class="sol-spinner-wrap">'+
          '<div class="sol-spinner">'+
            '<span></span><span></span><span></span><span></span>'+
            '<span></span><span></span><span></span><span></span>'+
          '</div>'+
        '</div>'+
        '<div class="sol-header-info">'+
          '<div class="sol-header-title">Auto Ativos</div>'+
          '<div class="sol-header-sub">created by joao.gmarques</div>'+
        '</div>'+
      '</div>'+
      '<div class="sol-header-btns">'+
        '<button class="sol-hbtn" id="sol-min" title="Minimizar"></button>'+
        '<button class="sol-hbtn close-btn" id="sol-close" title="Fechar">✕</button>'+
      '</div>'+
    '</div>'+

    '<div class="sol-welcome-inline">'+
      '<div class="sol-welcome-av" id="sol-welcome-av">?</div>'+
      '<div>'+
        '<div class="sol-welcome-txt">Olá, <span class="sol-welcome-name" id="sol-welcome-name">usuário</span></div>'+
        '<div class="sol-welcome-sub">Automação de ativos ativa</div>'+
      '</div>'+
    '</div>'+

    '<div class="sol-tok-bar w" id="exp-tok">'+
      '<div class="sol-tok-dot"></div>'+
      '<span class="sol-tok-label" id="aa-tok-txt">Aguardando token...</span>'+
      '<div class="sol-tok-track"><div class="sol-tok-fill" id="sol-tok-fill" style="width:0%"></div></div>'+
    '</div>'+

    '<div class="sol-body">'+

      // MODO DE EXECUÇÃO — no topo, igual ao content_ui
      '<div class="sol-card">'+
        '<div class="sol-card-label">Modo de Execução</div>'+
        '<div class="sol-modo-selector">'+
          '<label class="sol-modo-radio">'+
            '<input type="radio" name="aa-mode" id="aa-mode-full" value="full" checked/>'+
            '<span class="sol-modo-name">Completo</span>'+
          '</label>'+
          '<label class="sol-modo-radio">'+
            '<input type="radio" name="aa-mode" id="aa-mode-sep" value="sep"/>'+
            '<span class="sol-modo-name">Separação</span>'+
          '</label>'+
          '<label class="sol-modo-radio">'+
            '<input type="radio" name="aa-mode" id="aa-mode-carga" value="carga"/>'+
            '<span class="sol-modo-name">Carga</span>'+
          '</label>'+
        '</div>'+
        '<div class="sol-modo-desc" id="aa-modo-desc">'+
          'Executa o fluxo <strong>completo</strong>: solicitação → separação → carga → conferência → NF-e → e-mails.'+
          '<br><span class="sol-gemco-example">Recomendado para início do processo</span>'+
        '</div>'+
      '</div>'+

      // FILIAIS
      '<div class="sol-card">'+
        '<div class="sol-card-label">Filiais e Produtos</div>'+
        '<textarea class="sol-ta" id="aa-ta" rows="5" placeholder="790&#10;1321 - TC500 x2&#10;452 - Cadeira - 3&#10;500,microcomputador,1"></textarea>'+
      '</div>'+

      // TYPEWRITER
      '<div class="sol-typewriter-wrap" id="sol-typewriter">'+
        '<div class="sol-typewriter">'+
          '<div class="tw-slide"><i></i></div>'+
          '<div class="tw-paper"></div>'+
          '<div class="tw-keyboard"></div>'+
        '</div>'+
        '<div class="sol-tw-spinner">Processando'+
          '<div class="sol-tw-spinner-track">'+
            '<span class="sol-tw-word">solicitação...</span>'+
            '<span class="sol-tw-word">separação...</span>'+
            '<span class="sol-tw-word">carga...</span>'+
            '<span class="sol-tw-word">conferência...</span>'+
            '<span class="sol-tw-word">NF-e...</span>'+
          '</div>'+
        '</div>'+
      '</div>'+

      // INICIAR
      '<button class="sol-btn-run-wrap" id="aa-run">'+
        '<div class="sol-btn-run-inner">INICIAR PROCESSO'+
          '<svg class="sol-btn-run-svg" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none">'+
            '<path d="M11.6801 14.62L14.2401 12.06L11.6801 9.5" stroke="white" stroke-width="2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>'+
            '<path d="M4 12.0601H14.17" stroke="white" stroke-width="2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>'+
            '<path d="M12 4C16.42 4 20 7 20 12C20 17 16.42 20 12 20" stroke="white" stroke-width="2" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>'+
          '</svg>'+
        '</div>'+
      '</button>'+

      // PARAR
      '<div class="sol-stop-section" id="sol-stop-section">'+
        '<div class="sol-btn-stop-wrap" id="aa-stop" style="display:flex">'+
          '<span class="sol-stop-text">Parar Processo</span>'+
          '<span class="sol-stop-icon">'+
            '<svg class="sol-stop-svg" height="512" viewBox="0 0 512 512" width="512" xmlns="http://www.w3.org/2000/svg">'+
              '<path d="M112,112l20,320c.95,18.49,14.4,32,32,32H348c17.67,0,30.87-13.51,32-32l20-320" style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"/>'+
              '<line style="stroke:#fff;stroke-linecap:round;stroke-miterlimit:10;stroke-width:32px" x1="80" x2="432" y1="112" y2="112"/>'+
              '<path d="M192,112V72h0a23.93,23.93,0,0,1,24-24h80a23.93,23.93,0,0,1,24,24h0v40" style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px"/>'+
              '<line style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px" x1="256" x2="256" y1="176" y2="400"/>'+
              '<line style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px" x1="184" x2="192" y1="176" y2="400"/>'+
              '<line style="fill:none;stroke:#fff;stroke-linecap:round;stroke-linejoin:round;stroke-width:32px" x1="328" x2="320" y1="176" y2="400"/>'+
            '</svg>'+
          '</span>'+
        '</div>'+
      '</div>'+

      // E-MAILS (único botão secundário mantido)
      '<button class="sol-btn-email" id="aa-email">📧 Enviar e-mails p/ carga</button>'+

      // STATUS + PROGRESS
      '<div class="sol-divider"></div>'+
      '<div class="sol-status" id="aa-st">Pronto para iniciar.</div>'+
      '<div class="sol-progress-wrap" id="aa-pw"><div class="sol-progress-bar" id="aa-pb"></div></div>'+

    '</div>'+

    '<div class="sol-log-section">'+
      '<div class="sol-log-header" id="aa-lh">'+
        '<span class="sol-log-title">Logs <span class="sol-log-count" id="aa-lc">0</span></span>'+
        '<button class="sol-log-clear" id="aa-lclr">limpar</button>'+
      '</div>'+
      '<div class="sol-log-body" id="aa-lb"><div class="sol-log-entry info">Aguardando...</div></div>'+
    '</div>';

  document.body.appendChild(root);

  const tab=document.createElement('button');
  tab.id='__aa_tab__';tab.innerHTML='📦';
  document.body.appendChild(tab);

  // DRAG
  let isDragging=false,dragOffX=0,dragOffY=0;
  const handle=document.getElementById('sol-drag-handle');
  handle.addEventListener('mousedown',e=>{
    if(e.target.closest('.sol-hbtn'))return;
    isDragging=true;
    const r=root.getBoundingClientRect();
    dragOffX=e.clientX-r.left;dragOffY=e.clientY-r.top;
    document.body.style.userSelect='none';
  });
  document.addEventListener('mousemove',e=>{
    if(!isDragging)return;
    let x=e.clientX-dragOffX,y=e.clientY-dragOffY;
    x=Math.max(0,Math.min(x,window.innerWidth-root.offsetWidth));
    y=Math.max(0,Math.min(y,window.innerHeight-60));
    root.style.left=x+'px';root.style.top=y+'px';root.style.right='auto';
  });
  document.addEventListener('mouseup',()=>{if(isDragging){isDragging=false;document.body.style.userSelect='';}});

  // CLOSE
  document.getElementById('sol-close').onclick=e=>{
    e.stopPropagation();
    root.classList.add('off');
    tab.style.display='flex';
    tab.classList.remove('popping');
    void tab.offsetWidth;
    tab.classList.add('popping');
    setTimeout(()=>tab.classList.remove('popping'),1200);
  };
  tab.onclick=()=>{root.classList.remove('off');tab.style.display='none';};

  // MINIMIZE
  const minBtn=document.getElementById('sol-min');
  minBtn.setAttribute('data-state','open');
  let mini=false;
  minBtn.onclick=e=>{
    e.stopPropagation();mini=!mini;
    root.classList.toggle('minimized',mini);
    minBtn.setAttribute('data-state',mini?'closed':'open');
    minBtn.title=mini?'Restaurar':'Minimizar';
  };

  // MODO — descrições por modo
  const modoDescs={
    full:'Executa o fluxo <strong>completo</strong>: solicitação → separação → carga → conferência → NF-e → e-mails.<br><span class="sol-gemco-example">Recomendado para início do processo</span>',
    sep:'Inicia a partir da <strong>separação</strong>, pulando solicitação.<br><span class="sol-gemco-example">Use quando a solicitação já foi feita</span>',
    carga:'Inicia a partir da <strong>carga</strong>, pulando solicitação e separação.<br><span class="sol-gemco-example">Use quando separação já foi concluída</span>'
  };
  document.querySelectorAll('input[name="aa-mode"]').forEach(r=>{
    r.addEventListener('change',()=>{
      const desc=document.getElementById('aa-modo-desc');
      if(desc)desc.innerHTML=modoDescs[r.value]||'';
    });
  });

  document.getElementById('aa-run').onclick=start;
  document.getElementById('aa-stop').onclick=()=>{S.stop=true;setStExp('Parada solicitada...');logExp('Interrompido pelo usuário.','warn');};
  document.getElementById('aa-email').addEventListener('click',testarEmails);

  let logOpen=true;
  document.getElementById('aa-lh').onclick=()=>{logOpen=!logOpen;document.getElementById('aa-lb').style.display=logOpen?'':'none';};
  document.getElementById('aa-lclr').onclick=e=>{e.stopPropagation();document.getElementById('aa-lb').innerHTML='';_lc=0;document.getElementById('aa-lc').textContent='0';};

  if(_userName)updateWelcome();
  uiTokenExp();
  setInterval(uiTokenExp,5000);
}

// ─── EXP UI helpers + modals ─────────────────────────────────
function showWorkingExp(show){
  const tw=document.getElementById('sol-typewriter');
  if(tw)tw.classList.toggle('active',show);
}
function getMode(){
  const r=document.querySelector('input[name="aa-mode"]:checked');
  return r?r.value:'full';
}

// ═══ UI HELPERS ════════════════════════════════════════
function setStExp(t,on=true){
  const el=document.getElementById('aa-st');
  if(!el)return;el.textContent=t;el.className='sol-status'+(on?' on':'');
}
function setProgExp(p){
  const w=document.getElementById('aa-pw'),b=document.getElementById('aa-pb');
  if(!w||!b)return;
  if(p===null){w.classList.remove('on');return;}
  w.classList.add('on');b.style.width=p+'%';
}
let _lc=0;
function logExp(msg,type='info'){
  const lb=document.getElementById('aa-lb');if(!lb)return;
  _lc++;
  const lc=document.getElementById('aa-lc');if(lc)lc.textContent=_lc;
  const t=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const d=document.createElement('div');d.className='sol-log-entry '+type;
  d.textContent=t+'  '+msg;lb.appendChild(d);lb.scrollTop=lb.scrollHeight;
  if(lb.children.length>200)lb.removeChild(lb.children[0]);
}

// ═══ MODAIS ════════════════════════════════════════════


// ─── EXP Logic (start, steps, NF-e, emails, final) ───────────
// ═══ MODAL RESUMO SOLICITAÇÃO ══════════════════════════
async function modalResumoSolicitacao(){
  const results=Object.values(S.results);
  const oks=results.filter(r=>r.status==='ok');
  const fails=results.filter(r=>r.status==='fail');
  let tabHTML='<table class="aa-rtable"><thead><tr><th>Filial</th><th>Produto</th><th>Qtd</th><th>Status</th></tr></thead><tbody>';
  for(const r of[...oks,...fails]){
    const tag=r.status==='ok'?'<span class="tag-ok">✓ OK</span>':'<span class="tag-fail">✗ Falhou</span>';
    tabHTML+='<tr class="'+(r.status==='ok'?'ok':'fail')+'"><td><strong>'+r.f+'</strong></td><td style="font-family:var(--mg-mono);font-size:10.5px">'+r.p+'</td><td style="font-family:var(--mg-mono)">'+( r.status==='ok'?'×'+r.qtd:'—')+'</td><td>'+tag+'</td></tr>';
    if(r.status==='fail')tabHTML+='<tr class="fail"><td colspan="4" style="font-size:9px;color:var(--mg-red);padding:2px 8px 5px">↳ '+r.motivo+'</td></tr>';
  }
  tabHTML+='</tbody></table>';
  const tip=fails.length>0
    ?'<div class="aa-res-tip">⚠️ Filiais com erro: <strong style="color:var(--mg-orange)">'+fails.map(f=>f.f).join(', ')+'</strong></div>'
    :'<div class="aa-res-tip" style="color:var(--mg-green)">✓ Todas as filiais foram solicitadas com sucesso!</div>';
  return await modal({
    icone:oks.length>0&&fails.length===0?'🎯':'📋',
    titulo:'Resultado das Solicitações',
    tipo:fails.length>0?'warn':'ok',
    wide:'aa-res-modal',
    html:'<div class="aa-res-sum">'+
      '<div class="aa-res-cell"><div class="aa-res-val" style="color:var(--mg-blue)">'+results.length+'</div><div class="aa-res-lbl">Total</div></div>'+
      '<div class="aa-res-cell"><div class="aa-res-val" style="color:var(--mg-green)">'+oks.length+'</div><div class="aa-res-lbl">OK</div></div>'+
      '<div class="aa-res-cell"><div class="aa-res-val" style="color:'+(fails.length?'var(--mg-red)':'var(--mg-green)')+'">'+fails.length+'</div><div class="aa-res-lbl">Falhas</div></div>'+
      '</div>'+tip+
      '<div style="max-height:200px;overflow-y:auto;border:1px solid var(--mg-b1);border-radius:8px;margin-bottom:12px;">'+tabHTML+'</div>',
    btns:[{t:'🛑 Parar aqui',v:'stop',cls:'d'},{t:'⚡ Continuar separação',v:'go',cls:'p'}]
  });
}

// ═══ PROCESS — START ══════════════════════════════════
async function startExp(){
  const raw=document.getElementById('aa-ta')?.value||'';
  const jobs=parseFilaisExp(raw);
  const mode=getMode();
  if(!getTok()){
    await modal({tipo:'err',icone:'🔐',titulo:'Token não capturado',mensagem:'Faça qualquer ação no site (clique em Recebimento, Expedição, etc.) para o token ser capturado.',btns:[{t:'Entendido',v:'ok',cls:'p'}]});
    return;
  }
  if(!jobs.length){
    await modal({tipo:'err',icone:'📝',titulo:'Nenhuma filial',mensagem:'Informe ao menos uma filial no campo acima.',btns:[{t:'Ok',v:'ok',cls:'p'}]});
    return;
  }
  const mLabel={full:'COMPLETO',sep:'SEPARAÇÃO',carga:'CARGA'};
  Object.assign(S,{running:true,stop:false,jobs,results:{},sentItems:[],sepFiliais:[],jobsOk:[],sepAssets:[],
    cargaId:null,cargaOk:false,freight:null,depDate:null,
    confOk:0,confErr:0,confFilOk:[],confFilErr:[],tracks:{},
    nfeOk:false,nfeSucess:[],nfeFail:[],startTime:Date.now(),modo:mLabel[mode]||mode});
  for(const j of jobs)setRes(j.filial,j.prod,'pending','Em processamento');

  document.getElementById('aa-run').style.display='none';
  document.getElementById('sol-stop-section').classList.add('active');
  showWorkingExp(true);
  setProgExp(5);
  logExp(`Modo ${mLabel[mode]} · ${jobs.length} job(s)`,'info');

  try{
    if(mode==='full'){
      setStExp('Etapa 1 — Solicitações');setProgExp(10);
      await stepSolicitacao();
      if(!S.stop){
        const oks=Object.values(S.results).filter(r=>r.status==='ok');
        if(oks.length>0){
          const dec=await modalResumoSolicitacao();
          if(dec==='stop'||dec===null){S.stop=true;}
        }else{
          await modal({tipo:'err',icone:'😔',titulo:'Nenhuma solicitação processada',mensagem:'Nenhuma filial teve itens enviados para separação.\n\nVerifique os dados e tente novamente.',btns:[{t:'Ok',v:'ok',cls:'p'}]});
          S.stop=true;
        }
      }
      if(!S.stop&&S.jobsOk.length){setStExp('Etapa 2 — Separação');setProgExp(28);await stepSeparacao();if(!S.stop)await stepBuscarSep();}
      if(!S.stop&&S.sepAssets.length){setStExp('Etapa 3 — Carga');setProgExp(50);await stepCarga();}
      if(!S.stop&&S.cargaId&&S.cargaOk){setStExp('Etapa 4 — Conferência');setProgExp(68);await stepConferencia();}
    }else if(mode==='sep'){
      S.jobsOk=[...jobs];S.sepFiliais=[...new Set(jobs.map(j=>j.filial))];
      await stepSeparacao();if(!S.stop)await stepBuscarSep();
      if(!S.stop&&S.sepAssets.length)await stepCarga();
      if(!S.stop&&S.cargaId&&S.cargaOk)await stepConferencia();
    }else if(mode==='carga'){
      S.sepFiliais=[...new Set(jobs.map(j=>j.filial))];
      await stepBuscarSep();
      if(!S.stop&&S.sepAssets.length)await stepCarga();
      if(!S.stop&&S.cargaId&&S.cargaOk)await stepConferencia();
    }
  }catch(e){
    logExp(`Erro fatal: ${e.message}`,'err');
    setStExp(`Erro: ${e.message}`,true);
  }finally{
    if(S.cargaId&&!S.stop){
      try{
        const fils=[...new Set([...S.confFilOk,...S.confFilErr,...S.sepFiliais].map(f=>norm(f)).filter(Boolean))];
        if(fils.length){const ipf=await _fetchItensCarga(fils);await envEmails(fils,ipf);}
      }catch(e){logExp('Erro ao enviar e-mails finais: '+e.message,'err');}
    }
  }

  showWorkingExp(false);
  S.running=false;
  document.getElementById('aa-run').style.display='';
  document.getElementById('sol-stop-section').classList.remove('active');
  setProgExp(100);setTimeout(()=>setProgExp(null),600);
  setStExp(S.stop?'Interrompido.':'Processo finalizado ✓',false);
  if(!S.stop)logExp('Finalizado.','ok');
  await finalModal();
}
async function stepSolicitacao(){
  logExp('── SOLICITAÇÕES ──','info');
  for(let i=0;i<S.jobs.length;i++){
    if(S.stop)break;
    const job=S.jobs[i];
    const pu=job.prod.toUpperCase();
    setStExp(`Solicitação ${i+1}/${S.jobs.length} — Filial ${job.filial}`);
    logExp(`Buscando filial ${job.filial} · "${job.prod}"`,'info');
    try{
      const resp=await A.sols(job.filial);
      const sols=Array.isArray(resp)?resp:(resp?.records||resp?.content||[]);
      if(!sols.length){setRes(job.filial,job.prod,'fail','Nenhuma solicitação encontrada para esta filial');logExp(`Filial ${job.filial}: sem solicitações.`,'warn');continue;}
      let total=0,found=false;
      for(const sol of sols){
        if(S.stop)break;
        const solId=sol.id||sol.solicitationId;if(!solId)continue;
        const det=await A.solDet(solId);if(!det)continue;
        const assets=det.solicitationAssets?.pending?.assets||det.assets?.filter(a=>a.status==='PENDING')||det.solicitationBranchAssets?.filter(a=>a.status==='PENDING')||[];
        for(const asset of assets){
          const rn=[asset.itemName,asset.name,asset.description,asset.productDescription,asset.assetName].find(v=>typeof v==='string'&&v.trim());
          const iname=(rn||'').toUpperCase();
          const icode=asset.itemCode||asset.code||asset.sku||asset.productCode;
          const sbaid=asset.solicitationBranchAssetId||asset.id;
          const qtd=asset.pending||asset.amount||asset.quantity||1;
          if(!iname.includes(pu))continue;
          found=true;
          try{
            await A.envSep(sbaid,icode,qtd);total+=qtd;
            S.sentItems.push({filial:job.filial,product:iname,quantidade:qtd,solicitationBranchAssetId:sbaid,itemCode:icode});
            logExp(`✓ Filial ${job.filial}: "${iname}" ×${qtd}`,'ok');
          }catch(e){logExp(`Erro asset ${sbaid}: ${e.message}`,'err');}
          await sleep(300);
        }
      }
      if(total>0){
        S.jobsOk.push(job);if(!S.sepFiliais.includes(job.filial))S.sepFiliais.push(job.filial);
        setRes(job.filial,job.prod,'ok',`${total} item(s) enviados`,total);
        logExp(`✓ Filial ${job.filial}: ${total} item(s) ok.`,'ok');
      }else if(!found){
        setRes(job.filial,job.prod,'fail',`"${job.prod}" não encontrado nas solicitações pendentes`);
        logExp(`Filial ${job.filial}: "${job.prod}" não encontrado.`,'warn');
      }else{
        setRes(job.filial,job.prod,'fail','Produto encontrado mas falhou ao enviar');
        logExp(`Filial ${job.filial}: erro ao enviar.`,'err');
      }
    }catch(e){
      setRes(job.filial,job.prod,'fail',`Erro de API: ${e.message}`);
      logExp(`Erro filial ${job.filial}: ${e.message}`,'err');
      const d=await modal({tipo:'err',titulo:'Erro na Solicitação',mensagem:`Filial ${job.filial} falhou.`,det:e.message,btns:[{t:'🛑 Parar',v:'stop',cls:'d'},{t:'⏭ Pular',v:'skip',cls:'p'}]});
      if(d==='stop'){S.stop=true;break;}
    }
    await sleep(500);
  }
}

async function stepSeparacao(){
  logExp('── SEPARAÇÃO ──','info');
  const plan={};
  for(const d of S.sentItems){
    const fn=norm(d.filial),ic=(d.itemCode||'').toString().trim(),qtd=Number(d.quantidade||1);
    if(!fn||!ic||!qtd)continue;
    plan[fn]=plan[fn]||{};
    if(!plan[fn][ic])plan[fn][ic]={ic,desc:d.product||`Item ${ic}`,qtd:0};
    plan[fn][ic].qtd+=qtd;
  }
  const flist=(S.sepFiliais.length?S.sepFiliais:Object.keys(plan)).map(f=>norm(f)).filter(Boolean);
  for(let i=0;i<flist.length;i++){
    if(S.stop)break;
    const fn=flist[i];const fp=plan[fn];
    if(!fp||!Object.keys(fp).length){logExp(`Filial ${fn}: sem plano.`,'warn');continue;}
    setStExp(`Separação ${i+1}/${flist.length} — Filial ${fn}`);
    logExp(`Bipagem — Filial ${fn}`,'warn');
    const used=new Set();
    for(const item of Object.values(fp)){
      if(S.stop)break;
      const{ic,desc,qtd:total}=item;if(!total)continue;
      logExp(`Filial ${fn}: "${desc}" → bipar ${total}`,'info');
      let bip=0;
      while(bip<total&&!S.stop){
        const inp=await prompt2({icone:'🔍',titulo:`Bipagem — Filial ${fn}`,mensagem:`${desc}\nItemCode: ${ic}\n\nProgresso: ${bip}/${total}\n\nBipe ou cole o assetId:`,ph:'assetId...'});
        if(inp===null){
          const d=await modal({tipo:'err',titulo:'Bipagem cancelada',mensagem:'O que deseja fazer?',btns:[{t:'🛑 Abortar',v:'abort',cls:'d'},{t:'🔄 Continuar',v:'retry',cls:'p'}]});
          if(d==='abort')throw new Error(`Separação cancelada filial ${fn}`);
          continue;
        }
        const ids=String(inp).split(/[\s,;]+/).map(x=>norm(x)).filter(Boolean);
        for(const aid of ids){
          if(bip>=total)break;
          if(used.has(aid)){logExp(`Ativo ${aid} já bipado.`,'warn');continue;}
          try{
            await A.sepAsset(aid,fn);used.add(aid);bip++;
            logExp(`✓ Ativo ${aid} (${bip}/${total})`,'ok');
          }catch(e){
            logExp(`Erro bipar ${aid}: ${e.message}`,'err');
            const d=await modal({tipo:'err',titulo:'Erro ao bipar',mensagem:`Ativo ${aid} falhou.`,det:e.message,btns:[{t:'🛑 Parar',v:'stop',cls:'d'},{t:'⏭ Pular',v:'skip'},{t:'🔄 Tentar',v:'retry',cls:'p'}]});
            if(d==='stop'){S.stop=true;throw new Error('Interrompido');}
            if(d==='skip')bip++;
          }
          await sleep(150);
        }
      }
    }
  }
  logExp('Separação concluída.','ok');
}

async function stepBuscarSep(){
  logExp('── BUSCANDO SEPARADOS ──','info');
  setStExp('Buscando ativos separados...');
  const sep=await A.listSep();
  if(!sep?.length){logExp('Nenhum ativo separado.','warn');return;}
  for(const g of sep){
    for(const b of(g.solicitationsBranch||[])){
      const bid=b.branchId,fn=norm(bid);
      const match=!S.sepFiliais.length||S.sepFiliais.some(f=>norm(f)===fn);
      if(!match)continue;
      const ids=(b.solicitationsAssets||[]).map(sa=>sa.id);
      for(const item of(b.items||[])){
        const{itemCode:ic,description:desc}=item;
        if(!ic||!ids.length)continue;
        try{
          const dets=await A.detSep(ids,ic);
          if(dets?.length)for(const a of dets){const id=a.separatedAssetId||a.id;if(id)S.sepAssets.push({separatedAssetId:id,branchId:bid,itemCode:ic,description:desc});}
          logExp(`Filial ${bid}: ${dets?.length||0} "${desc}" prontos.`,'info');
        }catch(e){logExp(`Erro item ${ic}: ${e.message}`,'err');}
        await sleep(200);
      }
    }
  }
  logExp(`Total: ${S.sepAssets.length} ativo(s).`,'ok');
}

async function stepCarga(){
  logExp('── CARGA ──','info');
  if(!S.sepAssets.length)throw new Error('Nenhum ativo para a carga');
  const la=S.sepAssets.map(a=>({separatedAssetId:a.separatedAssetId}));
  const op=await modal({icone:'🚚',titulo:'Opção de Carga',mensagem:`${la.length} ativo(s) prontos.\n\nComo deseja prosseguir?`,btns:[{t:'➕ Nova Carga',v:'new',cls:'p'},{t:'📋 Carga Existente',v:'ex'}]});
  if(!op)return;
  try{
    if(op==='ex')await addCargaEx(la);
    else await novaCarga(la);
  }catch(e){
    logExp(`Erro carga: ${e.message}`,'err');
    const id=await prompt2({icone:'⚠️',titulo:'Erro na API',mensagem:'Digite o ID da carga manualmente:',ph:'ID...'});
    if(id&&!isNaN(parseInt(id))){S.cargaId=parseInt(id);logExp(`Carga ${id} manual.`,'warn');}
    else throw e;
  }
}

async function addCargaEx(la){
  const r=await A.listarCargas();const cs=r?.records||(Array.isArray(r)?r:[]);
  if(!cs.length)return novaCarga(la);
  const idx=await listaModal({icone:'📋',titulo:'Selecionar Carga',itens:cs.map(c=>({t:`Carga #${c.id}`,s:`${c.freightType||'?'} · ${c.date?c.date.split('T')[0]:'?'}`,d:c.destinationsCode||''}))});
  if(idx===null)return;
  const cargaSel=cs[idx];
  S.cargaId=cargaSel.id;
  // Pega os dados da carga existente pra usar no e-mail
  S.freight=cargaSel.freightType||'DEDICATED';
  S.depDate=cargaSel.departureDate||cargaSel.date||'';
  await A.addCarga(S.cargaId,C.OC,la);
  logExp(`✓ ${la.length} ativo(s) → carga #${S.cargaId}`,'ok');
  const c=await modal({tipo:'ok',titulo:'Ativos adicionados!',mensagem:`Carga #${S.cargaId}\n${la.length} ativos.\n\nConferir agora?`,btns:[{t:'Não',v:'n'},{t:'Sim',v:'s',cls:'p'}]});
  S.cargaOk=c==='s';
}

async function novaCarga(la){
  const r=await A.criarCarga(C.OC,la);
  S.cargaId=r?.loadId||r?.id;if(!S.cargaId)throw new Error('API não retornou loadId');
  logExp(`✓ Carga #${S.cargaId} criada!`,'ok');
  // Tipo de frete — agora com ABA
  const tp=await prompt2({icone:'🚚',titulo:'Tipo de Frete',mensagem:'D = DEDICADO\nC = CORREIOS\nA = ABA',ph:'D, C ou A'});
  if(!tp){logExp('Carga criada, não enviada.','warn');return;}
  let ft='DEDICATED';
  const tpu=tp.trim().toUpperCase();
  if(tpu.startsWith('C'))ft='CORREIOS';
  else if(tpu.startsWith('A'))ft='ABA';
  else ft='DEDICATED';
  S.freight=ft;
  const agora=new Date();
  const dh=await prompt2({icone:'📅',titulo:'Data e Hora da Saída',mensagem:'Formato: YYYY-MM-DD HH:MM\n(em branco = amanhã 08:00)',ph:`${agora.toISOString().split('T')[0]} 08:00`});
  let dd;
  if(!dh){const t=new Date();t.setDate(t.getDate()+1);t.setHours(8,0,0,0);dd=t.toISOString().slice(0,19);}
  else{const pts=dh.trim().split(/[\s,]+/);dd=`${pts[0]}T${pts[1]||'08:00'}:00`;}
  S.depDate=dd;
  const freteLabel=ft==='CORREIOS'?'Correios':ft==='ABA'?'ABA':'Dedicado';
  const c=await modal({tipo:'info',icone:'📤',titulo:'Confirmar Envio',mensagem:`Carga: #${S.cargaId}\nTipo: ${freteLabel}\nSaída: ${dd.replace('T',' ')}\nAtivos: ${la.length}`,btns:[{t:'Cancelar',v:'n'},{t:'Enviar',v:'s',cls:'p'}]});
  if(c!=='s'){logExp('Envio cancelado.','warn');return;}
  await A.enviarCarga(S.cargaId,ft,dd);S.cargaOk=true;logExp(`✓ Carga #${S.cargaId} enviada!`,'ok');
}

async function stepConferencia(){
  logExp('── CONFERÊNCIA ──','info');
  const lid=S.cargaId;
  const ci=await A.filsCarga(lid);if(!ci){logExp('Sem info da carga.','err');return;}

  // Se ainda não temos freight/depDate (modo carga com carga existente), busca da API
  if(!S.freight||!S.depDate){
    try{
      const det=await A.detCarga(lid);
      if(det){
        S.freight=S.freight||det.freightType||'DEDICATED';
        S.depDate=S.depDate||det.departureDate||det.date||'';
      }
    }catch(e){logExp('Não foi possível buscar dados da carga: '+e.message,'warn');}
  }

  const isCorr=ci.freightType==='CORREIOS'||(S.freight==='CORREIOS');
  const fils=[];const _seen=new Set();
  for(const s of(ci.stockCd||[]))for(const b of(s.branches||[])){const id=b.number||b.branchId;if(id&&b.status==='PENDING'){const _n=String(id).replace(/\D/g,'').replace(/^0+/,'')||'0';if(!_seen.has(_n)){_seen.add(_n);fils.push({branchId:id});}}}
  const ord=S.jobs.map(j=>norm(j.filial));
  fils.sort((a,b)=>{const ia=ord.indexOf(norm(a.branchId)),ib=ord.indexOf(norm(b.branchId));return(ia<0?9999:ia)-(ib<0?9999:ib);});
  if(!fils.length){logExp('Sem filiais pendentes.','info');return;}
  logExp(`${fils.length} filial(is) para conferir.`,'info');
  if(isCorr){
    for(const f of fils){
      let tr=null;
      while(!tr){
        tr=await prompt2({icone:'📮',titulo:`Rastreio — Filial ${f.branchId}`,mensagem:`Código obrigatório para filial ${f.branchId}:`,ph:'AA123456789BR'});
        if(!tr){const d=await modal({tipo:'err',titulo:'Rastreio obrigatório',mensagem:'Sem rastreio não é possível continuar.',btns:[{t:'🛑 Abortar',v:'abort',cls:'d'},{t:'🔄 Tentar',v:'retry',cls:'p'}]});if(d==='abort')throw new Error('Conferência cancelada: sem rastreio');}
      }
      const _raw=String(f.branchId).replace(/\D/g,'');
      const _norm=_raw.replace(/^0+/,'');
      S.tracks[f.branchId]=tr;
      S.tracks[_raw]=tr;
      S.tracks[_norm]=tr;
      S.tracks[_norm.padStart(3,'0')]=tr;
      S.tracks[_norm.padStart(4,'0')]=tr;
      logExp(`Rastreio filial ${_norm}: ${tr}`,'ok');
    }
  }
  let tot=0,errs=0;
  for(let i=0;i<fils.length;i++){
    if(S.stop)break;
    const{branchId}=fils[i];
    setStExp(`Conferindo filial ${branchId} (${i+1}/${fils.length})...`);setProgExp(68+Math.round(i/fils.length*25));
    try{
      const its=await A.itensBranch(lid,branchId);if(!its?.length){logExp(`Filial ${branchId}: sem itens.`,'info');continue;}
      let c=0,e=0;
      for(const g of its)for(const item of(g.items||[]))for(const asset of(item.separatedAssets||[])){
        if(S.stop)break;const aid=asset.assetId;if(!aid)continue;
        let rt=0,ok=false;
        while(rt<C.RET&&!ok){try{await A.conferir(lid,aid,isCorr?(S.tracks[branchId]||''):'');c++;tot++;ok=true;}catch(e2){if(e2.message&&e2.message.includes('409')){logExp(`Ativo ${aid}: ja conferido (ok)`,'info');c++;tot++;ok=true;}else{rt++;if(rt>=C.RET){e++;errs++;logExp(`Erro ativo ${aid}: ${e2.message}`,'err');}else await sleep(C.RD);}}}
        await sleep(150);
      }
      e>0?S.confFilErr.push(branchId):S.confFilOk.push(branchId);
      logExp(`Filial ${branchId}: ${c} ok${e?` · ${e} erro(s)`:''}`,'ok');
    }catch(e){logExp(`Erro filial ${branchId}: ${e.message}`,'err');S.confFilErr.push(branchId);}
    await sleep(300);
  }
  S.confOk=tot;S.confErr=errs;
  logExp(`Conferência: ${tot} ok · ${errs} erro(s).`,'ok');
  const fc=fils.map(f=>f.branchId);
  if(tot>0){
    if(errs===0)await stepNFe(lid,fc);
    else{const d=await modal({tipo:'warn',titulo:'Houve erros',mensagem:`${tot} conferidos · ${errs} erros.\n\nEmitir NF-e mesmo assim?`,btns:[{t:'Não',v:'n'},{t:'Sim',v:'s',cls:'p'}]});if(d==='s')await stepNFe(lid,fc);}
  }
}

async function stepNFe(lid,fils){
  logExp('── NF-E ──','info');S.nfeFail=[];S.nfeSucess=[];
  const c=await modal({tipo:'info',icone:'📄',titulo:'Emitir NF-e',mensagem:`Carga #${lid}\n${fils.length} filial(is)\n\nEmitir as NF-e agora?`,btns:[{t:'Agora não',v:'n'},{t:'Emitir',v:'s',cls:'p'}]});
  if(c!=='s'){emitirEtiquetas([...new Set(fils.map(f=>norm(f)).filter(Boolean))]);return;}
  for(let i=0;i<fils.length;i++){
    const fid=fils[i];setStExp(`NF-e filial ${fid} (${i+1}/${fils.length})...`);
    let t=0,ok=false;
    while(t<C.RET&&!ok){
      try{
        t++;
        await A.nfe(lid,fid);
        ok=true;S.nfeSucess.push(fid);
        logExp(`✓ NF-e filial ${fid}`,'ok');
      }catch(e){
        if(t<C.RET){
          await sleep(C.RD);
        }else{
          S.nfeFail.push({branchId:fid,erro:e.message});
          logExp(`✗ NF-e filial ${fid}: ${e.message}`,'err');
          // ── DIAGNÓSTICO COMPLETO NO CONSOLE ──
          const diag={
            timestamp:new Date().toISOString(),
            cargaId:lid,
            filial:fid,
            tentativas:t,
            erro:e.message,
          };
          // Tenta buscar estado atual da carga e da filial pra diagnóstico
          console.group(`%c[NF-e DIAGNÓSTICO] Filial ${fid} — Carga #${lid}`,'color:#ef4444;font-weight:bold;font-size:13px');
          console.log('Erro:', e.message);
          console.log('Payload enviado:', {loadId:lid,destinyId:fid,originId:C.OID});
          try{
            const detCarga=await A.detCarga(lid);
            console.log('Estado da carga:', detCarga);
            diag.estadoCarga=detCarga;
          }catch(e2){console.warn('Não foi possível buscar estado da carga:',e2.message);}
          try{
            const itens=await A.itensBranch(lid,fid);
            console.log(`Itens filial ${fid} na carga:`, itens);
            diag.itensDaFilial=itens;
            // Verifica se todos os assets estão conferidos
            let totalAssets=0,conferidos=0,pendentes=[];
            for(const g of(itens||[]))for(const it of(g.items||[]))for(const a of(it.separatedAssets||[])){
              totalAssets++;
              if(a.status==='CHECKED'||a.conferenceStatus==='CHECKED')conferidos++;
              else pendentes.push({assetId:a.assetId,status:a.status||a.conferenceStatus||'?'});
            }
            console.log(`Assets: ${totalAssets} total · ${conferidos} conferidos · ${pendentes.length} pendentes`);
            if(pendentes.length)console.warn('Assets NÃO conferidos:',pendentes);
            diag.totalAssets=totalAssets;diag.conferidos=conferidos;diag.pendentes=pendentes;
          }catch(e2){console.warn('Não foi possível buscar itens da filial:',e2.message);}
          console.log('📋 Objeto completo para copiar:', JSON.stringify(diag,null,2));
          console.log('💡 Para retentar manualmente:');
          console.log(`   await fetch('${C.API}/v1/expedition/load/invoice', {method:'POST', headers:{'Content-Type':'application/json','Authorization':window.__MGT__}, body: JSON.stringify({loadId:${lid},destinyId:${fid},originId:'${C.OID}'})})`);
          console.groupEnd();
        }
      }
    }
    if(i<fils.length-1)await sleep(500);
  }
  S.nfeOk=S.nfeSucess.length>0;
  logExp(`NF-e: ${S.nfeSucess.length} ok · ${S.nfeFail.length} erro(s).`,S.nfeFail.length?'warn':'ok');
  if(S.nfeFail.length){
    console.group('%c[NF-e RESUMO DE FALHAS]','color:#f59e0b;font-weight:bold;font-size:13px');
    console.table(S.nfeFail);
    console.log('Para retentar todas as falhas de uma vez, cole no console:');
    console.log(`
// Retentar NF-e das filiais com erro
const tok = window.__MGT__;
const fails = ${JSON.stringify(S.nfeFail.map(f=>f.branchId))};
for(const fid of fails){
  const r = await fetch('${C.API}/v1/expedition/load/invoice', {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':tok},
    body: JSON.stringify({loadId:${lid},destinyId:fid,originId:'${C.OID}'})
  });
  console.log('Filial '+fid+':', r.status, await r.text());
}
    `.trim());
    console.groupEnd();
  }
  emitirEtiquetas([...new Set(fils.map(f=>norm(f)).filter(Boolean))]);
}

async function emitirEtiquetas(fils){
  if(!fils?.length)return;
  const c=await modal({tipo:'info',icone:'🖨️',titulo:'Emitir Etiquetas',mensagem:`Filiais: ${fils.join(', ')}\nCarga: #${S.cargaId}\n\nAbrir Google Planilhas?`,btns:[{t:'Não',v:'n'},{t:'Abrir',v:'s',cls:'p'}]});
  if(c!=='s')return;
  const pl=encodeURIComponent(JSON.stringify({filiais:fils,carga:S.cargaId,origem:C.OC,timestamp:Date.now()}));
  window.open(`https://script.google.com/a/macros/magazineluiza.com.br/s/AKfycbwHsUtz3myhdcLh8VdQABCMRhSmmaGRFZjAvEgr57JC2pkMr-bXamqjt5kagdsFqzF7Aw/exec?autoPrint=${pl}`,'_blank');
  const _ipf=await _fetchItensCarga(fils);
  await envEmails(fils,_ipf);
}

// Busca itens por filial da carga atual
async function _fetchItensCarga(fils){
  const ipf={};
  if(!S.cargaId)return ipf;
  for(const f of fils){
    try{
      const its=await A.itensBranch(S.cargaId,f);
      const lst=[];
      if(its?.length)for(const g of its)for(const it of(g.items||[]))lst.push({produto:it.itemName||it.description||'Produto',qtd:(it.separatedAssets||[]).length||1});
      ipf[f]=lst.length?lst:[{produto:'Produto não identificado',qtd:1}];
    }catch(_){ipf[f]=[];}
  }
  return ipf;
}

async function envEmails(fils,itensPorFilial={},rastreiosOverride=null){
  if(!fils?.length)return;
  logExp(`E-mails para ${fils.length} filial(is)...`,'info');
  const APPS_URL='https://script.google.com/macros/s/AKfycbxhXM_SZyYON_Ue2xh0PMD_nqiywwS_zIqKAdGP0rHGe9nENgeKP1lKOJdQHeSPTSsuxw/exec';
  const rastreiosNorm={};
  for(const f of fils){
    const fn=String(f).replace(/\D/g,'').replace(/^0+/,'')||'0';
    let tr=null;
    if(rastreiosOverride){
      tr=rastreiosOverride[fn]||rastreiosOverride[f]||null;
    }else{
      tr=S.tracks[f]||S.tracks[fn]
        ||S.tracks[fn.padStart(3,'0')]||S.tracks[fn.padStart(4,'0')]
        ||S.tracks[fn.padStart(5,'0')]||S.tracks['0'+fn]||null;
    }
    if(tr)rastreiosNorm[fn]=tr;
  }
  const payload=JSON.stringify({acao:'enviarEmails',filiais:fils,carga:S.cargaId,freightType:S.freight||'DEDICATED',departureDate:S.depDate||'',rastreios:rastreiosNorm,itensPorFilial});
  return new Promise(resolve=>{
    const xhr=new XMLHttpRequest();
    xhr.open('POST',APPS_URL,true);
    xhr.setRequestHeader('Content-Type','text/plain;charset=UTF-8');
    xhr.onload=()=>{
      try{
        const j=JSON.parse(xhr.responseText);
        if(j.ok)logExp(`✓ E-mails enviados: ${(j.enviados||fils).join(', ')}${j.erros?.length?' | Erros: '+j.erros.map(e=>e.filial).join(','):''}`,'ok');
        else logExp(`Apps Script erro: ${j.erro}`,'err');
      }catch(_){
        logExp(`E-mails disparados para: ${fils.join(', ')} (sem confirmação - verifique Apps Script)`,'ok');
      }
      resolve();
    };
    xhr.onerror=()=>{
      logExp(`Erro de rede ao enviar e-mails. Tentando GET...`,'warn');
      const params=new URLSearchParams({acao:'enviarEmails',filiais:fils.join(','),carga:String(S.cargaId||''),freightType:S.freight||'DEDICATED',departureDate:S.depDate||''});
      const w=window.open(APPS_URL+'?'+params.toString(),'_blank');
      setTimeout(()=>{try{w&&w.close();}catch(_){}},5000);
      logExp('Fallback GET disparado.','warn');
      resolve();
    };
    xhr.send(payload);
  });
}

async function testarEmails(){
  logExp('Buscando cargas...','info');
  let cs=[];try{const r=await A.listarCargas();cs=r?.records||(Array.isArray(r)?r:[]);}catch(e){logExp(`Erro: ${e.message}`,'err');return;}
  if(!cs.length){logExp('Nenhuma carga.','warn');return;}
  const idx=await listaModal({icone:'📧',titulo:'Selecione a Carga',itens:cs.map(c=>({t:`Carga #${c.id}`,s:`${c.freightType||'?'} · ${c.date?c.date.split('T')[0]:'?'}`,d:c.destinationsCode||''}))});
  if(idx===null)return;
  const ch=cs[idx];S.cargaId=ch.id;S.freight=ch.freightType;S.depDate=ch.departureDate||ch.date||'';
  const ci=await A.filsCarga(ch.id);
  let fils=[];for(const s of(ci?.stockCd||[]))for(const b of(s.branches||[])){const id=b.number||b.branchId;if(id){const _n=String(id).replace(/\D/g,'').replace(/^0+/,'')||'0';fils.push(_n);}}fils=[...new Set(fils)];
  if(!fils.length){logExp('Sem filiais.','warn');return;}
  const ipf=await _fetchItensCarga(fils);
  const c=await modal({tipo:'info',icone:'📧',titulo:'Confirmar',mensagem:`Carga #${ch.id} · ${ch.freightType}\nFiliais (${fils.length}): ${fils.join(', ')}\n\nIsso enviará e-mails REAIS.`,btns:[{t:'Cancelar',v:'n'},{t:'Enviar',v:'s',cls:'p'}]});
  if(c!=='s')return;

  const rastreiosEmail={};
  if(ch.freightType==='CORREIOS'){
    logExp('Buscando códigos de rastreio automaticamente...','info');
    for(const f of fils){
      const fn=String(f).replace(/\D/g,'').replace(/^0+/,'')||'0';
      let trEncontrado=null;
      try{
        const its=await A.itensBranch(ch.id,f);
        if(its?.length){
          outer:for(const g of its){
            for(const it of(g.items||[])){
              for(const asset of(it.separatedAssets||[])){
                const tr=asset.trackingNumber||asset.tracking||asset.trackCode||null;
                if(tr&&String(tr).trim()&&String(tr).trim()!=='null'){trEncontrado=String(tr).trim();break outer;}
              }
            }
          }
        }
      }catch(e){logExp(`Erro ao buscar rastreio filial ${fn}: ${e.message}`,'warn');}
      if(trEncontrado){
        rastreiosEmail[fn]=trEncontrado;
        logExp(`✓ Rastreio filial ${fn}: ${trEncontrado}`,'ok');
      }else{
        logExp(`Rastreio não encontrado para filial ${fn}, solicitando manualmente...`,'warn');
        let tr=null;
        while(!tr){
          tr=await prompt2({icone:'📮',titulo:`Rastreio — Filial ${fn}`,mensagem:`Digite o código para filial ${fn}:`,ph:'AA123456789BR'});
          if(!tr){
            const d=await modal({tipo:'err',titulo:'Rastreio obrigatório',mensagem:`Sem rastreio a filial ${fn} não receberá o código no e-mail.`,btns:[{t:'Pular esta filial',v:'skip',cls:'d'},{t:'Digitar',v:'retry',cls:'p'}]});
            if(d==='skip'){tr='(não informado)';break;}
          }
        }
        rastreiosEmail[fn]=tr;
        logExp(`Rastreio filial ${fn}: ${tr} (manual)`,'info');
      }
    }
  }
  await envEmails(fils,ipf,rastreiosEmail);
}

// ═══ RESUMO FINAL ══════════════════════════════════════
async function finalModal(){
  const results=Object.values(S.results);
  const oks=results.filter(r=>r.status==='ok');
  const fails=results.filter(r=>r.status==='fail');
  const allOk=fails.length===0;
  const dur=S.startTime?Math.round((Date.now()-S.startTime)/1000):0;
  const mm=Math.floor(dur/60),ss=dur%60;
  const nome=_userName||'usuário';
  const rks=Object.keys(S.tracks||{});

  return new Promise(res=>{
    const ov=document.createElement('div');ov.className='aa-ov';
    const m=document.createElement('div');m.className='aa-final-modal aa-res-modal';

    // tabela de resultados
    let tab='';
    if(results.length>0){
      tab='<div style="max-height:180px;overflow-y:auto;border:1px solid var(--mg-b1);border-radius:10px;margin-bottom:10px;">'+
        '<table class="aa-rtable"><thead><tr><th>Filial</th><th>Produto</th><th>Status</th></tr></thead><tbody>';
      for(const r of[...oks,...fails]){
        const tag=r.status==='ok'?'<span class="tag-ok">✓ ×'+r.qtd+'</span>':'<span class="tag-fail">✗ Falhou</span>';
        tab+='<tr class="'+(r.status==='ok'?'ok':'fail')+'"><td><strong>'+r.f+'</strong></td>'+
          '<td style="font-family:var(--mg-mono);font-size:10px">'+r.p+'</td><td>'+tag+'</td></tr>';
        if(r.status==='fail')tab+='<tr class="fail"><td colspan="3" style="font-size:9px;color:var(--mg-red);padding:2px 8px 5px">↳ '+r.motivo+'</td></tr>';
      }
      tab+='</tbody></table></div>';
    }

    // info da carga
    let cargaInfo='';
    if(S.cargaId){
      const freteLabel=S.freight==='CORREIOS'?'Correios':S.freight==='ABA'?'ABA':'Dedicado';
      cargaInfo='<div class="aa-final-sec">'+
        '<div class="aa-final-row"><span class="aa-final-k">Carga</span><span class="aa-final-v">#'+S.cargaId+'</span></div>'+
        '<div class="aa-final-row"><span class="aa-final-k">Tipo</span><span class="aa-final-v">'+freteLabel+'</span></div>'+
        '<div class="aa-final-row"><span class="aa-final-k">Conferidos</span><span class="aa-final-v" style="color:'+(S.confErr?'var(--mg-red)':'var(--mg-green)')+'">'+S.confOk+(S.confErr?' · '+S.confErr+' erros':' ✓')+'</span></div>'+
        '<div class="aa-final-row"><span class="aa-final-k">NF-e</span><span class="aa-final-v" style="color:'+(S.nfeOk?'var(--mg-green)':'var(--mg-orange)')+'">'+( S.nfeOk?'✓ Solicitada':'⏳ Pendente')+'</span></div>'+
        '</div>';
    }

    // rastreios — deduplica (evita 212/0212 duplicado)
    let rast='';
    if(rks.length){
      const seen=new Set();
      const uniq=rks.filter(k=>{const v=S.tracks[k];if(seen.has(v))return false;seen.add(v);return true;});
      rast='<div class="aa-final-sec">'+
        '<div style="font-size:9.5px;color:var(--mg-t3);margin-bottom:6px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Rastreios</div>'+
        uniq.map(k=>'<div style="font-family:var(--mg-mono);font-size:11px;color:var(--mg-blue);margin-bottom:2px">'+k+' → '+S.tracks[k]+'</div>').join('')+
        '</div>';
    }

    m.innerHTML=
      '<div class="aa-final-header">'+
        '<span class="aa-final-emoji">'+(allOk?'🎉':'⚠️')+'</span>'+
        '<div class="aa-final-title">Finalizamos, '+nome+'! '+(allOk?'🎉':'')+'</div>'+
        '<div class="aa-final-subtitle">'+new Date().toLocaleString('pt-BR')+' · '+(mm>0?mm+'m ':'')+ss+'s · '+(S.modo||'')+'</div>'+
      '</div>'+
      '<div class="aa-final-body">'+
        '<div class="aa-res-sum">'+
          '<div class="aa-res-cell"><div class="aa-res-val" style="color:var(--mg-blue)">'+S.jobs.length+'</div><div class="aa-res-lbl">Filiais</div></div>'+
          '<div class="aa-res-cell"><div class="aa-res-val" style="color:var(--mg-green)">'+oks.length+'</div><div class="aa-res-lbl">OK</div></div>'+
          '<div class="aa-res-cell"><div class="aa-res-val" style="color:'+(fails.length?'var(--mg-red)':'var(--mg-green)')+'">'+fails.length+'</div><div class="aa-res-lbl">Falhas</div></div>'+
        '</div>'+
        tab+cargaInfo+rast+
        '<div class="aa-rating-section">'+
          '<div class="aa-rating-label">Como foi a sua experiência?</div>'+
          '<div class="aa-rating" id="aa-stars">'+
            '<input type="radio" id="star5" name="aa-rating" value="5"><label for="star5"></label>'+
            '<input type="radio" id="star4" name="aa-rating" value="4"><label for="star4"></label>'+
            '<input type="radio" id="star3" name="aa-rating" value="3"><label for="star3"></label>'+
            '<input type="radio" id="star2" name="aa-rating" value="2"><label for="star2"></label>'+
            '<input type="radio" id="star1" name="aa-rating" value="1"><label for="star1"></label>'+
          '</div>'+
          '<div class="aa-rating-thanks" id="aa-rating-thanks"></div>'+
        '</div>'+
        '<div class="aa-final-btns">'+
          '<button class="aa-mb s" data-v="copy">📋 Copiar</button>'+
          '<button class="aa-mb p" data-v="close">Fechar</button>'+
        '</div>'+
      '</div>';

    ov.appendChild(m);document.body.appendChild(ov);

    const msgs=['😞 Vamos melhorar!','😐 Obrigado.','🙂 Valeu!','😊 Que bom!','🥳 Arrasou!'];
    m.querySelectorAll('#aa-stars input').forEach(inp=>{
      inp.addEventListener('change',()=>{
        const th=document.getElementById('aa-rating-thanks');
        if(th)th.textContent=msgs[parseInt(inp.value)-1]||'Obrigado!';
      });
    });
    m.querySelectorAll('[data-v]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        if(btn.dataset.v==='copy'){
          const lines=['AUTO ATIVOS — '+new Date().toLocaleString('pt-BR'),'Modo: '+S.modo+' · '+mm+'m'+ss+'s','','=== RESULTADO ==='];
          for(const r of results){lines.push('  '+r.f.padEnd(6)+' '+r.p.padEnd(20)+' '+(r.status==='ok'?'✓ OK (×'+r.qtd+')':'✗ FALHOU'));if(r.status==='fail')lines.push('         '+r.motivo);}
          if(S.cargaId){lines.push('','=== CARGA #'+S.cargaId+' ===','Tipo: '+(S.freight||'N/A'),'Conferidos: '+S.confOk+' | Erros: '+S.confErr,'NF-e: '+(S.nfeOk?'Solicitada':'Pendente'));}
          if(rks.length){lines.push('','=== RASTREIOS ===');rks.forEach(k=>lines.push('  '+k+': '+S.tracks[k]));}
          navigator.clipboard.writeText(lines.join('\n'));
          return;
        }
        ov.remove();res(btn.dataset.v);
      });
    });
    ov.addEventListener('click',e=>{if(e.target===ov){ov.remove();res('close');}});
  });
}






// ═══════════════════════════════════════════════════════════════
//  MODULE: CONFIRMA ABA (__caba__)
// ═══════════════════════════════════════════════════════════════

// ─── CABA State ───────────────────────────────────────────────
let _cargasABA=[],_selectedCD=null,_pollTimer=null;
const _cargasRegistradas=new Set();
const _sheetsCacheMap=new Map();
let _lc_caba=0;

// ─── CABA logCaba ─────────────────────────────────────────────
function logCaba(msg,type){type=type||'info';const lb=document.getElementById('caba-lb');if(!lb)return;_lc_caba++;const lc=document.getElementById('caba-lc');if(lc)lc.textContent=_lc_caba;const t=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});const d=document.createElement('div');d.className='caba-log-entry '+type;d.textContent=t+'  '+msg;lb.appendChild(d);lb.scrollTop=lb.scrollHeight;if(lb.children.length>200)lb.removeChild(lb.children[0]);}

// ─── CABA Helpers + API ──────────────────────────────────────
function getEffectiveBranch(){return CFG.SIMULAR_CD||_userBranch;}
function isAdmin(){return getEffectiveBranch()===CFG.ADMIN_BRANCH;}
function isCD(){return getEffectiveBranch()&&getEffectiveBranch()!==CFG.ADMIN_BRANCH;}
function fmtDate(d){if(!d)return '—';try{const dt=new Date(d);if(isNaN(dt)){const s=String(d);return s.replace(/,\s*/g,' ');}return dt.toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}catch{return String(d);}}
function userStr(){return (_userFullName||'')+' ('+(_userLogin||'')+')';}

const ICO={warehouse:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V8l9-5 9 5v13"/><path d="M9 21V12h6v9"/></svg>',package:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.89 1.45l8 4A2 2 0 0 1 22 7.24v9.53a2 2 0 0 1-1.11 1.79l-8 4a2 2 0 0 1-1.79 0l-8-4a2 2 0 0 1-1.1-1.8V7.24a2 2 0 0 1 1.11-1.79l8-4a2 2 0 0 1 1.78 0z"/><polyline points="2.32 6.16 12 11 21.68 6.16"/><line x1="12" y1="22.76" x2="12" y2="11"/></svg>',mapPin:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',check:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',clock:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',user:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',inbox:'<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>',search:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',chevron:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',archive:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>'};

async function _refresh401Caba(){logCaba('Token 401','warn');await _renovarTokenSilencioso();}
async function cabaReq(method,ep,body,retry){retry=retry||0;await ensureToken();const auth=getTok();if(!auth)throw new Error('Token não capturado.');const opts={method,headers:{'Content-Type':'application/json','Authorization':auth}};if(body)opts.body=JSON.stringify(body);const res=await fetch(CFG.API+ep,opts);if(res.status>=200&&res.status<300){const t=await res.text();try{return JSON.parse(t);}catch{return t;}}if(res.status===401&&retry<3){await _refresh401Caba();return cabaReq(method,ep,body,retry+1);}const txt=await res.text().catch(()=>'');throw new Error('HTTP '+res.status+': '+txt.slice(0,120));}
const yr=()=>new Date().getFullYear();
const A={listarCargas:()=>cabaReq('GET','/v1/expedition/loads?offset=1&limit=100&status=PENDING,CREATED,HAS_NF,NF_ERROR&startDate='+yr()+'-01-01&endDate='+yr()+'-12-31&originCode='+CFG.ORIGIN),filsCarga:id=>cabaReq('GET','/v1/expedition/load/'+id+'/conference/branches'),itensBranch:(lid,bid)=>cabaReq('GET','/v1/expedition/load/'+lid+'/conference/branch/'+bid+'/items?originId='+CFG.ORIGIN)};
async function SH(acao,dados){
  const WRITES=['registrarCarga','confirmarRecebimento','confirmarEnvioFilial','arquivarCarga'];
  const key=acao+'|'+JSON.stringify(dados||{});
  if(acao==='listarStatus'){const c=_sheetsCacheMap.get(key);if(c&&Date.now()-c.ts<25000)return c.data;}
  const r=await fetch(CFG.SHEETS_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({acao:acao,...dados})});
  const result=await r.json();
  if(acao==='listarStatus'&&result?.ok)_sheetsCacheMap.set(key,{data:result,ts:Date.now()});
  if(WRITES.includes(acao))_sheetsCacheMap.clear();
  return result;
}

async function detectAndRegister(){try{const r=await A.listarCargas();const all=r?.records||(Array.isArray(r)?r:[]);_cargasABA=all.filter(c=>c.freightType==='ABA');if(!_cargasABA.length){logCaba('Nenhuma carga ABA ativa','info');return;}logCaba(_cargasABA.length+' ABA ativa(s)','info');for(const c of _cargasABA){const cid=String(c.id);if(_cargasRegistradas.has(cid))continue;try{const br=await A.filsCarga(c.id);const cds=[];for(const cd of(br.stockCd||[]))cds.push({cd:cd.number,filiais:(cd.branches||[]).map(b=>b.number)});await SH('registrarCarga',{cargaId:c.id,cds});_cargasRegistradas.add(cid);logCaba('Carga #'+cid+' registrada','ok');}catch(_){}}}catch(e){logCaba('Erro: '+e.message,'err');}}
async function fetchItensFilial(cargaId,filial){try{const raw=await A.itensBranch(cargaId,filial);const itens=[];for(const grp of(raw||[]))for(const item of(grp.items||[]))for(const asset of(item.separatedAssets||[]))itens.push({desc:item.description||item.itemCode,category:grp.category||item.category||'',plate:asset.plateNumber||'',serial:asset.serialNumber||'',assetId:asset.assetId,tracking:asset.tracking||''});return itens;}catch{return[];}}

function renderFilBadge(conf){if(!conf)return '<span class="caba-fil-badge pendente"><span class="caba-ico">'+ICO.clock+'</span> Pendente</span>';if(conf.statusEnvio==='ENVIADO')return '<span class="caba-fil-badge enviado"><span class="caba-ico">'+ICO.check+'</span> Enviado</span>';if(conf.statusRecebimento==='RECEBIDO')return '<span class="caba-fil-badge recebido"><span class="caba-ico">'+ICO.clock+'</span> Aguard. envio</span>';return '<span class="caba-fil-badge pendente"><span class="caba-ico">'+ICO.clock+'</span> Pendente</span>';}
function renderUserLine(label,u,d){if(!u&&!d)return '';return '<div class="caba-fil-user"><span class="caba-ico muted">'+ICO.user+'</span> '+label+': '+u+' · '+fmtDate(d)+'</div>';}
function renderAsset(it){const id=it.plate?'Patrimônio: '+it.plate:'Ativo #'+it.assetId;const sr=it.serial?' · Serial: '+it.serial:'';return '<div class="caba-asset"><div class="caba-asset-name">'+it.desc+' <span class="caba-asset-cat">'+it.category+'</span></div><div class="caba-asset-meta">'+id+sr+'</div></div>';}
function cargaSummary(confs,total){const env=confs.filter(c=>c.statusEnvio==='ENVIADO').length;const rec=confs.filter(c=>c.statusRecebimento==='RECEBIDO').length;if(env>=total&&total>0)return{cls:'complete',txt:env+'/'+total+' enviadas'};if(rec>0)return{cls:'partial',txt:env+'/'+total+' enviadas'};return{cls:'pending',txt:'Aguardando'};}

// ─── CABA uiToken ────────────────────────────────────────────
function uiTokenCaba(){const el=document.getElementById('caba-tok'),tx=document.getElementById('caba-tok-txt'),fill=document.getElementById('caba-tok-fill');if(!el||!tx)return;if(!getTok()){el.className='sol-tok-bar w';tx.textContent='Aguardando token...';if(fill){fill.style.transition='none';fill.style.width='0%';}return;}if(_tokenSessaoExpirou){el.className='sol-tok-bar ex';tx.textContent='Sessão expirou';if(fill){fill.style.transition='none';fill.style.width='0%';}return;}const s=tokSecs(),mx=300,pct=s!==null?Math.min(100,Math.max(0,(s/mx)*100)):100;if(s!==null&&s<=60){el.className='sol-tok-bar ex';tx.textContent=s<=0?'Renovando...':s+'s';if(fill){fill.style.transition='width 1s linear';fill.style.width=pct+'%';}}else if(s!==null&&s<=180){el.className='sol-tok-bar w';tx.textContent=Math.ceil(s/60)+'min';if(fill){fill.style.transition='width 5s linear';fill.style.width=pct+'%';}}else{el.className='sol-tok-bar ok';tx.textContent=(s!==null?Math.ceil(s/60):5)+'min · Token ativo';if(fill){fill.style.transition='width 5s linear';fill.style.width=pct+'%';}}}

// ─── CABA render functions ────────────────────────────────────
async function renderAdminCDList(){const body=document.getElementById('caba-content');if(!body)return;body.innerHTML='<div class="caba-loading"><span>Carregando...</span></div>';let allConfs=[];try{const r=await SH('listarStatus',{});if(r?.ok)allConfs=r.dados||[];}catch(e){logCaba('Sheets: '+e.message,'warn');}const cdMap={};for(const cd of CFG.CDS_PADRAO)cdMap[cd]=[];for(const c of allConfs){if(!cdMap[c.cd])cdMap[c.cd]=[];cdMap[c.cd].push(c);}for(const c of _cargasABA){for(const cd of(c.stockCd||'').split(',').map(s=>s.trim()).filter(Boolean)){if(!cdMap[cd])cdMap[cd]=[];}}let html='<div class="caba-card"><div class="caba-card-label"><span class="caba-ico blue">'+ICO.warehouse+'</span> CDs Intermediários</div><div class="caba-cd-list">';const sorted=Object.keys(cdMap).sort((a,b)=>Number(a)-Number(b));for(const cd of sorted){const confs=cdMap[cd];const ids=[...new Set(confs.map(c=>c.cargaId))];const pend=ids.filter(id=>confs.filter(c=>c.cargaId===id).some(c=>c.statusEnvio!=='ENVIADO'));const bc=pend.length>0?'pending':ids.length>0?'ok':'none';const bt=pend.length>0?pend.length+' pendente'+(pend.length>1?'s':''):ids.length>0?ids.length+' concluída'+(ids.length>1?'s':''):'—';html+='<div class="caba-cd-item" data-cd="'+cd+'"><span class="caba-cd-name"><span class="caba-ico blue">'+ICO.warehouse+'</span> CD'+cd+'</span><span class="caba-cd-badge '+bc+'">'+bt+'</span></div>';}html+='</div></div><button class="caba-btn ghost" id="caba-show-archived" style="display:flex;align-items:center;justify-content:center;gap:6px;"><span class="caba-ico muted">'+ICO.archive+'</span> Cargas Arquivadas</button>';body.innerHTML=html;body.querySelectorAll('.caba-cd-item').forEach(el=>{el.onclick=()=>{_selectedCD=el.dataset.cd;renderAdminCDDetail();};});document.getElementById('caba-show-archived').onclick=()=>renderArchivedView();}

async function renderAdminCDDetail(){const body=document.getElementById('caba-content');if(!body||!_selectedCD)return;body.innerHTML='<div class="caba-loading"><span>Carregando CD'+_selectedCD+'...</span></div>';let confs=[];try{const r=await SH('listarStatus',{cd:_selectedCD});if(r?.ok)confs=r.dados||[];}catch(e){logCaba('Sheets: '+e.message,'warn');}const apiC=_cargasABA.filter(c=>(c.stockCd||'').split(',').map(s=>s.trim()).includes(_selectedCD));const cids=[...new Set(confs.map(c=>c.cargaId))];if(!cids.length){body.innerHTML='<div class="caba-back" id="caba-back">\u2190 Voltar</div><div class="caba-empty"><div class="caba-empty-icon"><span class="caba-ico muted">'+ICO.inbox+'</span></div>Nenhuma carga para CD'+_selectedCD+'</div>';document.getElementById('caba-back').onclick=()=>{_selectedCD=null;renderAdminCDList();};return;}let html='<div class="caba-back" id="caba-back">\u2190 Voltar</div><div class="caba-card"><div class="caba-card-label"><span class="caba-ico blue">'+ICO.warehouse+'</span> CD'+_selectedCD+' \u2014 '+cids.length+' carga(s)</div>';for(const cid of cids){const cf=confs.filter(c=>c.cargaId===cid);const sum=cargaSummary(cf,cf.length);const dep=apiC.find(c=>String(c.id)===cid)?.departureDate||'';const allSent=cf.every(c=>c.statusEnvio==='ENVIADO');const rec=cf.some(c=>c.statusRecebimento==='RECEBIDO');html+='<div class="caba-acc" data-carga="'+cid+'"><div class="caba-acc-header"><div class="caba-acc-left"><span class="caba-ico blue">'+ICO.package+'</span><span class="caba-acc-id">Carga #'+cid+'</span><span class="caba-acc-date">'+fmtDate(dep)+'</span></div><div class="caba-acc-right"><span class="caba-acc-summary '+sum.cls+'">'+sum.txt+'</span><span class="caba-acc-chevron">'+ICO.chevron+'</span></div></div><div class="caba-acc-body">';if(rec){const ru=cf.find(c=>c.usuarioRecebimento)?.usuarioRecebimento||'';const rd=cf.find(c=>c.dataRecebimento)?.dataRecebimento||'';html+='<div class="caba-status-bar blue"><span class="caba-ico">'+ICO.check+'</span> Recebido no CD'+_selectedCD+'</div>'+renderUserLine('Recebido',ru,rd);}else{html+='<div class="caba-status-bar orange"><span class="caba-ico">'+ICO.clock+'</span> Aguardando recebimento</div>';}for(const f of cf){html+='<div class="caba-fil"><div class="caba-fil-head"><span class="caba-fil-num"><span class="caba-ico muted">'+ICO.mapPin+'</span> Filial '+pad(f.filial)+'</span>'+renderFilBadge(f)+'</div>';if(f.statusEnvio==='ENVIADO')html+=renderUserLine('Enviado',f.usuarioEnvio,f.dataEnvio);html+='<div class="caba-fil-items" data-carga="'+cid+'" data-filial="'+f.filial+'"><div class="caba-loading" style="padding:6px;font-size:10px;"><span>Expandir para ver itens</span></div></div></div>';}if(allSent&&cf.length>0){html+='<div class="caba-status-bar green" style="margin-top:10px;"><span class="caba-ico">'+ICO.check+'</span> Todas enviadas <button class="caba-btn sm ghost" style="margin-left:auto;" data-action="arquivar" data-carga="'+cid+'"><span class="caba-ico muted">'+ICO.archive+'</span> Arquivar</button></div>';}html+='</div></div>';}html+='</div>';body.innerHTML=html;document.getElementById('caba-back').onclick=()=>{_selectedCD=null;renderAdminCDList();};body.querySelectorAll('.caba-acc-header').forEach(h=>{h.onclick=()=>{const acc=h.parentElement;acc.classList.toggle('open');if(acc.classList.contains('open'))acc.querySelectorAll('.caba-fil-items').forEach(async el=>{if(el.dataset.loaded)return;el.dataset.loaded='1';const itens=await fetchItensFilial(el.dataset.carga,el.dataset.filial);el.innerHTML=itens.length?itens.map(renderAsset).join(''):'<div style="font-size:11px;color:var(--mg-t3);padding:4px 0;">Sem itens</div>';});};});body.querySelectorAll('[data-action="arquivar"]').forEach(btn=>{btn.onclick=async e=>{e.stopPropagation();btn.disabled=true;btn.textContent='Arquivando...';try{await SH('arquivarCarga',{cargaId:btn.dataset.carga});logCaba('Carga #'+btn.dataset.carga+' arquivada','ok');renderAdminCDDetail();}catch(e){btn.disabled=false;logCaba('Erro: '+e.message,'err');}};});}

async function renderArchivedView(){const body=document.getElementById('caba-content');if(!body)return;body.innerHTML='<div class="caba-loading"><span>Carregando...</span></div>';let data=[];try{const r=await SH('listarArquivadas',{});if(r?.ok)data=r.dados||[];}catch(e){logCaba('Erro: '+e.message,'err');}const grouped={};for(const d of data){if(!grouped[d.cargaId])grouped[d.cargaId]=[];grouped[d.cargaId].push(d);}const allIds=Object.keys(grouped);let html='<div class="caba-back" id="caba-back-arch">\u2190 Voltar</div><div class="caba-card"><div class="caba-card-label"><span class="caba-ico muted">'+ICO.archive+'</span> Arquivadas ('+allIds.length+')</div><div class="caba-search"><span class="caba-ico muted">'+ICO.search+'</span><input type="text" id="caba-arch-search" placeholder="Buscar por n\u00ba da carga..."></div><div id="caba-arch-list">';if(!allIds.length){html+='<div class="caba-empty">Nenhuma carga arquivada</div>';}else{for(const cid of allIds){const rows=grouped[cid];html+='<div class="caba-acc caba-arch-item" data-carga-id="'+cid+'"><div class="caba-acc-header"><div class="caba-acc-left"><span class="caba-ico green">'+ICO.check+'</span><span class="caba-acc-id">Carga #'+cid+'</span><span class="caba-acc-date">Conclu\u00edda</span></div><div class="caba-acc-right"><span class="caba-acc-chevron">'+ICO.chevron+'</span></div></div><div class="caba-acc-body">';for(const r of rows){html+='<div class="caba-fil" style="padding:8px 12px;margin-top:6px;"><div style="display:flex;justify-content:space-between;align-items:center;"><span style="font-size:12px;font-weight:600;">CD'+r.cd+' \u2192 Filial '+pad(r.filial)+'</span><span class="caba-fil-badge enviado"><span class="caba-ico">'+ICO.check+'</span> Enviado</span></div>'+renderUserLine('Enviado',r.usuarioEnvio,r.dataEnvio)+renderUserLine('Recebido',r.usuarioRecebimento,r.dataRecebimento)+'</div>';}html+='</div></div>';}}html+='</div></div>';body.innerHTML=html;document.getElementById('caba-back-arch').onclick=()=>renderAdminCDList();body.querySelectorAll('.caba-acc-header').forEach(h=>{h.onclick=()=>h.parentElement.classList.toggle('open');});const se=document.getElementById('caba-arch-search');if(se)se.oninput=()=>{const q=se.value.trim();body.querySelectorAll('.caba-arch-item').forEach(el=>{el.style.display=(!q||el.dataset.cargaId.includes(q))?'':'none';});};}

async function renderCDView(){const myCD=getEffectiveBranch();const body=document.getElementById('caba-content');if(!body)return;body.innerHTML='<div class="caba-loading"><span>Buscando CD'+myCD+'...</span></div>';const apiC=_cargasABA.filter(c=>(c.stockCd||'').split(',').map(s=>s.trim()).includes(String(myCD)));let confs=[];try{const r=await SH('listarStatus',{cd:String(myCD)});if(r?.ok)confs=r.dados||[];}catch(_){}const cids=[...new Set(confs.map(c=>c.cargaId))];const active=cids.filter(id=>confs.filter(c=>c.cargaId===id).some(c=>c.statusEnvio!=='ENVIADO'));if(!active.length){body.innerHTML='<div class="caba-empty"><div class="caba-empty-icon"><span class="caba-ico muted">'+ICO.inbox+'</span></div>Nenhuma carga pendente para CD'+myCD+'<br><span style="font-size:10px;">Consultando a cada '+Math.round(CFG.POLL_INTERVAL/1000)+'s</span></div>';return;}let html='<div class="caba-card"><div class="caba-card-label"><span class="caba-ico blue">'+ICO.package+'</span> Cargas para CD'+myCD+' ('+active.length+')</div>';for(const cid of active){const cf=confs.filter(c=>c.cargaId===cid);const sum=cargaSummary(cf,cf.length);const dep=apiC.find(c=>String(c.id)===cid)?.departureDate||'';const jaRec=cf.some(c=>c.statusRecebimento==='RECEBIDO');html+='<div class="caba-acc" data-carga="'+cid+'"><div class="caba-acc-header"><div class="caba-acc-left"><span class="caba-ico blue">'+ICO.package+'</span><span class="caba-acc-id">Carga #'+cid+'</span><span class="caba-acc-date">Sa\u00edda: '+fmtDate(dep)+'</span></div><div class="caba-acc-right"><span class="caba-acc-summary '+sum.cls+'">'+sum.txt+'</span><span class="caba-acc-chevron">'+ICO.chevron+'</span></div></div><div class="caba-acc-body">';if(jaRec){html+='<div class="caba-status-bar blue"><span class="caba-ico">'+ICO.check+'</span> Recebimento confirmado</div>';}else{html+='<button class="caba-btn primary" style="margin-bottom:10px;" data-action="receber" data-carga="'+cid+'">CONFIRMAR RECEBIMENTO</button>';}for(const f of cf){const je=f.statusEnvio==='ENVIADO';html+='<div class="caba-fil"><div class="caba-fil-head"><span class="caba-fil-num"><span class="caba-ico muted">'+ICO.mapPin+'</span> Filial '+pad(f.filial)+'</span>';if(je){html+='<span class="caba-fil-badge enviado"><span class="caba-ico">'+ICO.check+'</span> Enviado</span>';}else{html+='<button class="caba-btn success sm" data-action="enviar" data-carga="'+cid+'" data-filial="'+f.filial+'">Confirmar Envio</button>';}html+='</div><div class="caba-fil-items" data-carga="'+cid+'" data-filial="'+f.filial+'"><div class="caba-loading" style="padding:4px;font-size:10px;"><span>Expandir para ver itens</span></div></div></div>';}html+='</div></div>';}html+='</div>';body.innerHTML=html;body.querySelectorAll('.caba-acc-header').forEach(h=>{h.onclick=()=>{const acc=h.parentElement;acc.classList.toggle('open');if(acc.classList.contains('open'))acc.querySelectorAll('.caba-fil-items').forEach(async el=>{if(el.dataset.loaded)return;el.dataset.loaded='1';const itens=await fetchItensFilial(el.dataset.carga,el.dataset.filial);el.innerHTML=itens.length?itens.map(renderAsset).join(''):'<div style="font-size:11px;color:var(--mg-t3)">Sem itens</div>';});};});body.querySelectorAll('[data-action="receber"]').forEach(btn=>{btn.onclick=async()=>{const ok=await showModal({ico:'📦',title:'Confirmar Recebimento',msg:'Confirmar o recebimento da Carga #'+btn.dataset.carga+' no CD'+myCD+'?\n\nEsta ação ficará registrada com seu nome.',confirmLabel:'Confirmar Recebimento',danger:false});if(!ok)return;btn.disabled=true;btn.textContent='Confirmando...';try{await SH('confirmarRecebimento',{cargaId:btn.dataset.carga,cd:myCD,usuario:userStr()});btn.outerHTML='<div class="caba-status-bar blue"><span class="caba-ico">'+ICO.check+'</span> Recebimento confirmado</div>';logCaba('Recebimento #'+btn.dataset.carga+' OK','ok');}catch(e){btn.disabled=false;btn.textContent='CONFIRMAR RECEBIMENTO';logCaba('Erro: '+e.message,'err');}};});body.querySelectorAll('[data-action="enviar"]').forEach(btn=>{btn.onclick=async()=>{const ok=await showModal({ico:'🚚',title:'Confirmar Envio',msg:'Confirmar o envio para a Filial '+pad(btn.dataset.filial)+'?\n\nCarga #'+btn.dataset.carga,confirmLabel:'Confirmar Envio',danger:false});if(!ok)return;btn.disabled=true;btn.textContent='...';try{await SH('confirmarEnvioFilial',{cargaId:btn.dataset.carga,cd:myCD,filial:btn.dataset.filial,usuario:userStr()});const cargaId=btn.dataset.carga;btn.outerHTML='<span class="caba-fil-badge enviado"><span class="caba-ico">'+ICO.check+'</span> Enviado</span>';logCaba('Envio '+btn.dataset.filial+' OK','ok');const acc=document.querySelector('.caba-acc[data-carga="'+cargaId+'"]');if(acc&&!acc.querySelector('[data-action="enviar"]')){const totalFils=acc.querySelectorAll('.caba-fil').length;setTimeout(()=>showFinalModal(myCD,totalFils,cargaId),300);acc.style.transition='opacity .6s';acc.style.opacity='0';setTimeout(()=>acc.remove(),700);}}catch(e){btn.disabled=false;btn.textContent='Confirmar Envio';logCaba('Erro: '+e.message,'err');}};});}

// ─── CABA showModal ──────────────────────────────────────────
function showModal(cfg){return new Promise(resolve=>{const ov=document.createElement('div');ov.className='caba-ov';const m=document.createElement('div');m.className='caba-modal';m.innerHTML='<div class="caba-m-ico">'+cfg.ico+'</div><div class="caba-m-ttl">'+cfg.title+'</div><div class="caba-m-msg">'+cfg.msg+'</div><div class="caba-m-btns"><button class="caba-mb s">Cancelar</button><button class="caba-mb '+(cfg.danger?'p':'g')+'">'+cfg.confirmLabel+'</button></div>';ov.appendChild(m);document.body.appendChild(ov);m.querySelector('.caba-mb.s').onclick=()=>{ov.remove();resolve(false);};m.querySelector('.caba-mb'+(cfg.danger?'.p':'.g')).onclick=()=>{ov.remove();resolve(true);};ov.onclick=e=>{if(e.target===ov){ov.remove();resolve(false);}};});}

// ─── CABA showFinalModal ─────────────────────────────────────
function showFinalModal(cd,totalFiliais,cargaId){const ov=document.createElement('div');ov.className='caba-ov';const m=document.createElement('div');m.className='caba-final-modal';const nome=_userName||('CD'+cd);const msgs=['','😬 Vamos melhorar!','😐 Pode ser melhor','🙂 Boa experiência!','😀 Muito bom!','🚀 Perfeito!'];m.innerHTML='<div class="caba-final-header"><span class="caba-final-emoji">🎉</span><div class="caba-final-title">Missão cumprida, <span class="caba-final-name">'+nome+'</span>!</div><div class="caba-final-subtitle">'+totalFiliais+' filia'+(totalFiliais===1?'l enviada':'is enviadas')+' com sucesso — Carga #'+cargaId+'</div></div><div class="caba-final-body"><div class="caba-rating-section"><div class="caba-rating-label">Como foi sua experiência?</div><div class="caba-rating" id="caba-stars-'+cargaId+'"><input type="radio" id="caba-s5-'+cargaId+'" name="caba-r-'+cargaId+'" value="5"><label for="caba-s5-'+cargaId+'"></label><input type="radio" id="caba-s4-'+cargaId+'" name="caba-r-'+cargaId+'" value="4"><label for="caba-s4-'+cargaId+'"></label><input type="radio" id="caba-s3-'+cargaId+'" name="caba-r-'+cargaId+'" value="3"><label for="caba-s3-'+cargaId+'"></label><input type="radio" id="caba-s2-'+cargaId+'" name="caba-r-'+cargaId+'" value="2"><label for="caba-s2-'+cargaId+'"></label><input type="radio" id="caba-s1-'+cargaId+'" name="caba-r-'+cargaId+'" value="1"><label for="caba-s1-'+cargaId+'"></label></div><div class="caba-rating-thanks" id="caba-rtk-'+cargaId+'"></div></div><div class="caba-final-btns"><button class="caba-mb g" id="caba-fc-'+cargaId+'">Fechar</button></div></div>';ov.appendChild(m);document.body.appendChild(ov);m.querySelectorAll('[name="caba-r-'+cargaId+'"]').forEach(inp=>{inp.onchange=()=>{const el=document.getElementById('caba-rtk-'+cargaId);if(el)el.textContent=msgs[Number(inp.value)]||'';};});document.getElementById('caba-fc-'+cargaId).onclick=()=>ov.remove();ov.onclick=e=>{if(e.target===ov)ov.remove();};}

// ─── CABA buildPanel ─────────────────────────────────────────
function buildPanel_caba(){if(document.getElementById('__caba__'))return;if(!document.body)return setTimeout(buildPanel,10);const toast=document.createElement('div');toast.id='caba-welcome-toast';toast.className='caba-welcome-toast';toast.innerHTML='<div style="font-size:13px;color:var(--mg-t2);margin-bottom:4px;font-weight:500;">Bem-vindo,</div><div style="font-size:26px;font-weight:800;color:var(--mg-blue);letter-spacing:-0.5px;" id="caba-toast-name">'+(_userName||'...')+'</div><div style="font-size:10px;color:var(--mg-t3);margin-top:8px;letter-spacing:1px;font-weight:600;">Confirma ABA · Magalu</div>';document.body.appendChild(toast);if(_userName){toast.dataset.shown='1';document.getElementById('caba-toast-name').textContent=_userName;requestAnimationFrame(()=>{toast.classList.add('show');setTimeout(()=>toast.classList.add('hide'),3200);setTimeout(()=>toast.remove(),3800);});}
const root=document.createElement('div');root.id='__caba__';root.innerHTML='<div class="sol-header" id="caba-drag-handle"><div class="sol-header-left"><div class="sol-spinner-wrap"><div class="sol-spinner"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div></div><div class="sol-header-info"><div class="sol-header-title">Confirma ABA</div><div class="sol-header-sub">created by joao.gmarques</div></div></div><div class="sol-header-btns"><button class="sol-hbtn" id="caba-switch" title="Alternar Admin/CD50" style="font-size:11px;">\uD83D\uDD04</button><button class="sol-hbtn" id="caba-refresh" title="Atualizar">\u27F3</button><button class="sol-hbtn" id="caba-min" title="Minimizar"></button><button class="sol-hbtn close-btn" id="caba-close" title="Fechar">\u2715</button></div></div><div class="sol-welcome-inline"><div class="sol-welcome-av" id="caba-welcome-av">?</div><div><div class="sol-welcome-txt">Ol\u00e1, <span class="sol-welcome-name" id="caba-welcome-name">usu\u00e1rio</span></div><div class="sol-welcome-sub" id="caba-welcome-sub">Aguardando token...</div></div></div><div class="sol-tok-bar w" id="caba-tok"><div class="sol-tok-dot"></div><span class="sol-tok-label" id="caba-tok-txt">Aguardando token...</span><div class="sol-tok-track"><div class="sol-tok-fill" id="caba-tok-fill" style="width:0%"></div></div></div><div class="caba-body" id="caba-content"><div class="caba-loading"><span>Aguardando token...</span></div></div><div class="caba-log-section"><div class="caba-log-header" id="caba-lh"><span class="caba-log-title">Logs <span class="caba-log-count" id="caba-lc">0</span></span><button class="caba-log-clear" id="caba-lclr">limpar</button></div><div class="caba-log-body" id="caba-lb"><div class="caba-log-entry info">Aguardando...</div></div></div>';document.body.appendChild(root);
const tab=document.createElement('button');tab.id='__caba_tab__';tab.innerHTML='\uD83D\uDCE6';document.body.appendChild(tab);
let isDragging=false,dx=0,dy=0;document.getElementById('caba-drag-handle').addEventListener('mousedown',e=>{if(e.target.closest('.sol-hbtn'))return;isDragging=true;const r=root.getBoundingClientRect();dx=e.clientX-r.left;dy=e.clientY-r.top;document.body.style.userSelect='none';});document.addEventListener('mousemove',e=>{if(!isDragging)return;let x=e.clientX-dx,y=e.clientY-dy;x=Math.max(0,Math.min(x,window.innerWidth-root.offsetWidth));y=Math.max(0,Math.min(y,window.innerHeight-60));root.style.left=x+'px';root.style.top=y+'px';root.style.right='auto';});document.addEventListener('mouseup',()=>{if(isDragging){isDragging=false;document.body.style.userSelect='';}});
document.getElementById('caba-close').onclick=e=>{e.stopPropagation();root.classList.add('off');tab.style.display='flex';tab.classList.remove('popping');void tab.offsetWidth;tab.classList.add('popping');setTimeout(()=>tab.classList.remove('popping'),1200);};tab.onclick=()=>{root.classList.remove('off');tab.style.display='none';};
const minBtn=document.getElementById('caba-min');minBtn.setAttribute('data-state','open');let mini=false;minBtn.onclick=e=>{e.stopPropagation();mini=!mini;root.classList.toggle('minimized',mini);minBtn.setAttribute('data-state',mini?'closed':'open');};
document.getElementById('caba-refresh').onclick=e=>{e.stopPropagation();startPolling();};
document.getElementById('caba-switch').onclick=e=>{e.stopPropagation();if(CFG.SIMULAR_CD){CFG.SIMULAR_CD=false;logCaba('Modo: Admin','info');}else{CFG.SIMULAR_CD=50;logCaba('Modo: CD50','info');}updateWelcome();startPolling();};
let logOpen=true;document.getElementById('caba-lh').onclick=()=>{logOpen=!logOpen;document.getElementById('caba-lb').style.display=logOpen?'':'none';};document.getElementById('caba-lclr').onclick=e=>{e.stopPropagation();document.getElementById('caba-lb').innerHTML='';_lc=0;document.getElementById('caba-lc').textContent='0';};
if(_userName)updateWelcome();uiTokenCaba();setInterval(uiTokenCaba,5000);const check=setInterval(()=>{if(getTok()){clearInterval(check);logCaba('Token capturado','ok');startPolling();}},1000);}

// ─── CABA startPolling ───────────────────────────────────────
async function startPolling(){logCaba('Consultando...','info');await detectAndRegister();if(isAdmin())await renderAdminCDList();else if(isCD())await renderCDView();else{const b=document.getElementById('caba-content');if(b)b.innerHTML='<div class="caba-empty">Branch '+getEffectiveBranch()+' n\u00e3o reconhecido</div>';}}

// ═══════════════════════════════════════════════════════════════
//  INIT — inject CSS + build all module panels
// ═══════════════════════════════════════════════════════════════
injectAllCSS();

function _initAll(){
  setTimeout(()=>{
    // Descarte panel — positioned top-right
    buildPanel_dsc();
  },600);
  setTimeout(()=>{
    // Solicitação panel — positioned slightly offset
    buildPanel_sol();
  },700);
  setTimeout(()=>{
    // Expedição panel — positioned offset
    buildPanel_exp();
  },800);
  setTimeout(()=>{
    // Confirma ABA panel
    buildPanel_caba();
  },900);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',_initAll);
}else{
  _initAll();
}
syncTok();

})();
