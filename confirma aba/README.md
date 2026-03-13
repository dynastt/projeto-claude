# Confirma ABA — Magalu
Extensão Chrome para confirmação de envios de cargas ABA entre CDs.

## Instalação

### 1. Google Sheets + Apps Script (Backend)
1. Crie uma nova planilha no Google Sheets
2. Vá em **Extensões > Apps Script**
3. Cole o conteúdo de `APPS_SCRIPT.gs`
4. Clique em **Implantar > Nova implantação**
5. Tipo: **App da Web**
6. Executar como: **Eu**
7. Quem tem acesso: **Qualquer pessoa**
8. Copie a URL gerada

### 2. Extensão Chrome
1. Abra `content.js` e substitua `__APPS_SCRIPT_URL__` pela URL do passo anterior
2. Acesse `chrome://extensions`
3. Ative **Modo do desenvolvedor**
4. Clique em **Carregar sem compactação**
5. Selecione a pasta `confirma-aba`

### 3. Uso
- Acesse `gestaoativos.magazineluiza.com.br`
- O painel aparece automaticamente
- Se `branch` no token = 38 → **Painel Admin** (vê todos os CDs)
- Se `branch` = outro valor → **Painel CD** (vê cargas do seu CD)

## Arquivos
- `manifest.json` — Config da extensão Chrome
- `injector.js` — Intercepta token JWT (world: MAIN)
- `content.js` — Painel + lógica
- `APPS_SCRIPT.gs` — Backend Google Sheets (não vai na extensão)
