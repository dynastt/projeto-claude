(function(){
'use strict';
if(document.getElementById('__aa__')) return;

// ═══ TOKEN + USERNAME ══════════════════════════════════
let _tok=null,_tokTs=0,_tokExp=null;
let _tokenRenovando=false;
let _tokenSessaoExpirou=false;
let _tokenUltimoErro=0;
let _userName=null;

function extractUserFromToken(token){
  try{
    const p=(token||'').replace('Bearer ','').split('.');
    if(p.length!==3)return null;
    const pl=JSON.parse(atob(p[1]));
    if(pl.exp)_tokExp=pl.exp*1000;
    return pl.name||pl.nome||pl.given_name||pl.preferred_username||pl.sub||pl.email||null;
  }catch{return null;}
}

const NOMES_ACENTOS={
  'joao':'João','jose':'José','maria':'Maria','antonio':'Antônio',
  'marcos':'Marcos','ana':'Ana','paulo':'Paulo','sebastiao':'Sebastião',
  'fabricio':'Fabrício','vinicius':'Vinícius','vitor':'Vítor',
  'vitoria':'Vitória','patricia':'Patrícia','leticia':'Letícia','lucio':'Lúcio',
  'ines':'Inês','helia':'Hélia','beatriz':'Beatriz','regis':'Régis',
  'sergio':'Sérgio','monica':'Mônica','andreia':'Andréia','everton':'Éverton',
  'emerson':'Émerson','edson':'Édson','gabriel':'Gabriel','henrique':'Henrique',
  'guilherme':'Guilherme','caio':'Caio','julio':'Júlio','celia':'Célia',
  'valeria':'Valéria','debora':'Débora','barbara':'Bárbara','claudia':'Cláudia',
  'flavio':'Flávio','marcio':'Márcio','luciana':'Luciana','cesar':'César',
  'eugenio':'Eugênio','rodrigo':'Rodrigo','cristiano':'Cristiano'
};
function accentuateName(r){if(!r)return r;return NOMES_ACENTOS[r.toLowerCase()]||r.charAt(0).toUpperCase()+r.slice(1);}
function getFriendlyName(raw){
  if(!raw)return null;
  if(raw.includes('@'))raw=raw.split('@')[0];
  return accentuateName(raw.split(/[\s._-]/)[0]);
}

// Intercepta fetch/XHR no world MAIN (via injector.js) + intercepta direto aqui também
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
        uiToken();
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
        uiToken();
      }
    }
    return origSet.apply(this,arguments);
  };
})();

function syncTok(){
  const t=window.__MGT__;
  if(t&&t!==_tok){
    _tok=t;_tokTs=window.__MGTS__||Date.now();
    if(_tokenSessaoExpirou){_tokenSessaoExpirou=false;_tokenUltimoErro=0;log('Sessão restaurada ✓','ok');}
    const u=extractUserFromToken(t);
    if(u){_userName=getFriendlyName(u);updateWelcome();}
    uiToken();
  }
}
window.addEventListener('__mgt__',e=>{
  _tok=e.detail;_tokTs=Date.now();_tokenSessaoExpirou=false;_tokenUltimoErro=0;
  const u=extractUserFromToken(e.detail);
  if(u){_userName=getFriendlyName(u);updateWelcome();}
  uiToken();
});
setInterval(syncTok,800);

function getTok(){return _tok;}
function tokMins(){
  try{const p=(_tok||'').replace('Bearer ','').split('.');if(p.length!==3)return null;
  const pl=JSON.parse(atob(p[1]));return pl.exp?Math.round((pl.exp*1000-Date.now())/60000):null;}
  catch{return null;}
}
function tokSecs(){
  try{const p=(_tok||'').replace('Bearer ','').split('.');if(p.length!==3)return null;
  const pl=JSON.parse(atob(p[1]));return pl.exp?Math.round((pl.exp*1000-Date.now())/1000):null;}
  catch{return null;}
}

function updateWelcome(){
  const el=document.getElementById('sol-welcome-name');
  if(el&&_userName)el.textContent=_userName;
  const av=document.getElementById('sol-welcome-av');
  if(av&&_userName)av.textContent=_userName[0].toUpperCase();
  const toast=document.getElementById('sol-welcome-toast');
  if(toast&&!toast.dataset.shown&&_userName){
    toast.dataset.shown='1';
    const tn=document.getElementById('sol-toast-name');
    if(tn)tn.textContent=_userName;
    toast.classList.add('show');
    setTimeout(()=>toast.classList.add('hide'),3200);
    setTimeout(()=>toast.remove(),3800);
  }
}

