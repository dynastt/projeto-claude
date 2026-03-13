/**
 * Confirma ABA — Google Apps Script Backend v3
 * Melhorias: LockService (race conditions), formatação bonita da planilha
 */

const SHEET_NAME = 'Confirmacoes';
const ARCHIVE_SHEET = 'Arquivadas';

function getOrCreateSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name || SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(name || SHEET_NAME);
    setupSheetHeaders(sheet);
  }
  return sheet;
}

function setupSheetHeaders(sheet) {
  const headers = ['cargaId','cdIntermediario','filial','statusRecebimento','dataRecebimento','usuarioRecebimento','statusEnvio','dataEnvio','usuarioEnvio','criadoEm'];
  const hRange = sheet.getRange(1, 1, 1, headers.length);
  hRange.setValues([headers]);
  // Fundo azul Magalu, texto branco, negrito
  hRange.setBackground('#0078e6').setFontColor('#ffffff').setFontWeight('bold').setFontSize(11);
  sheet.setFrozenRows(1);
  // Larguras das colunas
  const widths = [80, 110, 70, 140, 150, 220, 100, 150, 220, 150];
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
  // Bordas no header
  hRange.setBorder(true, true, true, true, true, true, '#005bbf', SpreadsheetApp.BorderStyle.SOLID);
}

function formatDataRows(sheet) {
  const last = sheet.getLastRow();
  if (last <= 1) return;
  const dataRange = sheet.getRange(2, 1, last - 1, 10);
  // Fundo alternado: linhas pares levemente acinzentadas
  for (let i = 2; i <= last; i++) {
    sheet.getRange(i, 1, 1, 10).setBackground(i % 2 === 0 ? '#f0f4ff' : '#ffffff');
  }
  // Bordas nos dados
  dataRange.setBorder(true, true, true, true, true, true, '#d0d8f0', SpreadsheetApp.BorderStyle.SOLID);
  // Colorir colunas de status
  for (let i = 2; i <= last; i++) {
    const recStatus = sheet.getRange(i, 4).getValue();
    const envStatus = sheet.getRange(i, 7).getValue();
    if (recStatus === 'RECEBIDO') sheet.getRange(i, 4).setBackground('#d1fae5').setFontColor('#16a34a');
    else if (recStatus === 'PENDENTE') sheet.getRange(i, 4).setBackground('#fff7ed').setFontColor('#d97706');
    if (envStatus === 'ENVIADO') sheet.getRange(i, 7).setBackground('#d1fae5').setFontColor('#16a34a');
    else if (envStatus === 'PENDENTE') sheet.getRange(i, 7).setBackground('#fff7ed').setFontColor('#d97706');
  }
}

function s(v) { return String(v || '').trim(); }

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const acao = data.acao;
    if (acao === 'registrarCarga')      return resposta(registrarCarga(data));
    if (acao === 'confirmarRecebimento') return resposta(confirmarRecebimento(data));
    if (acao === 'confirmarEnvioFilial') return resposta(confirmarEnvioFilial(data));
    if (acao === 'listarStatus')         return resposta(listarStatus(data));
    if (acao === 'arquivarCarga')        return resposta(arquivarCarga(data));
    if (acao === 'listarArquivadas')     return resposta(listarArquivadas(data));
    return resposta({ ok: false, erro: 'Ação desconhecida: ' + acao });
  } catch (err) {
    return resposta({ ok: false, erro: err.message });
  }
}

function doGet(e) {
  return resposta({ ok: true, msg: 'Confirma ABA v3 ativo' });
}

function registrarCarga(data) {
  // LockService: evita race conditions em gravações simultâneas
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return { ok: false, erro: 'Servidor ocupado, tente novamente.' };
  }
  try {
    const sheet = getOrCreateSheet();
    const cargaId = s(data.cargaId);
    const agora = new Date().toLocaleString('pt-BR');
    let count = 0;
    const rows = getAllRows(sheet);
    const existKeys = new Set();
    for (const r of rows) existKeys.add(s(r[0]) + '|' + s(r[1]) + '|' + s(r[2]));

    for (const cdInfo of (data.cds || [])) {
      for (const filial of (cdInfo.filiais || [])) {
        const key = cargaId + '|' + s(cdInfo.cd) + '|' + s(filial);
        if (existKeys.has(key)) continue;
        existKeys.add(key);
        sheet.appendRow([cargaId, s(cdInfo.cd), s(filial), 'PENDENTE', '', '', 'PENDENTE', '', '', agora]);
        count++;
      }
    }
    if (count > 0) {
      try { formatDataRows(sheet); } catch(_) {}
    }
    return { ok: true, registrados: count };
  } finally {
    lock.releaseLock();
  }
}

