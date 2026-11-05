const compressor = { items: [], outputRoot: '', batchPath: '', running: false, completed: false, results: new Map() };
const resizer = {
  items: [], outputRoot: '', batchPath: '', running: false, completed: false, results: new Map(),
  mode: 'dimensions', lockRatio: true, sourceRatio: 1, primaryDimension: 'width', platform: 'instagram', presetId: 'instagram-square'
};

const presets = {
  instagram: [
    { id: 'instagram-square', name: 'Post quadrado', width: 1080, height: 1080, icon: '□' },
    { id: 'instagram-portrait', name: 'Post retrato', width: 1080, height: 1350, icon: '▯' },
    { id: 'instagram-story', name: 'Story / Reels', width: 1080, height: 1920, icon: '▯' },
    { id: 'instagram-profile', name: 'Foto de perfil', width: 320, height: 320, icon: '○' }
  ],
  facebook: [
    { id: 'facebook-cover', name: 'Capa', width: 851, height: 315, icon: '▭' },
    { id: 'facebook-feed', name: 'Post / link', width: 1200, height: 630, icon: '▭' },
    { id: 'facebook-square', name: 'Post / anúncio', width: 1080, height: 1080, icon: '□' },
    { id: 'facebook-profile', name: 'Foto de perfil', width: 320, height: 320, icon: '○' }
  ],
  x: [
    { id: 'x-header', name: 'Capa do perfil', width: 1500, height: 500, icon: '▭' },
    { id: 'x-post', name: 'Post horizontal', width: 1600, height: 900, icon: '▭' },
    { id: 'x-square', name: 'Post quadrado', width: 1080, height: 1080, icon: '□' },
    { id: 'x-profile', name: 'Foto de perfil', width: 400, height: 400, icon: '○' }
  ],
  tiktok: [
    { id: 'tiktok-video', name: 'Vídeo / post', width: 1080, height: 1920, icon: '▯' },
    { id: 'tiktok-cover', name: 'Capa vertical', width: 1080, height: 1920, icon: '▯' },
    { id: 'tiktok-profile', name: 'Foto de perfil', width: 200, height: 200, icon: '○' }
  ],
  linkedin: [
    { id: 'linkedin-cover', name: 'Capa do perfil', width: 1584, height: 396, icon: '▭' },
    { id: 'linkedin-post', name: 'Post / link', width: 1200, height: 627, icon: '▭' },
    { id: 'linkedin-square', name: 'Post quadrado', width: 1080, height: 1080, icon: '□' },
    { id: 'linkedin-profile', name: 'Foto de perfil', width: 400, height: 400, icon: '○' }
  ],
  youtube: [
    { id: 'youtube-thumbnail', name: 'Thumbnail', width: 1280, height: 720, icon: '▭' },
    { id: 'youtube-banner', name: 'Banner do canal', width: 2560, height: 1440, icon: '▭' },
    { id: 'youtube-short', name: 'Short', width: 1080, height: 1920, icon: '▯' },
    { id: 'youtube-profile', name: 'Foto do canal', width: 800, height: 800, icon: '○' }
  ]
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const compressorElements = {
  selectFiles: $('#select-files'), selectFolder: $('#select-folder'), addMore: $('#add-more'), selectOutput: $('#select-output'),
  outputPath: $('#output-path'), start: $('#start'), clear: $('#clear'), dropZone: $('#drop-zone'), queue: $('#queue'),
  queueTitle: $('#queue-title'), queueSubtitle: $('#queue-subtitle'), fileList: $('#file-list'), progressWrap: $('#progress-wrap'),
  progressBar: $('#progress-bar'), progressText: $('#progress-text'), working: $('#working-animation'), summary: $('#summary'),
  summaryText: $('#summary-text'), summaryPath: $('#summary-path'), savedSize: $('#saved-size'), savedPercent: $('#saved-percent'),
  processedCount: $('#processed-count'), openOutput: $('#open-output'), newBatch: $('#new-batch')
};

const resizeElements = {
  selectFiles: $('#resize-select-files'), selectFolder: $('#resize-select-folder'), addMore: $('#resize-add-more'),
  selectOutput: $('#resize-select-output'), outputPath: $('#resize-output-path'), start: $('#resize-start'), clear: $('#resize-clear'),
  dropZone: $('#resize-drop-zone'), queue: $('#resize-queue'), queueTitle: $('#resize-queue-title'), queueSubtitle: $('#resize-queue-subtitle'),
  fileList: $('#resize-file-list'), progressWrap: $('#resize-progress-wrap'), progressBar: $('#resize-progress-bar'),
  progressText: $('#resize-progress-text'), working: $('#resize-working-animation'), summary: $('#resize-summary'),
  summaryText: $('#resize-summary-text'), summaryPath: $('#resize-summary-path'), processedCount: $('#resize-processed-count'),
  resultSize: $('#resize-result-size'), openOutput: $('#resize-open-output'), newBatch: $('#resize-new-batch'), width: $('#resize-width'),
  height: $('#resize-height'), percentage: $('#resize-percentage'), percentageRange: $('#resize-percentage-range'), ratioLock: $('#ratio-lock'),
  templateRatioLock: $('#template-ratio-lock'), targetLabel: $('#resize-target-label'), targetDetail: $('#resize-target-detail'),
  modeHint: $('#resize-mode-hint'), presetGrid: $('#preset-grid')
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toLocaleString('pt-BR', { maximumFractionDigits: index ? 1 : 0 })} ${units[index]}`;
}

function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function addUniqueItems(state, items) {
  state.completed = false;
  const existing = new Set(state.items.map((item) => item.path.toLowerCase()));
  for (const item of items) {
    if (!existing.has(item.path.toLowerCase())) { state.items.push(item); existing.add(item.path.toLowerCase()); }
  }
}

function renderCompressorQueue() {
  if (compressor.completed) return;
  const hasItems = compressor.items.length > 0;
  compressorElements.dropZone.classList.toggle('hidden', hasItems);
  compressorElements.queue.classList.toggle('hidden', !hasItems);
  compressorElements.summary.classList.add('hidden');
  compressorElements.start.disabled = !hasItems || compressor.running;
  compressorElements.clear.disabled = compressor.running;
  compressorElements.addMore.disabled = compressor.running;
  compressorElements.queueTitle.textContent = `${compressor.items.length.toLocaleString('pt-BR')} ${compressor.items.length === 1 ? 'imagem selecionada' : 'imagens selecionadas'}`;
  compressorElements.queueSubtitle.textContent = `Tamanho total: ${formatBytes(compressor.items.reduce((sum, item) => sum + item.size, 0))}`;
  compressorElements.fileList.innerHTML = compressor.items.map((item) => {
    const result = compressor.results.get(item.id);
    let status = 'Na fila', statusClass = '', size = formatBytes(item.size), detail = item.path;
    if (result?.working) { status = 'Otimizando'; statusClass = 'working'; }
    else if (result?.ok) { status = result.savedBytes > 0 ? `−${result.savedPercent.toFixed(1)}%` : 'Já otimizada'; statusClass = 'success'; size = `${formatBytes(result.originalBytes)} → ${formatBytes(result.optimizedBytes)}`; detail = result.method; }
    else if (result?.error) { status = 'Falhou'; statusClass = 'error'; detail = result.error; }
    return fileRow(item, detail, size, status, statusClass);
  }).join('');
}

function fileRow(item, detail, value, status, statusClass) {
  return `<div class="file-row"><div class="file-info"><div class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div><div class="file-detail" title="${escapeHtml(detail)}">${escapeHtml(detail)}</div></div><div class="file-size">${escapeHtml(value)}</div><div class="file-status ${statusClass}">${escapeHtml(status)}</div></div>`;
}

async function chooseCompressorFiles(folder = false) {
  addUniqueItems(compressor, folder ? await window.arc.selectFolder() : await window.arc.selectFiles());
  renderCompressorQueue();
}

async function chooseOutput(state, element) {
  const selected = await window.arc.selectOutput();
  if (selected) { state.outputRoot = selected; element.value = selected; }
}

async function startOptimization() {
  if (compressor.running || !compressor.items.length) return;
  compressor.running = true; compressor.results.clear();
  setCompressorBusy(true);
  try {
    const response = await window.arc.optimize({ items: compressor.items, outputRoot: compressor.outputRoot, level: $('input[name="level"]:checked').value });
    compressor.batchPath = response.batchPath; compressor.completed = true; showCompressorSummary(response.results, response.batchPath);
  } catch (error) { window.alert(error?.message || 'Não foi possível processar este lote.'); }
  finally { compressor.running = false; setCompressorBusy(false); }
}

function setCompressorBusy(busy) {
  for (const element of [compressorElements.selectFiles, compressorElements.selectFolder, compressorElements.addMore, compressorElements.selectOutput, compressorElements.clear]) element.disabled = busy;
  compressorElements.start.disabled = busy || !compressor.items.length || compressor.completed;
  compressorElements.progressWrap.classList.toggle('hidden', !busy);
  compressorElements.working.classList.toggle('hidden', !busy);
  if (busy) { compressorElements.progressBar.style.width = '0%'; compressorElements.progressText.textContent = `0 de ${compressor.items.length}`; }
  renderCompressorQueue();
}

function showCompressorSummary(results, batchPath) {
  const successful = results.filter((result) => result.ok), failed = results.length - successful.length;
  const original = successful.reduce((sum, result) => sum + result.originalBytes, 0);
  const saved = successful.reduce((sum, result) => sum + result.savedBytes, 0);
  compressorElements.queue.classList.add('hidden'); compressorElements.dropZone.classList.add('hidden'); compressorElements.summary.classList.remove('hidden'); compressorElements.working.classList.add('hidden');
  compressorElements.savedSize.textContent = formatBytes(saved);
  compressorElements.savedPercent.textContent = `${(original ? saved / original * 100 : 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  compressorElements.processedCount.textContent = successful.length.toLocaleString('pt-BR');
  compressorElements.summaryText.textContent = failed ? `${successful.length} imagens prontas e ${failed} não puderam ser processadas.` : 'Tudo pronto. O lote foi salvo em uma pasta exclusiva.';
  compressorElements.summaryPath.textContent = batchPath; compressorElements.summaryPath.title = batchPath;
}

function resetCompressor() {
  Object.assign(compressor, { items: [], batchPath: '', completed: false }); compressor.results.clear();
  compressorElements.progressWrap.classList.add('hidden'); compressorElements.working.classList.add('hidden'); renderCompressorQueue();
}

async function addResizeItems(items) {
  const wasEmpty = resizer.items.length === 0;
  addUniqueItems(resizer, items);
  if (wasEmpty && resizer.items[0]) {
    try {
      const metadata = await window.arc.imageMetadata(resizer.items[0].path);
      if (metadata.width && metadata.height) {
        resizer.sourceRatio = metadata.width / metadata.height;
        resizeElements.width.value = metadata.width;
        resizeElements.height.value = metadata.height;
      }
    } catch { /* The backend reports invalid images during processing. */ }
  }
  updateResizeTarget(); renderResizeQueue();
}

async function chooseResizeFiles(folder = false) { await addResizeItems(folder ? await window.arc.selectFolder() : await window.arc.selectFiles()); }

function renderResizeQueue() {
  if (resizer.completed) return;
  const hasItems = resizer.items.length > 0;
  resizeElements.dropZone.classList.toggle('hidden', hasItems); resizeElements.queue.classList.toggle('hidden', !hasItems); resizeElements.summary.classList.add('hidden');
  resizeElements.start.disabled = !hasItems || resizer.running; resizeElements.clear.disabled = resizer.running; resizeElements.addMore.disabled = resizer.running;
  resizeElements.queueTitle.textContent = `${resizer.items.length.toLocaleString('pt-BR')} ${resizer.items.length === 1 ? 'imagem selecionada' : 'imagens selecionadas'}`;
  resizeElements.queueSubtitle.textContent = `Tamanho total: ${formatBytes(resizer.items.reduce((sum, item) => sum + item.size, 0))}`;
  resizeElements.fileList.innerHTML = resizer.items.map((item) => {
    const result = resizer.results.get(item.id);
    let status = 'Na fila', statusClass = '', value = targetText(), detail = item.path;
    if (result?.working) { status = 'Redimensionando'; statusClass = 'working'; }
    else if (result?.ok) { status = 'Pronta'; statusClass = 'success'; value = `${result.outputWidth} × ${result.outputHeight} px`; detail = `${result.originalWidth} × ${result.originalHeight} px → ${value}`; }
    else if (result?.error) { status = 'Falhou'; statusClass = 'error'; detail = result.error; value = '—'; }
    return fileRow(item, detail, value, status, statusClass);
  }).join('');
}

function currentPreset() { return presets[resizer.platform].find((preset) => preset.id === resizer.presetId) || presets[resizer.platform][0]; }

function targetText() {
  if (resizer.mode === 'percentage') return `${resizeElements.percentage.value || 50}% do original`;
  const preset = currentPreset();
  const width = resizer.mode === 'template' ? preset.width : resizeElements.width.value;
  const height = resizer.mode === 'template' ? preset.height : resizeElements.height.value;
  return `${width} × ${height} px`;
}

function updateResizeTarget() {
  resizeElements.targetLabel.textContent = targetText();
  resizeElements.targetDetail.textContent = resizer.mode === 'percentage' ? 'mantém a proporção original' : (resizer.lockRatio ? 'proporção preservada' : 'proporção livre');
  if (!resizer.completed) renderResizeQueue();
}

function setResizeMode(mode) {
  resizer.mode = mode;
  $$('.resize-mode-tab').forEach((button) => button.classList.toggle('active', button.dataset.resizeMode === mode));
  $('#dimensions-panel').classList.toggle('hidden', mode !== 'dimensions'); $('#percentage-panel').classList.toggle('hidden', mode !== 'percentage'); $('#template-panel').classList.toggle('hidden', mode !== 'template');
  resizeElements.modeHint.textContent = mode === 'dimensions' ? 'Informe largura e altura em pixels.' : mode === 'percentage' ? 'Reduza ou amplie mantendo as proporções.' : 'Escolha a rede e o formato desejado.';
  updateResizeTarget();
}

function setRatioLock(value) {
  resizer.lockRatio = value;
  for (const button of [resizeElements.ratioLock, resizeElements.templateRatioLock]) {
    button.classList.toggle('active', value); button.setAttribute('aria-pressed', String(value));
    const strong = button.querySelector('strong'), small = button.querySelector('small');
    if (button === resizeElements.ratioLock) { strong.textContent = value ? 'Proporção bloqueada' : 'Proporção livre'; small.textContent = value ? 'sem deformar' : 'largura e altura independentes'; }
    else { strong.textContent = value ? 'Preservar proporção' : 'Permitir distorção'; small.textContent = value ? 'preenche e recorta bordas se necessário' : 'força exatamente o formato'; }
  }
  updateResizeTarget();
}

function syncDimension(changed) {
  resizer.primaryDimension = changed;
  if (!resizer.lockRatio || !Number.isFinite(resizer.sourceRatio) || resizer.sourceRatio <= 0) return updateResizeTarget();
  if (changed === 'width') resizeElements.height.value = Math.max(1, Math.round(Number(resizeElements.width.value) / resizer.sourceRatio));
  else resizeElements.width.value = Math.max(1, Math.round(Number(resizeElements.height.value) * resizer.sourceRatio));
  updateResizeTarget();
}

function renderPresets() {
  const list = presets[resizer.platform];
  if (!list.some((preset) => preset.id === resizer.presetId)) resizer.presetId = list[0].id;
  resizeElements.presetGrid.innerHTML = list.map((preset) => `<button class="preset-card ${preset.id === resizer.presetId ? 'active' : ''}" data-preset="${preset.id}"><span class="preset-shape">${preset.icon}</span><span><strong>${preset.name}</strong><small>${preset.width} × ${preset.height} px</small></span></button>`).join('');
  $$('.preset-card').forEach((button) => button.addEventListener('click', () => { resizer.presetId = button.dataset.preset; renderPresets(); updateResizeTarget(); }));
  updateResizeTarget();
}

function resizeOptions() {
  const preset = currentPreset();
  return {
    mode: resizer.mode, lockRatio: resizer.lockRatio, primaryDimension: resizer.primaryDimension,
    width: resizer.mode === 'template' ? preset.width : Number(resizeElements.width.value),
    height: resizer.mode === 'template' ? preset.height : Number(resizeElements.height.value),
    percentage: Number(resizeElements.percentage.value)
  };
}

async function startResize() {
  if (resizer.running || !resizer.items.length) return;
  resizer.running = true; resizer.results.clear(); setResizeBusy(true);
  try {
    const response = await window.arc.resize({ items: resizer.items, outputRoot: resizer.outputRoot, options: resizeOptions() });
    resizer.batchPath = response.batchPath; resizer.completed = true; showResizeSummary(response.results, response.batchPath);
  } catch (error) { window.alert(error?.message || 'Não foi possível redimensionar este lote.'); }
  finally { resizer.running = false; setResizeBusy(false); }
}

function setResizeBusy(busy) {
  for (const element of [resizeElements.selectFiles, resizeElements.selectFolder, resizeElements.addMore, resizeElements.selectOutput, resizeElements.clear]) element.disabled = busy;
  resizeElements.start.disabled = busy || !resizer.items.length || resizer.completed;
  resizeElements.progressWrap.classList.toggle('hidden', !busy); resizeElements.working.classList.toggle('hidden', !busy);
  if (busy) { resizeElements.progressBar.style.width = '0%'; resizeElements.progressText.textContent = `0 de ${resizer.items.length}`; }
  renderResizeQueue();
}

function showResizeSummary(results, batchPath) {
  const successful = results.filter((result) => result.ok), failed = results.length - successful.length;
  resizeElements.queue.classList.add('hidden'); resizeElements.dropZone.classList.add('hidden'); resizeElements.summary.classList.remove('hidden'); resizeElements.working.classList.add('hidden');
  resizeElements.processedCount.textContent = successful.length.toLocaleString('pt-BR');
  const first = successful[0]; resizeElements.resultSize.textContent = first ? `${first.outputWidth} × ${first.outputHeight}` : '—';
  resizeElements.summaryText.textContent = failed ? `${successful.length} imagens prontas e ${failed} não puderam ser processadas.` : 'Tudo pronto. As imagens foram salvas em uma pasta exclusiva.';
  resizeElements.summaryPath.textContent = batchPath; resizeElements.summaryPath.title = batchPath;
}

function resetResize() {
  Object.assign(resizer, { items: [], batchPath: '', completed: false }); resizer.results.clear();
  resizeElements.progressWrap.classList.add('hidden'); resizeElements.working.classList.add('hidden'); renderResizeQueue();
}

function wireDropZone(element, addCallback) {
  for (const eventName of ['dragenter', 'dragover']) element.addEventListener(eventName, (event) => { event.preventDefault(); element.classList.add('dragging'); });
  for (const eventName of ['dragleave', 'drop']) element.addEventListener(eventName, (event) => { event.preventDefault(); element.classList.remove('dragging'); });
  element.addEventListener('drop', async (event) => {
    const paths = [...event.dataTransfer.files].map((file) => window.arc.getPathForFile(file)).filter(Boolean);
    if (paths.length) addCallback(await window.arc.addPaths(paths));
  });
}

$$('.tool-tab').forEach((button) => button.addEventListener('click', () => {
  const tool = button.dataset.tool;
  $$('.tool-tab').forEach((tab) => { const active = tab === button; tab.classList.toggle('active', active); tab.setAttribute('aria-pressed', String(active)); });
  $('#compressor-view').classList.toggle('hidden', tool !== 'compressor'); $('#resizer-view').classList.toggle('hidden', tool !== 'resizer');
  $('#brand-logo').src = tool === 'compressor' ? 'assets/logo-compressor.png' : 'assets/logo-resizer.png';
  $('#brand-logo').alt = tool === 'compressor' ? 'ARC Image Compressor' : 'ARC Image Resizer';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}));

compressorElements.selectFiles.addEventListener('click', () => chooseCompressorFiles(false)); compressorElements.addMore.addEventListener('click', () => chooseCompressorFiles(false)); compressorElements.selectFolder.addEventListener('click', () => chooseCompressorFiles(true));
compressorElements.selectOutput.addEventListener('click', () => chooseOutput(compressor, compressorElements.outputPath)); compressorElements.start.addEventListener('click', startOptimization); compressorElements.clear.addEventListener('click', resetCompressor); compressorElements.newBatch.addEventListener('click', resetCompressor); compressorElements.openOutput.addEventListener('click', () => window.arc.showOutput(compressor.batchPath || compressor.outputRoot));
wireDropZone(compressorElements.dropZone, (items) => { addUniqueItems(compressor, items); renderCompressorQueue(); });

resizeElements.selectFiles.addEventListener('click', () => chooseResizeFiles(false)); resizeElements.addMore.addEventListener('click', () => chooseResizeFiles(false)); resizeElements.selectFolder.addEventListener('click', () => chooseResizeFiles(true));
resizeElements.selectOutput.addEventListener('click', () => chooseOutput(resizer, resizeElements.outputPath)); resizeElements.start.addEventListener('click', startResize); resizeElements.clear.addEventListener('click', resetResize); resizeElements.newBatch.addEventListener('click', resetResize); resizeElements.openOutput.addEventListener('click', () => window.arc.showOutput(resizer.batchPath || resizer.outputRoot));
wireDropZone(resizeElements.dropZone, addResizeItems);

$$('.resize-mode-tab').forEach((button) => button.addEventListener('click', () => setResizeMode(button.dataset.resizeMode)));
resizeElements.ratioLock.addEventListener('click', () => setRatioLock(!resizer.lockRatio)); resizeElements.templateRatioLock.addEventListener('click', () => setRatioLock(!resizer.lockRatio));
resizeElements.width.addEventListener('input', () => syncDimension('width')); resizeElements.height.addEventListener('input', () => syncDimension('height'));
resizeElements.percentage.addEventListener('input', () => { resizeElements.percentageRange.value = Math.min(200, Number(resizeElements.percentage.value) || 1); updateResizeTarget(); });
resizeElements.percentageRange.addEventListener('input', () => { resizeElements.percentage.value = resizeElements.percentageRange.value; updateResizeTarget(); });
$$('[data-percentage]').forEach((button) => button.addEventListener('click', () => { resizeElements.percentage.value = button.dataset.percentage; resizeElements.percentageRange.value = Math.min(200, Number(button.dataset.percentage)); $$('[data-percentage]').forEach((item) => item.classList.toggle('active', item === button)); updateResizeTarget(); }));
$$('[data-platform]').forEach((button) => button.addEventListener('click', () => { resizer.platform = button.dataset.platform; resizer.presetId = presets[resizer.platform][0].id; $$('[data-platform]').forEach((item) => item.classList.toggle('active', item === button)); renderPresets(); }));

window.arc.onProgress((progress) => { compressor.results.set(progress.id, progress); const done = progress.index + 1; compressorElements.progressBar.style.width = `${done / progress.total * 100}%`; compressorElements.progressText.textContent = `${done} de ${progress.total}`; if (!compressor.completed) renderCompressorQueue(); });
window.arc.onStarted(({ id }) => { if (!compressor.completed) { compressor.results.set(id, { working: true }); renderCompressorQueue(); } });
window.arc.onResizeProgress((progress) => { resizer.results.set(progress.id, progress); const done = progress.index + 1; resizeElements.progressBar.style.width = `${done / progress.total * 100}%`; resizeElements.progressText.textContent = `${done} de ${progress.total}`; if (!resizer.completed) renderResizeQueue(); });
window.arc.onResizeStarted(({ id }) => { if (!resizer.completed) { resizer.results.set(id, { working: true }); renderResizeQueue(); } });

window.arc.defaultOutput().then((outputPath) => { compressor.outputRoot = outputPath; resizer.outputRoot = outputPath; compressorElements.outputPath.value = outputPath; resizeElements.outputPath.value = outputPath; });
renderPresets(); updateResizeTarget();