// ═══ TOKEN — RENOVAÇÃO SILENCIOSA ══════════════════════
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
      uiToken();
      log('Token renovado automaticamente ✓','ok');return true;
    }
  }catch(e){
    if(e.message==='SESSAO_EXPIROU'){
      if(!_tokenSessaoExpirou){log('Sessão expirou — clique em qualquer menu do portal para restaurar','warn');uiToken();}
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

// ═══ HELPERS ══════════════════════════════════════════
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=c=>(c||'').toString().replace(/\D/g,'').replace(/^0+/,'');
const pad=(c,n=4)=>String(c).padStart(n,'0');

// ═══ PARSE FILIAIS ════════════════════════════════════
function parseFiliais(text){
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

// ═══ API ══════════════════════════════════════════════
async function _refreshOn401(){
  log('Token expirou (401) — renovando...','warn');
  const ok=await _renovarTokenSilencioso();
  if(ok)return;
  if(!document.querySelector('.aa-ov')){
    const v=await modal({tipo:'warn',icone:'🔑',titulo:'Token expirado',mensagem:'Não foi possível renovar automaticamente.\nClique em qualquer menu do site e depois clique em Pronto.',btns:[{t:'Pronto',v:'ok',cls:'p'},{t:'Cancelar',v:'cancel',cls:'d'}]});
    if(v==='cancel')throw new Error('Processo cancelado: token expirado');
    syncTok();
  }
}
async function req(method,ep,body=null,retry=0){
  await ensureToken();
  const auth=getTok();
  if(!auth)throw new Error('Token não capturado — faça qualquer ação no site.');
  const res=await fetch(C.API+ep,{method,headers:{'Content-Type':'application/json','Authorization':auth},body:body?JSON.stringify(body):null});
  if(res.status>=200&&res.status<300){const t=await res.text();return t?JSON.parse(t):{};}
  if(res.status===404)return null;
  if(res.status===401&&retry<C.RET){await _refreshOn401();return req(method,ep,body,retry+1);}
  const e=await res.text().catch(()=>'');throw new Error(`HTTP ${res.status}: ${e.slice(0,120)}`);
}
const yr=()=>new Date().getFullYear();
const A={
  sols:bc=>req('GET',`/v1/expedition/solicitations?offset=1&limit=1000&branchCode=${bc}&status=CREATED,CREATING,IN_SEPARATION,PARTIAL_SHIPPING,PENDING&startDate=${yr()}-01-01&endDate=${yr()}-12-31&originCode=${C.OC}`),
  solDet:id=>req('GET',`/v1/solicitations/solicitation-detail/${id}`),
  envSep:(sid,ic,q)=>req('POST','/v1/separation',{solicitationBranchAssetId:sid,itemCode:ic,qntdSolicitation:q}),
  sepAsset:(aid,bd)=>req('POST','/v1/separation/asset',{assetId:String(aid),branchDestinyId:Number(bd),branchOriginId:String(C.OC),qtd:0}),
  listSep:()=>req('GET',`/v1/expedition/separateds/items?originId=${C.OID}`),
  detSep:(ids,ic)=>req('GET',`/v1/expedition/separateds/assets?solicitationsBranchAssetIds=${Array.isArray(ids)?ids.join(','):ids}&itemCode=${ic}`),
  criarCarga:(bid,assets)=>req('POST','/v1/expedition/load',{branchId:bid,loadAsset:assets}),
  addCarga:(lid,bid,assets)=>req('PUT',`/v1/expedition/load/${lid}`,{branchId:bid,loadAsset:assets}),
  listarCargas:()=>req('GET',`/v1/expedition/loads?offset=1&limit=20&status=PENDING,CREATED,HAS_NF,NF_ERROR&startDate=${yr()}-01-01&endDate=${yr()}-12-31&originCode=${C.OC}`),
  enviarCarga:(id,tp,dt)=>req('PUT',`/v1/expedition/load/address/${id}`,{departureDate:dt,freightType:tp}),
  filsCarga:id=>req('GET',`/v1/expedition/load/${id}/conference/branches`),
  itensBranch:(lid,bid)=>req('GET',`/v1/expedition/load/${lid}/conference/branch/${bid}/items?originId=${C.OID}`),
  conferir:(lid,aid,tr)=>req('PUT','/v1/expedition/load/conference',{loadId:lid,assetId:aid,trackingNumber:tr||''}),
  nfe:(lid,did)=>req('POST','/v1/expedition/load/invoice',{loadId:lid,destinyId:did,originId:C.OID}),
  detCarga:id=>req('GET',`/v1/expedition/load/${id}`),
};

// ═══ CSS ══════════════════════════════════════════════
function injectCSS(){
  if(document.getElementById('__aa_css__'))return;
  if(!document.head)return setTimeout(injectCSS,10);
  const s=document.createElement('style');
  s.id='__aa_css__';
  s.textContent=`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
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
@keyframes tab-pop{
  0%{transform:scale(0.5);opacity:0;}55%{transform:scale(1.35);opacity:1;}
  75%{transform:scale(0.92);}100%{transform:scale(1);}
}
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
@keyframes toast-enter{0%{opacity:0;transform:translate(-50%,-50%) scale(0.82) translateY(24px);}65%{opacity:1;transform:translate(-50%,-50%) scale(1.04) translateY(-4px);}100%{opacity:1;transform:translate(-50%,-50%) scale(1) translateY(0);}}
@keyframes toast-exit{0%{opacity:1;transform:translate(-50%,-50%) scale(1);}100%{opacity:0;transform:translate(-50%,-50%) scale(0.94) translateY(-20px);}}
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
@keyframes tok-blink{0%,100%{opacity:1}50%{opacity:.15}}

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
@keyframes tw-spin{10%{transform:translateY(-102%);}25%{transform:translateY(-100%);}35%{transform:translateY(-202%);}50%{transform:translateY(-200%);}60%{transform:translateY(-302%);}75%{transform:translateY(-300%);}85%{transform:translateY(-402%);}100%{transform:translateY(-400%);}}
@keyframes bounce05{85%,92%,100%{transform:translateY(0);}89%{transform:translateY(-4px);}95%{transform:translateY(2px);}}
@keyframes slide05{5%{transform:translateX(14px);}15%,30%{transform:translateX(6px);}40%,55%{transform:translateX(0);}65%,70%{transform:translateX(-4px);}80%,89%{transform:translateX(-12px);}100%{transform:translateX(14px);}}
@keyframes paper05{5%{transform:translateY(46px);}20%,30%{transform:translateY(34px);}40%,55%{transform:translateY(22px);}65%,70%{transform:translateY(10px);}80%,85%{transform:translateY(0);}92%,100%{transform:translateY(46px);}}
@keyframes keyboard05{5%,12%,21%,30%,39%,48%,57%,66%,75%,84%{box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);}9%{box-shadow:15px 2px 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);}18%{box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 2px 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);}27%{box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 12px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);}36%{box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 12px 0 var(--key),60px 12px 0 var(--key),68px 12px 0 var(--key),83px 10px 0 var(--key);}45%{box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 2px 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);}54%{box-shadow:15px 0 0 var(--key),30px 2px 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);}63%{box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 12px 0 var(--key);}72%{box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 2px 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 10px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);}81%{box-shadow:15px 0 0 var(--key),30px 0 0 var(--key),45px 0 0 var(--key),60px 0 0 var(--key),75px 0 0 var(--key),90px 0 0 var(--key),22px 10px 0 var(--key),37px 12px 0 var(--key),52px 10px 0 var(--key),60px 10px 0 var(--key),68px 10px 0 var(--key),83px 10px 0 var(--key);}}

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
@keyframes log-in{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
.sol-log-entry.info{border-color:rgba(0,120,230,.35);color:#2a6fb8;}
.sol-log-entry.ok{border-color:rgba(22,163,74,.35);color:var(--mg-green);}
.sol-log-entry.warn{border-color:rgba(217,119,6,.35);color:var(--mg-orange);}
.sol-log-entry.err{border-color:rgba(220,38,38,.35);color:var(--mg-red);}

/* ═══ MODAL ═══ */
.aa-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);backdrop-filter:blur(6px);z-index:2147483647;display:flex;align-items:center;justify-content:center;animation:ov-in .2s ease;}
@keyframes ov-in{from{opacity:0}to{opacity:1}}
.aa-modal{background:var(--mg-panel);border:1px solid var(--mg-b1);border-radius:18px;padding:24px 22px 20px;max-width:400px;width:92%;box-shadow:var(--mg-shadow-lg);animation:modal-pop .25s cubic-bezier(.34,1.56,.64,1);overflow:hidden;position:relative;}
.aa-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--mg-grad);}
@keyframes modal-pop{from{opacity:0;transform:scale(.92) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
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
@keyframes star-pop{0%{transform:scale(0.6);}60%{transform:scale(1.45);}100%{transform:scale(1.22);}}
.aa-rating-thanks{font-size:10px;color:var(--mg-blue);margin-top:7px;min-height:16px;font-weight:600;}
.aa-final-btns{display:flex;gap:7px;margin-top:14px;}

/* APPEAR */
@keyframes panel-appear{from{opacity:0;transform:translateY(16px) scale(0.97);}to{opacity:1;transform:translateY(0) scale(1);}}
#__aa__:not(.off){animation:panel-appear .35s cubic-bezier(.34,1.56,.64,1);}
`;
  document.head.appendChild(s);
}

// ═══ LOGO BLOCK ═══════════════════════════════════════
function magaluBrandBlock(size){
  const isLg=size==='lg';
  const fs=isLg?24:16;
  const textW=Math.round(fs*3.25);
  const svgH=Math.round(fs*1.25);
  const svg=`<svg width="${textW}" height="${svgH}" viewBox="0 0 ${textW} ${svgH}" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible;"><text x="0" y="${svgH-2}" font-family="'Nunito','Varela Round','Arial Rounded MT Bold','Arial Black',Arial,sans-serif" font-size="${fs}" font-weight="900" fill="#0f1120" letter-spacing="-0.5">Magalu</text></svg>`;
  return `<div class="sol-magalu-logo" style="gap:0;">${svg}<div class="sol-logo-bar" style="width:${textW}px;margin-top:2px;"></div></div>`;
}

// ═══ TOKEN UI ══════════════════════════════════════════
function uiToken(){
  const el=document.getElementById('aa-tok');
  const tx=document.getElementById('aa-tok-txt');
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

// ═══ PAINEL ═══════════════════════════════════════════
function buildPanel(){
  if(document.getElementById('__aa__'))return;
  if(!document.body)return setTimeout(buildPanel,10);

  // Toast
  const toast=document.createElement('div');
  toast.id='sol-welcome-toast';toast.className='sol-welcome-toast';
  toast.innerHTML=
    '<div class="sol-toast-greeting">Bem-vindo de volta,</div>'+
    '<div class="sol-toast-name" id="sol-toast-name">'+(_userName||'...')+'</div>'+
    '<div class="sol-toast-brand">Auto Ativos · Magalu</div>'+
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

    '<div class="sol-tok-bar w" id="aa-tok">'+
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
  document.getElementById('aa-stop').onclick=()=>{S.stop=true;setSt('Parada solicitada...');log('Interrompido pelo usuário.','warn');};
  document.getElementById('aa-email').addEventListener('click',testarEmails);

  let logOpen=true;
  document.getElementById('aa-lh').onclick=()=>{logOpen=!logOpen;document.getElementById('aa-lb').style.display=logOpen?'':'none';};
  document.getElementById('aa-lclr').onclick=e=>{e.stopPropagation();document.getElementById('aa-lb').innerHTML='';_lc=0;document.getElementById('aa-lc').textContent='0';};

  if(_userName)updateWelcome();
  uiToken();
  setInterval(uiToken,5000);
}

function showWorking(show){
  const tw=document.getElementById('sol-typewriter');
  if(tw)tw.classList.toggle('active',show);
}
function getMode(){
  const r=document.querySelector('input[name="aa-mode"]:checked');
  return r?r.value:'full';
}

// ═══ UI HELPERS ════════════════════════════════════════
function setSt(t,on=true){
  const el=document.getElementById('aa-st');
  if(!el)return;el.textContent=t;el.className='sol-status'+(on?' on':'');
}
function setProg(p){
  const w=document.getElementById('aa-pw'),b=document.getElementById('aa-pb');
  if(!w||!b)return;
  if(p===null){w.classList.remove('on');return;}
  w.classList.add('on');b.style.width=p+'%';
}
let _lc=0;
function log(msg,type='info'){
  const lb=document.getElementById('aa-lb');if(!lb)return;
  _lc++;
  const lc=document.getElementById('aa-lc');if(lc)lc.textContent=_lc;
  const t=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const d=document.createElement('div');d.className='sol-log-entry '+type;
  d.textContent=t+'  '+msg;lb.appendChild(d);lb.scrollTop=lb.scrollHeight;
  if(lb.children.length>200)lb.removeChild(lb.children[0]);
}

// ═══ MODAIS ════════════════════════════════════════════
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
async function start(){
  const raw=document.getElementById('aa-ta')?.value||'';
  const jobs=parseFiliais(raw);
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
  showWorking(true);
  setProg(5);
  log(`Modo ${mLabel[mode]} · ${jobs.length} job(s)`,'info');

  try{
    if(mode==='full'){
      setSt('Etapa 1 — Solicitações');setProg(10);
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
      if(!S.stop&&S.jobsOk.length){setSt('Etapa 2 — Separação');setProg(28);await stepSeparacao();if(!S.stop)await stepBuscarSep();}
      if(!S.stop&&S.sepAssets.length){setSt('Etapa 3 — Carga');setProg(50);await stepCarga();}
      if(!S.stop&&S.cargaId&&S.cargaOk){setSt('Etapa 4 — Conferência');setProg(68);await stepConferencia();}
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
    log(`Erro fatal: ${e.message}`,'err');
    setSt(`Erro: ${e.message}`,true);
  }finally{
    if(S.cargaId&&!S.stop){
      try{
        const fils=[...new Set([...S.confFilOk,...S.confFilErr,...S.sepFiliais].map(f=>norm(f)).filter(Boolean))];
        if(fils.length){const ipf=await _fetchItensCarga(fils);await envEmails(fils,ipf);}
      }catch(e){log('Erro ao enviar e-mails finais: '+e.message,'err');}
    }
  }

  showWorking(false);
  S.running=false;
  document.getElementById('aa-run').style.display='';
  document.getElementById('sol-stop-section').classList.remove('active');
  setProg(100);setTimeout(()=>setProg(null),600);
  setSt(S.stop?'Interrompido.':'Processo finalizado ✓',false);
  if(!S.stop)log('Finalizado.','ok');
  await finalModal();
}
async function stepSolicitacao(){
  log('── SOLICITAÇÕES ──','info');
  for(let i=0;i<S.jobs.length;i++){
    if(S.stop)break;
    const job=S.jobs[i];
    const pu=job.prod.toUpperCase();
    setSt(`Solicitação ${i+1}/${S.jobs.length} — Filial ${job.filial}`);
    log(`Buscando filial ${job.filial} · "${job.prod}"`,'info');
    try{
      const resp=await A.sols(job.filial);
      const sols=Array.isArray(resp)?resp:(resp?.records||resp?.content||[]);
      if(!sols.length){setRes(job.filial,job.prod,'fail','Nenhuma solicitação encontrada para esta filial');log(`Filial ${job.filial}: sem solicitações.`,'warn');continue;}
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
            log(`✓ Filial ${job.filial}: "${iname}" ×${qtd}`,'ok');
          }catch(e){log(`Erro asset ${sbaid}: ${e.message}`,'err');}
          await sleep(300);
        }
      }
      if(total>0){
        S.jobsOk.push(job);if(!S.sepFiliais.includes(job.filial))S.sepFiliais.push(job.filial);
        setRes(job.filial,job.prod,'ok',`${total} item(s) enviados`,total);
        log(`✓ Filial ${job.filial}: ${total} item(s) ok.`,'ok');
      }else if(!found){
        setRes(job.filial,job.prod,'fail',`"${job.prod}" não encontrado nas solicitações pendentes`);
        log(`Filial ${job.filial}: "${job.prod}" não encontrado.`,'warn');
      }else{
        setRes(job.filial,job.prod,'fail','Produto encontrado mas falhou ao enviar');
        log(`Filial ${job.filial}: erro ao enviar.`,'err');
      }
    }catch(e){
      setRes(job.filial,job.prod,'fail',`Erro de API: ${e.message}`);
      log(`Erro filial ${job.filial}: ${e.message}`,'err');
      const d=await modal({tipo:'err',titulo:'Erro na Solicitação',mensagem:`Filial ${job.filial} falhou.`,det:e.message,btns:[{t:'🛑 Parar',v:'stop',cls:'d'},{t:'⏭ Pular',v:'skip',cls:'p'}]});
      if(d==='stop'){S.stop=true;break;}
    }
    await sleep(500);
  }
}

async function stepSeparacao(){
  log('── SEPARAÇÃO ──','info');
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
    if(!fp||!Object.keys(fp).length){log(`Filial ${fn}: sem plano.`,'warn');continue;}
    setSt(`Separação ${i+1}/${flist.length} — Filial ${fn}`);
    log(`Bipagem — Filial ${fn}`,'warn');
    const used=new Set();
    for(const item of Object.values(fp)){
      if(S.stop)break;
      const{ic,desc,qtd:total}=item;if(!total)continue;
      log(`Filial ${fn}: "${desc}" → bipar ${total}`,'info');
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
          if(used.has(aid)){log(`Ativo ${aid} já bipado.`,'warn');continue;}
          try{
            await A.sepAsset(aid,fn);used.add(aid);bip++;
            log(`✓ Ativo ${aid} (${bip}/${total})`,'ok');
          }catch(e){
            log(`Erro bipar ${aid}: ${e.message}`,'err');
            const d=await modal({tipo:'err',titulo:'Erro ao bipar',mensagem:`Ativo ${aid} falhou.`,det:e.message,btns:[{t:'🛑 Parar',v:'stop',cls:'d'},{t:'⏭ Pular',v:'skip'},{t:'🔄 Tentar',v:'retry',cls:'p'}]});
            if(d==='stop'){S.stop=true;throw new Error('Interrompido');}
            if(d==='skip')bip++;
          }
          await sleep(150);
        }
      }
    }
  }
  log('Separação concluída.','ok');
}