function confirmarRecebimento(data) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return { ok: false, erro: 'Servidor ocupado.' }; }
  try {
    const sheet = getOrCreateSheet();
    const rows = getAllRows(sheet);
    const agora = new Date().toLocaleString('pt-BR');
    let count = 0;
    for (let i = 0; i < rows.length; i++) {
      if (s(rows[i][0]) === s(data.cargaId) && s(rows[i][1]) === s(data.cd) && s(rows[i][3]) === 'PENDENTE') {
        const rn = i + 2;
        sheet.getRange(rn, 4).setValue('RECEBIDO').setBackground('#d1fae5').setFontColor('#16a34a');
        sheet.getRange(rn, 5).setValue(agora);
        sheet.getRange(rn, 6).setValue(data.usuario || '');
        count++;
      }
    }
    return { ok: true, confirmados: count };
  } finally {
    lock.releaseLock();
  }
}

function confirmarEnvioFilial(data) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return { ok: false, erro: 'Servidor ocupado.' }; }
  try {
    const sheet = getOrCreateSheet();
    const rows = getAllRows(sheet);
    const agora = new Date().toLocaleString('pt-BR');
    let found = false;
    for (let i = 0; i < rows.length; i++) {
      if (s(rows[i][0]) === s(data.cargaId) && s(rows[i][1]) === s(data.cd) && s(rows[i][2]) === s(data.filial) && s(rows[i][6]) !== 'ENVIADO') {
        const rn = i + 2;
        sheet.getRange(rn, 7).setValue('ENVIADO').setBackground('#d1fae5').setFontColor('#16a34a');
        sheet.getRange(rn, 8).setValue(agora);
        sheet.getRange(rn, 9).setValue(data.usuario || '');
        found = true;
        break;
      }
    }
    return { ok: true, filial: data.filial, atualizado: found };
  } finally {
    lock.releaseLock();
  }
}

function listarStatus(data) {
  const sheet = getOrCreateSheet();
  const rows = getAllRows(sheet);
  const results = [];
  for (const r of rows) {
    if (data.cargaId && s(r[0]) !== s(data.cargaId)) continue;
    if (data.cd && s(r[1]) !== s(data.cd)) continue;
    results.push({
      cargaId: s(r[0]), cd: s(r[1]), filial: s(r[2]),
      statusRecebimento: s(r[3]), dataRecebimento: s(r[4]), usuarioRecebimento: s(r[5]),
      statusEnvio: s(r[6]), dataEnvio: s(r[7]), usuarioEnvio: s(r[8]),
      criadoEm: s(r[9])
    });
  }
  return { ok: true, dados: results };
}

function arquivarCarga(data) {
  const lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch(e) { return { ok: false, erro: 'Servidor ocupado.' }; }
  try {
    const sheet = getOrCreateSheet();
    const archive = getOrCreateSheet(ARCHIVE_SHEET);
    const rows = getAllRows(sheet);
    const cargaId = s(data.cargaId);
    const toDelete = [];
    for (let i = 0; i < rows.length; i++) {
      if (s(rows[i][0]) === cargaId) { archive.appendRow(rows[i]); toDelete.push(i + 2); }
    }
    for (let i = toDelete.length - 1; i >= 0; i--) sheet.deleteRow(toDelete[i]);
    if (toDelete.length > 0) {
      try { formatDataRows(sheet); formatDataRows(archive); } catch(_) {}
    }
    return { ok: true, arquivadas: toDelete.length };
  } finally {
    lock.releaseLock();
  }
}

function listarArquivadas(data) {
  const archive = getOrCreateSheet(ARCHIVE_SHEET);
  const rows = getAllRows(archive);
  const results = [];
  for (const r of rows) {
    results.push({
      cargaId: s(r[0]), cd: s(r[1]), filial: s(r[2]),
      statusRecebimento: s(r[3]), dataRecebimento: s(r[4]), usuarioRecebimento: s(r[5]),
      statusEnvio: s(r[6]), dataEnvio: s(r[7]), usuarioEnvio: s(r[8]),
      criadoEm: s(r[9])
    });
  }
  return { ok: true, dados: results };
}

function getAllRows(sheet) {
  const last = sheet.getLastRow();
  if (last <= 1) return [];
  return sheet.getRange(2, 1, last - 1, 10).getValues();
}

function resposta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
