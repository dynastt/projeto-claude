(function(){
'use strict';
if(document.getElementById('__dsc__')) return;

// ═══ TOKEN ════════════════════════════════════════════
let _tok=null,_tokTs=0;
let _tokenRenovando=false;
let _tokenSessaoExpirou=false;
let _tokenUltimoErro=0;
let _userName=null;

function extractUserFromToken(token){
  try{
    const p=(token||'').replace('Bearer ','').split('.');
    if(p.length!==3)return null;
    const pl=JSON.parse(atob(p[1]));
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

function updateWelcome(){
  const el=document.getElementById('dsc-welcome-name');
  if(el&&_userName){
    el.textContent=_userName;
    const av=document.getElementById('dsc-welcome-av');
    if(av)av.textContent=_userName[0].toUpperCase();
  }
  const toast=document.getElementById('dsc-welcome-toast');
  if(toast&&!toast.dataset.shown&&_userName){
    toast.dataset.shown='1';
    const tn=document.getElementById('dsc-toast-name');
    if(tn)tn.textContent=_userName;
    toast.classList.add('show');
    setTimeout(()=>toast.classList.add('hide'),3200);
    setTimeout(()=>toast.remove(),3800);
  }
}

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
      const timeout=setTimeout(()=>{try{document.body.removeChild(iframe);}catch(_){}reject(new Error('Timeout'));},20000);
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
      _tokenSessaoExpirou=false;_tokenUltimoErro=0;uiToken();
      log('Token renovado automaticamente ✓','ok');return true;
    }
  }catch(e){
    if(e.message==='SESSAO_EXPIROU'){
      if(!_tokenSessaoExpirou)log('Sessão expirou — clique em qualquer menu do portal para restaurar','warn');
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

// ═══ STATE ════════════════════════════════════════════
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

// ═══ PARSE DA LISTA ═══════════════════════════════════
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
async function start(){
  const raw=document.getElementById('dsc-ta').value||'';
  const branch='0038';
  const linhas=parseLinhas(raw);

  if(!getTok()){
    await modal({tipo:'err',icone:'🔐',titulo:'Token não capturado',mensagem:'Faça qualquer ação no site primeiro.',btns:[{t:'Ok',v:'ok',cls:'p'}]});return;
  }
  if(!linhas.length){
    await modal({tipo:'err',icone:'📝',titulo:'Lista vazia',mensagem:'Informe ao menos um ativo:\n244927 BE091410100011215858',btns:[{t:'Ok',v:'ok',cls:'p'}]});return;
  }

  log(`Buscando ${linhas.length} ativo(s)...`,'info');
  setSt('Buscando ativos...');setProg(5);
  const encontrados=[];
  const naoEncontrados=[];

  for(let i=0;i<linhas.length;i++){
    if(S.stop)break;
    const l=linhas[i];
    setSt(`Buscando ${i+1}/${linhas.length}...`);
    setProg(5+Math.round(i/linhas.length*40));
    const _lbl=l.placa&&l.serial?`placa+serial: ${l.placa} / ${l.serial}`:l.placa?`placa: ${l.placa}`:`serial: ${l.serial}`;
    log(`Buscando ${_lbl}`,'info');
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
        log(`✓ Encontrado: ${asset.description||'?'} (${modo})`,'ok');
      }else{
        naoEncontrados.push(l);
        log(`✗ Não encontrado: "${l.raw}"`,'err');
      }
    }catch(e){
      naoEncontrados.push(l);
      log(`✗ Erro ao buscar "${l.raw}": ${e.message}`,'err');
    }
    await sleep(150);
  }

  if(S.stop){setSt('Interrompido.',false);S.running=false;showBtns(false);showWorking(false);return;}

  if(!encontrados.length){
    await modal({tipo:'err',icone:'🔍',titulo:'Nenhum ativo encontrado',mensagem:'Nenhum dos ativos informados foi localizado no sistema.',btns:[{t:'Ok',v:'ok',cls:'p'}]});
    setSt('Pronto.',false);setProg(null);S.running=false;showBtns(false);showWorking(false);return;
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
  if(conf!=='s'){setSt('Cancelado.',false);setProg(null);S.running=false;showBtns(false);showWorking(false);return;}

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

  setSt('Criando solicitação de descarte...');setProg(80);
  log('Enviando solicitação de descarte...','info');
  try{
    const solId=await cmdInjector('descartar',{solicitationBody,branch});
    log(`Solicitação criada #${solId} ✓`,'ok');
    S.results.push({solId,qtd:encontrados.length,status:'ok'});
    setProg(100);setTimeout(()=>setProg(null),600);
    setSt('Descarte finalizado!',false);
    await modalResultado(solId,encontrados,naoEncontrados,branch);
  }catch(e){
    log(`ERRO ao criar descarte: ${e.message}`,'err');
    await modal({tipo:'err',icone:'❌',titulo:'Erro ao criar descarte',mensagem:e.message,btns:[{t:'Ok',v:'ok',cls:'p'}]});
    setSt('Erro.',false);setProg(null);
  }
  S.running=false;showBtns(false);showWorking(false);
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

// ═══ CSS ══════════════════════════════════════════════
function injectCSS(){
  if(document.getElementById('__dsc_css__'))return;
  if(!document.head)return setTimeout(injectCSS,10);
  const s=document.createElement('style');
  s.id='__dsc_css__';
  s.textContent=`
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --mg-bg:       #b8bcc8;
  --mg-panel:    #c8ccd8;
  --mg-s1:       #bfc3cf;
  --mg-s2:       #b2b7c4;
  --mg-s3:       #a6abb9;
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
  --mg-red-btn:  #0078e6;
  --mg-red-hover:#005bbf;
  --mg-orange:   #d97706;
  --mg-shadow:   0 2px 12px rgba(0,0,0,0.15);
  --mg-shadow-lg:0 12px 48px rgba(0,0,0,0.25),0 2px 8px rgba(0,0,0,0.12);
  --mg-font:     'Inter',-apple-system,BlinkMacSystemFont,sans-serif;
  --mg-mono:     'JetBrains Mono',monospace;
}

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
`;
  document.head.appendChild(s);
}

// ═══ TOKEN UI ═════════════════════════════════════════
function uiToken(){
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

// ═══ PAINEL ═══════════════════════════════════════════
function buildPanel(){
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
    showBtns(true);showWorking(true);start();
  };
  document.getElementById('dsc-stop').onclick=()=>{S.stop=true;setSt('Parando...');log('Interrompido pelo usuário.','warn');};

  // LOG
  let logOpen=true;
  document.getElementById('dsc-lh').onclick=()=>{logOpen=!logOpen;document.getElementById('dsc-lb').style.display=logOpen?'':'none';};
  document.getElementById('dsc-lclr').onclick=e=>{e.stopPropagation();document.getElementById('dsc-lb').innerHTML='';_lc=0;document.getElementById('dsc-lc').textContent='0';};

  if(_userName)updateWelcome();
  uiToken();
  setInterval(uiToken,5000);
}

function showWorking(show){
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

function setSt(t,on){const el=document.getElementById('dsc-st');if(!el)return;el.textContent=t;el.className='dsc-status'+(on!==false?' on':'');}
function setProg(p){const w=document.getElementById('dsc-pw'),b=document.getElementById('dsc-pb');if(!w||!b)return;if(p===null){w.classList.remove('on');return;}w.classList.add('on');b.style.width=p+'%';}
let _lc=0;
function log(msg,type){
  type=type||'info';const lb=document.getElementById('dsc-lb');if(!lb)return;
  _lc++;const lc=document.getElementById('dsc-lc');if(lc)lc.textContent=_lc;
  const t=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const d=document.createElement('div');d.className='dsc-log-entry '+type;
  d.textContent=t+'  '+msg;lb.appendChild(d);lb.scrollTop=lb.scrollHeight;
  if(lb.children.length>200)lb.removeChild(lb.children[0]);
}

function modal(cfg){
  return new Promise(res=>{
    const ov=document.createElement('div');ov.className='aa-ov';
    const m=document.createElement('div');m.className='aa-modal'+(cfg.wide?' '+cfg.wide:'');
    const ico=cfg.icone||(cfg.tipo==='err'?'⚠️':cfg.tipo==='ok'?'✅':'ℹ️');
    const tc=cfg.tipo==='err'?'var(--mg-red)':cfg.tipo==='ok'?'var(--mg-green)':cfg.tipo==='warn'?'var(--mg-orange)':'var(--mg-blue)';
    let h='<div class="aa-m-ico">'+ico+'</div><div class="aa-m-ttl" style="color:'+tc+'">'+cfg.titulo+'</div>';
    if(cfg.mensagem)h+='<div class="aa-m-msg">'+cfg.mensagem+'</div>';
    if(cfg.html)h+=cfg.html;
    h+='<div class="aa-m-btns">';
    (cfg.btns||[]).forEach(b=>{h+='<button class="aa-mb '+(b.cls||'s')+'" data-v="'+b.v+'">'+b.t+'</button>';});
    h+='</div>';
    m.innerHTML=h;ov.appendChild(m);document.body.appendChild(ov);
    m.querySelectorAll('[data-v]').forEach(btn=>{btn.addEventListener('click',()=>{ov.remove();res(btn.dataset.v);});});
    ov.addEventListener('click',e=>{if(e.target===ov){ov.remove();res(null);}});
  });
}

// ═══ INIT ═════════════════════════════════════════════
injectCSS();
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',()=>setTimeout(buildPanel,600));}
else{setTimeout(buildPanel,600);}
syncTok();

})();