async function stepBuscarSep(){
  log('── BUSCANDO SEPARADOS ──','info');
  setSt('Buscando ativos separados...');
  const sep=await A.listSep();
  if(!sep?.length){log('Nenhum ativo separado.','warn');return;}
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
          log(`Filial ${bid}: ${dets?.length||0} "${desc}" prontos.`,'info');
        }catch(e){log(`Erro item ${ic}: ${e.message}`,'err');}
        await sleep(200);
      }
    }
  }
  log(`Total: ${S.sepAssets.length} ativo(s).`,'ok');
}

async function stepCarga(){
  log('── CARGA ──','info');
  if(!S.sepAssets.length)throw new Error('Nenhum ativo para a carga');
  const la=S.sepAssets.map(a=>({separatedAssetId:a.separatedAssetId}));
  const op=await modal({icone:'🚚',titulo:'Opção de Carga',mensagem:`${la.length} ativo(s) prontos.\n\nComo deseja prosseguir?`,btns:[{t:'➕ Nova Carga',v:'new',cls:'p'},{t:'📋 Carga Existente',v:'ex'}]});
  if(!op)return;
  try{
    if(op==='ex')await addCargaEx(la);
    else await novaCarga(la);
  }catch(e){
    log(`Erro carga: ${e.message}`,'err');
    const id=await prompt2({icone:'⚠️',titulo:'Erro na API',mensagem:'Digite o ID da carga manualmente:',ph:'ID...'});
    if(id&&!isNaN(parseInt(id))){S.cargaId=parseInt(id);log(`Carga ${id} manual.`,'warn');}
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
  log(`✓ ${la.length} ativo(s) → carga #${S.cargaId}`,'ok');
  const c=await modal({tipo:'ok',titulo:'Ativos adicionados!',mensagem:`Carga #${S.cargaId}\n${la.length} ativos.\n\nConferir agora?`,btns:[{t:'Não',v:'n'},{t:'Sim',v:'s',cls:'p'}]});
  S.cargaOk=c==='s';
}

async function novaCarga(la){
  const r=await A.criarCarga(C.OC,la);
  S.cargaId=r?.loadId||r?.id;if(!S.cargaId)throw new Error('API não retornou loadId');
  log(`✓ Carga #${S.cargaId} criada!`,'ok');
  // Tipo de frete — agora com ABA
  const tp=await prompt2({icone:'🚚',titulo:'Tipo de Frete',mensagem:'D = DEDICADO\nC = CORREIOS\nA = ABA',ph:'D, C ou A'});
  if(!tp){log('Carga criada, não enviada.','warn');return;}
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
  if(c!=='s'){log('Envio cancelado.','warn');return;}
  await A.enviarCarga(S.cargaId,ft,dd);S.cargaOk=true;log(`✓ Carga #${S.cargaId} enviada!`,'ok');
}

async function stepConferencia(){
  log('── CONFERÊNCIA ──','info');
  const lid=S.cargaId;
  const ci=await A.filsCarga(lid);if(!ci){log('Sem info da carga.','err');return;}

  // Se ainda não temos freight/depDate (modo carga com carga existente), busca da API
  if(!S.freight||!S.depDate){
    try{
      const det=await A.detCarga(lid);
      if(det){
        S.freight=S.freight||det.freightType||'DEDICATED';
        S.depDate=S.depDate||det.departureDate||det.date||'';
      }
    }catch(e){log('Não foi possível buscar dados da carga: '+e.message,'warn');}
  }

  const isCorr=ci.freightType==='CORREIOS'||(S.freight==='CORREIOS');
  const fils=[];const _seen=new Set();
  for(const s of(ci.stockCd||[]))for(const b of(s.branches||[])){const id=b.number||b.branchId;if(id&&b.status==='PENDING'){const _n=String(id).replace(/\D/g,'').replace(/^0+/,'')||'0';if(!_seen.has(_n)){_seen.add(_n);fils.push({branchId:id});}}}
  const ord=S.jobs.map(j=>norm(j.filial));
  fils.sort((a,b)=>{const ia=ord.indexOf(norm(a.branchId)),ib=ord.indexOf(norm(b.branchId));return(ia<0?9999:ia)-(ib<0?9999:ib);});
  if(!fils.length){log('Sem filiais pendentes.','info');return;}
  log(`${fils.length} filial(is) para conferir.`,'info');
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
      log(`Rastreio filial ${_norm}: ${tr}`,'ok');
    }
  }
  let tot=0,errs=0;
  for(let i=0;i<fils.length;i++){
    if(S.stop)break;
    const{branchId}=fils[i];
    setSt(`Conferindo filial ${branchId} (${i+1}/${fils.length})...`);setProg(68+Math.round(i/fils.length*25));
    try{
      const its=await A.itensBranch(lid,branchId);if(!its?.length){log(`Filial ${branchId}: sem itens.`,'info');continue;}
      let c=0,e=0;
      for(const g of its)for(const item of(g.items||[]))for(const asset of(item.separatedAssets||[])){
        if(S.stop)break;const aid=asset.assetId;if(!aid)continue;
        let rt=0,ok=false;
        while(rt<C.RET&&!ok){try{await A.conferir(lid,aid,isCorr?(S.tracks[branchId]||''):'');c++;tot++;ok=true;}catch(e2){if(e2.message&&e2.message.includes('409')){log(`Ativo ${aid}: ja conferido (ok)`,'info');c++;tot++;ok=true;}else{rt++;if(rt>=C.RET){e++;errs++;log(`Erro ativo ${aid}: ${e2.message}`,'err');}else await sleep(C.RD);}}}
        await sleep(150);
      }
      e>0?S.confFilErr.push(branchId):S.confFilOk.push(branchId);
      log(`Filial ${branchId}: ${c} ok${e?` · ${e} erro(s)`:''}`,'ok');
    }catch(e){log(`Erro filial ${branchId}: ${e.message}`,'err');S.confFilErr.push(branchId);}
    await sleep(300);
  }
  S.confOk=tot;S.confErr=errs;
  log(`Conferência: ${tot} ok · ${errs} erro(s).`,'ok');
  const fc=fils.map(f=>f.branchId);
  if(tot>0){
    if(errs===0)await stepNFe(lid,fc);
    else{const d=await modal({tipo:'warn',titulo:'Houve erros',mensagem:`${tot} conferidos · ${errs} erros.\n\nEmitir NF-e mesmo assim?`,btns:[{t:'Não',v:'n'},{t:'Sim',v:'s',cls:'p'}]});if(d==='s')await stepNFe(lid,fc);}
  }
}

