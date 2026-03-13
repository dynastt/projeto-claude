(function(){
'use strict';

// ── Captura token ──────────────────────────────────────
const origFetch=window.fetch;
window.fetch=function(input,init){
  init=init||{};
  const h=init.headers||{};
  const auth=h.Authorization||h.authorization||'';
  if(auth){
    const full=auth.startsWith('Bearer ')?auth:'Bearer '+auth;
    window.__MGT__=full;window.__MGTS__=Date.now();
    window.dispatchEvent(new CustomEvent('__mgt__',{detail:full}));
  }
  return origFetch.apply(this,arguments);
};
const origSet=XMLHttpRequest.prototype.setRequestHeader;
XMLHttpRequest.prototype.setRequestHeader=function(k,v){
  if(k.toLowerCase()==='authorization'&&v){
    const full=v.startsWith('Bearer ')?v:'Bearer '+v;
    window.__MGT__=full;window.__MGTS__=Date.now();
    window.dispatchEvent(new CustomEvent('__mgt__',{detail:full}));
  }
  return origSet.call(this,k,v);
};

// ── Helpers ────────────────────────────────────────────
const API='https://gestao-ativos-api.magazineluiza.com.br';

function xhrReq(method,url,headers,body){
  return new Promise(function(resolve,reject){
    const xhr=new XMLHttpRequest();
    xhr.open(method,url,true);
    Object.entries(headers||{}).forEach(([k,v])=>xhr.setRequestHeader(k,v));
    xhr.onload=function(){resolve({status:xhr.status,body:xhr.responseText});};
    xhr.onerror=function(){reject(new Error('Erro de rede'));};
    xhr.send(body||null);
  });
}

function authHeaders(){
  const tok=(window.__MGT__||'').replace('Bearer ','');
  return{'Accept':'application/json, text/plain, */*','Content-Type':'application/json','authorization':tok};
}

async function apiGet(ep){
  const res=await xhrReq('GET',API+ep,authHeaders(),null);
  if(res.status>=200&&res.status<300){
    try{return JSON.parse(res.body);}catch(_){return res.body;}
  }
  throw new Error('HTTP '+res.status+': '+res.body.slice(0,200));
}

async function apiPost(ep,body){
  const res=await xhrReq('POST',API+ep,authHeaders(),JSON.stringify(body));
  if(res.status>=200&&res.status<300){
    try{return JSON.parse(res.body);}catch(_){return res.body;}
  }
  throw new Error('HTTP '+res.status+': '+res.body.slice(0,200));
}

// ── Busca ativo ────────────────────────────────────────
async function buscarAtivo(serial,placa,branch){
  const base=`/v1/inventories/assets/grouped?branch.code=${branch}&offset=1&limit=5`;
  let itemCode=null,modo=null;
  if(serial&&placa&&serial!==placa){
    try{
      const r=await apiGet(`${base}&asset.serialNumber=${encodeURIComponent(serial)}&asset.plateNumber=${encodeURIComponent(placa)}`);
      if(r?.records?.length){itemCode=r.records[0].itemCode;modo='ambos';}
    }catch(_){}
  }
  if(!itemCode&&serial){
    try{
      const r=await apiGet(`${base}&asset.serialNumber=${encodeURIComponent(serial)}`);
      if(r?.records?.length){itemCode=r.records[0].itemCode;modo='serial';}
    }catch(_){}
  }
  if(!itemCode&&placa){
    try{
      const r=await apiGet(`${base}&asset.plateNumber=${encodeURIComponent(placa)}`);
      if(r?.records?.length){itemCode=r.records[0].itemCode;modo='placa';}
    }catch(_){}
  }
  if(!itemCode)return null;
  try{
    const assets=await apiGet(`/v1/inventories/assets/ungrouped?branch.code=${branch}&item.code=${itemCode}`);
    const lista=Array.isArray(assets)?assets:(assets?.records||[]);
    let asset=null;
    if(serial&&placa)asset=lista.find(a=>a.serialNumber===serial&&a.plateNumber===placa);
    if(!asset&&serial)asset=lista.find(a=>a.serialNumber===serial);
    if(!asset&&placa)asset=lista.find(a=>a.plateNumber===placa);
    if(!asset&&lista.length)asset=lista[0];
    if(!asset)return null;
    return{itemCode:String(itemCode),asset,modo};
  }catch(_){return null;}
}

// ── Descarte ───────────────────────────────────────────
async function criarDescarte(solicitationBody,branch){
  const ts=new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const body={
    description:`descarte auto cd${parseInt(branch,10)} - ${ts}`,
    origin:String(parseInt(branch,10)),
    solicitation:solicitationBody
  };
  const solId=await apiPost('/v1/solicitations/discard',body);
  if(!solId)throw new Error('API não retornou ID');
  const fd=new FormData();
  await origFetch(`${API}/v1/solicitation-attachments/${solId}`,{
    method:'POST',
    headers:{'authorization':window.__MGT__||''},
    body:fd
  });
  return solId;
}

// ── Listener de comandos do content.js ────────────────
window.addEventListener('__dsc_cmd__',async function(e){
  const {id,cmd,payload}=e.detail;
  function reply(data,error){
    window.dispatchEvent(new CustomEvent('__dsc_cmd_res__',{detail:{id,data,error}}));
  }
  try{
    if(cmd==='buscar'){
      reply(await buscarAtivo(payload.serial,payload.placa,payload.branch));
    } else if(cmd==='descartar'){
      reply(await criarDescarte(payload.solicitationBody,payload.branch));
    } else {
      reply(null,'Comando desconhecido: '+cmd);
    }
  }catch(err){
    reply(null,err.message);
  }
});

})();