async function stepNFe(lid,fils){
  log('── NF-E ──','info');S.nfeFail=[];S.nfeSucess=[];
  const c=await modal({tipo:'info',icone:'📄',titulo:'Emitir NF-e',mensagem:`Carga #${lid}\n${fils.length} filial(is)\n\nEmitir as NF-e agora?`,btns:[{t:'Agora não',v:'n'},{t:'Emitir',v:'s',cls:'p'}]});
  if(c!=='s'){emitirEtiquetas([...new Set(fils.map(f=>norm(f)).filter(Boolean))]);return;}
  for(let i=0;i<fils.length;i++){
    const fid=fils[i];setSt(`NF-e filial ${fid} (${i+1}/${fils.length})...`);
    let t=0,ok=false;
    while(t<C.RET&&!ok){
      try{
        t++;
        await A.nfe(lid,fid);
        ok=true;S.nfeSucess.push(fid);
        log(`✓ NF-e filial ${fid}`,'ok');
      }catch(e){
        if(t<C.RET){
          await sleep(C.RD);
        }else{
          S.nfeFail.push({branchId:fid,erro:e.message});
          log(`✗ NF-e filial ${fid}: ${e.message}`,'err');
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
  log(`NF-e: ${S.nfeSucess.length} ok · ${S.nfeFail.length} erro(s).`,S.nfeFail.length?'warn':'ok');
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
  log(`E-mails para ${fils.length} filial(is)...`,'info');
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
        if(j.ok)log(`✓ E-mails enviados: ${(j.enviados||fils).join(', ')}${j.erros?.length?' | Erros: '+j.erros.map(e=>e.filial).join(','):''}`,'ok');
        else log(`Apps Script erro: ${j.erro}`,'err');
      }catch(_){
        log(`E-mails disparados para: ${fils.join(', ')} (sem confirmação - verifique Apps Script)`,'ok');
      }
      resolve();
    };
    xhr.onerror=()=>{
      log(`Erro de rede ao enviar e-mails. Tentando GET...`,'warn');
      const params=new URLSearchParams({acao:'enviarEmails',filiais:fils.join(','),carga:String(S.cargaId||''),freightType:S.freight||'DEDICATED',departureDate:S.depDate||''});
      const w=window.open(APPS_URL+'?'+params.toString(),'_blank');
      setTimeout(()=>{try{w&&w.close();}catch(_){}},5000);
      log('Fallback GET disparado.','warn');
      resolve();
    };
    xhr.send(payload);
  });
}

async function testarEmails(){
  log('Buscando cargas...','info');
  let cs=[];try{const r=await A.listarCargas();cs=r?.records||(Array.isArray(r)?r:[]);}catch(e){log(`Erro: ${e.message}`,'err');return;}
  if(!cs.length){log('Nenhuma carga.','warn');return;}
  const idx=await listaModal({icone:'📧',titulo:'Selecione a Carga',itens:cs.map(c=>({t:`Carga #${c.id}`,s:`${c.freightType||'?'} · ${c.date?c.date.split('T')[0]:'?'}`,d:c.destinationsCode||''}))});
  if(idx===null)return;
  const ch=cs[idx];S.cargaId=ch.id;S.freight=ch.freightType;S.depDate=ch.departureDate||ch.date||'';
  const ci=await A.filsCarga(ch.id);
  let fils=[];for(const s of(ci?.stockCd||[]))for(const b of(s.branches||[])){const id=b.number||b.branchId;if(id){const _n=String(id).replace(/\D/g,'').replace(/^0+/,'')||'0';fils.push(_n);}}fils=[...new Set(fils)];
  if(!fils.length){log('Sem filiais.','warn');return;}
  const ipf=await _fetchItensCarga(fils);
  const c=await modal({tipo:'info',icone:'📧',titulo:'Confirmar',mensagem:`Carga #${ch.id} · ${ch.freightType}\nFiliais (${fils.length}): ${fils.join(', ')}\n\nIsso enviará e-mails REAIS.`,btns:[{t:'Cancelar',v:'n'},{t:'Enviar',v:'s',cls:'p'}]});
  if(c!=='s')return;

  const rastreiosEmail={};
  if(ch.freightType==='CORREIOS'){
    log('Buscando códigos de rastreio automaticamente...','info');
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
      }catch(e){log(`Erro ao buscar rastreio filial ${fn}: ${e.message}`,'warn');}
      if(trEncontrado){
        rastreiosEmail[fn]=trEncontrado;
        log(`✓ Rastreio filial ${fn}: ${trEncontrado}`,'ok');
      }else{
        log(`Rastreio não encontrado para filial ${fn}, solicitando manualmente...`,'warn');
        let tr=null;
        while(!tr){
          tr=await prompt2({icone:'📮',titulo:`Rastreio — Filial ${fn}`,mensagem:`Digite o código para filial ${fn}:`,ph:'AA123456789BR'});
          if(!tr){
            const d=await modal({tipo:'err',titulo:'Rastreio obrigatório',mensagem:`Sem rastreio a filial ${fn} não receberá o código no e-mail.`,btns:[{t:'Pular esta filial',v:'skip',cls:'d'},{t:'Digitar',v:'retry',cls:'p'}]});
            if(d==='skip'){tr='(não informado)';break;}
          }
        }
        rastreiosEmail[fn]=tr;
        log(`Rastreio filial ${fn}: ${tr} (manual)`,'info');
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



// ═══ INIT ══════════════════════════════════════════════
injectCSS();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(buildPanel,600));
else setTimeout(buildPanel,600);
syncTok();
})();
