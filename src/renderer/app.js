const compressor = { items: [], outputRoot: '', batchPath: '', running: false, completed: false, results: new Map() };
const resizer = {
  items: [], outputRoot: '', batchPath: '', running: false, completed: false, results: new Map(),
  mode: 'dimensions', lockRatio: true, sourceRatio: 1, primaryDimension: 'width', platform: 'instagram', presetId: 'instagram-square', selectedItemId: ''
};
const metadataCleaner = {
  items: [], outputRoot: '', batchPath: '', running: false, completed: false,
  results: new Map(), analysis: new Map(), preserveColorProfile: true, analyzing: false,
  selectedItemId: '', groupFilter: 'all', search: ''
};

const presets = {
  instagram: [
    { id: 'instagram-square', name: 'Post quadrado', width: 1080, height: 1080, kind: 'square' },
    { id: 'instagram-portrait', name: 'Post retrato', width: 1080, height: 1350, kind: 'portrait' },
    { id: 'instagram-story', name: 'Story / Reels', width: 1080, height: 1920, kind: 'vertical' },
    { id: 'instagram-profile', name: 'Foto de perfil', width: 320, height: 320, kind: 'profile' }
  ],
  facebook: [
    { id: 'facebook-cover', name: 'Capa', width: 851, height: 315, kind: 'cover' },
    { id: 'facebook-feed', name: 'Post / link', width: 1200, height: 630, kind: 'landscape' },
    { id: 'facebook-square', name: 'Post / anúncio', width: 1080, height: 1080, kind: 'square' },
    { id: 'facebook-profile', name: 'Foto de perfil', width: 320, height: 320, kind: 'profile' }
  ],
  x: [
    { id: 'x-header', name: 'Capa do perfil', width: 1500, height: 500, kind: 'cover' },
    { id: 'x-post', name: 'Post horizontal', width: 1600, height: 900, kind: 'landscape' },
    { id: 'x-square', name: 'Post quadrado', width: 1080, height: 1080, kind: 'square' },
    { id: 'x-profile', name: 'Foto de perfil', width: 400, height: 400, kind: 'profile' }
  ],
  tiktok: [
    { id: 'tiktok-video', name: 'Vídeo / post', width: 1080, height: 1920, kind: 'vertical' },
    { id: 'tiktok-cover', name: 'Capa vertical', width: 1080, height: 1920, kind: 'portrait' },
    { id: 'tiktok-profile', name: 'Foto de perfil', width: 200, height: 200, kind: 'profile' }
  ],
  linkedin: [
    { id: 'linkedin-cover', name: 'Capa do perfil', width: 1584, height: 396, kind: 'cover' },
    { id: 'linkedin-post', name: 'Post / link', width: 1200, height: 627, kind: 'landscape' },
    { id: 'linkedin-square', name: 'Post quadrado', width: 1080, height: 1080, kind: 'square' },
    { id: 'linkedin-profile', name: 'Foto de perfil', width: 400, height: 400, kind: 'profile' }
  ],
  youtube: [
    { id: 'youtube-thumbnail', name: 'Thumbnail', width: 1280, height: 720, kind: 'landscape' },
    { id: 'youtube-banner', name: 'Banner do canal', width: 2560, height: 1440, kind: 'cover' },
    { id: 'youtube-short', name: 'Short', width: 1080, height: 1920, kind: 'vertical' },
    { id: 'youtube-profile', name: 'Foto do canal', width: 800, height: 800, kind: 'profile' }
  ]
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const thumbnailCache = new Map();
const metadataCache = new Map();
let resizePreviewTimer = null;
let resizePreviewRequest = 0;

const thumbnailObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    thumbnailObserver.unobserve(entry.target);
    loadThumbnail(entry.target);
  }
}, { rootMargin: '100px' });

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
  ratioLockInput: $('#ratio-lock-input'), templateRatioLock: $('#template-ratio-lock'), templateRatioLockInput: $('#template-ratio-lock-input'),
  targetLabel: $('#resize-target-label'), targetDetail: $('#resize-target-detail'), modeHint: $('#resize-mode-hint'), presetGrid: $('#preset-grid'),
  previewImage: $('#resize-preview-image'), previewPlaceholder: $('#resize-preview-placeholder'), previewName: $('#resize-preview-name'), previewMeta: $('#resize-preview-meta'),
  previewBadge: $('#resize-preview-badge'), previewRefresh: $('#refresh-resize-preview')
};

const metadataElements = {
  selectFiles: $('#metadata-select-files'), selectFolder: $('#metadata-select-folder'), addMore: $('#metadata-add-more'),
  selectOutput: $('#metadata-select-output'), outputPath: $('#metadata-output-path'), start: $('#metadata-start'), clear: $('#metadata-clear'),
  dropZone: $('#metadata-drop-zone'), queue: $('#metadata-queue'), queueTitle: $('#metadata-queue-title'), queueSubtitle: $('#metadata-queue-subtitle'),
  fileList: $('#metadata-file-list'), progressWrap: $('#metadata-progress-wrap'), progressBar: $('#metadata-progress-bar'),
  progressText: $('#metadata-progress-text'), working: $('#metadata-working-animation'), summary: $('#metadata-summary'),
  summaryText: $('#metadata-summary-text'), summaryPath: $('#metadata-summary-path'), cleanedCount: $('#metadata-cleaned-count'),
  alreadyCleanCount: $('#metadata-already-clean-count'), processedCount: $('#metadata-processed-count'), openOutput: $('#metadata-open-output'),
  newBatch: $('#metadata-new-batch'), colorProfile: $('#metadata-color-profile'), colorProfileInput: $('#metadata-color-profile-input'),
  inspectorEmpty: $('#metadata-inspector-empty'), inspectorContent: $('#metadata-inspector-content'), inspectorName: $('#metadata-inspector-name'),
  inspectorSummary: $('#metadata-inspector-summary'), totalBadge: $('#metadata-total-badge'), aiCard: $('#metadata-ai-card'),
  aiLabel: $('#metadata-ai-label'), aiDetail: $('#metadata-ai-detail'), locationLabel: $('#metadata-location-label'),
  locationDetail: $('#metadata-location-detail'), deviceLabel: $('#metadata-device-label'), dateDetail: $('#metadata-date-detail'),
  health: $('#metadata-health'), healthLabel: $('#metadata-health-label'), healthDetail: $('#metadata-health-detail'),
  evidence: $('#metadata-evidence'), searchInput: $('#metadata-search-input'), groupFilter: $('#metadata-group-filter'),
  visibleCount: $('#metadata-visible-count'), details: $('#metadata-details')
};

const updateElements = {
  button: $('#update-button'), buttonLabel: $('#update-button-label'), notice: $('#update-notice'),
  kicker: $('#update-notice-kicker'), title: $('#update-notice-title'), detail: $('#update-notice-detail'),
  progress: $('#update-progress'), progressBar: $('#update-progress-bar'), action: $('#update-action'), dismiss: $('#update-dismiss')
};
let updateUiState = { status: 'idle', currentVersion: '2.3.0', availableVersion: '', percent: 0, showNotice: false };
let dismissedUpdateStatus = '';

function renderUpdateState(state) {
  const previousStatus = updateUiState.status;
  updateUiState = { ...updateUiState, ...state };
  if (previousStatus !== updateUiState.status && ['available', 'downloading', 'installing', 'error'].includes(updateUiState.status)) dismissedUpdateStatus = '';
  const { status, currentVersion, availableVersion, percent = 0, message = '' } = updateUiState;
  updateElements.button.className = `update-button ${status}`;
  updateElements.button.disabled = ['checking', 'downloading', 'installing'].includes(status);
  updateElements.button.title = status === 'available' ? `Atualizar para ${availableVersion}` : 'Verificar atualizações';

  if (status === 'available') updateElements.buttonLabel.textContent = `Atualização v${availableVersion}`;
  else if (status === 'downloading') updateElements.buttonLabel.textContent = `Baixando ${Math.round(percent)}%`;
  else if (status === 'installing') updateElements.buttonLabel.textContent = 'Reiniciando…';
  else if (status === 'checking') updateElements.buttonLabel.textContent = 'Verificando…';
  else if (status === 'up-to-date') updateElements.buttonLabel.textContent = `v${currentVersion} · atual`;
  else updateElements.buttonLabel.textContent = `v${currentVersion}`;

  const noticeVisible = updateUiState.showNotice && dismissedUpdateStatus !== status;
  updateElements.notice.classList.toggle('hidden', !noticeVisible);
  updateElements.progress.classList.toggle('hidden', !['downloading', 'installing'].includes(status));
  updateElements.progressBar.style.width = `${status === 'installing' ? 100 : Math.max(0, Math.min(100, percent))}%`;
  updateElements.action.classList.toggle('hidden', !['available', 'error'].includes(status));
  updateElements.action.disabled = !['available', 'error'].includes(status);

  if (status === 'available') {
    updateElements.kicker.textContent = 'ATUALIZAÇÃO DISPONÍVEL';
    updateElements.title.textContent = `ARC Image Studio v${availableVersion}`;
    updateElements.detail.textContent = 'Um clique baixa, substitui a versão atual e abre o aplicativo novamente.';
    updateElements.action.textContent = 'Atualizar agora';
  } else if (status === 'downloading') {
    updateElements.kicker.textContent = 'BAIXANDO ATUALIZAÇÃO';
    updateElements.title.textContent = `${Math.round(percent)}% concluído`;
    updateElements.detail.textContent = updateUiState.total ? `${formatBytes(updateUiState.transferred)} de ${formatBytes(updateUiState.total)}` : message;
  } else if (status === 'installing') {
    updateElements.kicker.textContent = 'TUDO PRONTO';
    updateElements.title.textContent = 'Instalando e reiniciando…';
    updateElements.detail.textContent = 'O aplicativo abrirá novamente em instantes.';
  } else if (status === 'error') {
    updateElements.kicker.textContent = 'ATUALIZAÇÃO NÃO CONCLUÍDA';
    updateElements.title.textContent = 'Não foi possível atualizar';
    updateElements.detail.textContent = message;
    updateElements.action.textContent = 'Tentar novamente';
  } else if (status === 'up-to-date') {
    updateElements.kicker.textContent = 'APLICATIVO ATUALIZADO';
    updateElements.title.textContent = `Você já está na versão ${currentVersion}`;
    updateElements.detail.textContent = message;
  } else if (status === 'development') {
    updateElements.kicker.textContent = 'MODO DE DESENVOLVIMENTO';
    updateElements.title.textContent = 'Atualizador disponível no instalador';
    updateElements.detail.textContent = message;
  }
}

async function loadThumbnail(image) {
  const sourcePath = image.dataset.path;
  if (!sourcePath) return;
  try {
    let preview = thumbnailCache.get(sourcePath);
    if (!preview) {
      preview = window.arc.imagePreview(sourcePath, 96, 96);
      thumbnailCache.set(sourcePath, preview);
    }
    image.src = await preview;
    image.classList.add('loaded');
  } catch {
    image.closest('.file-thumb')?.classList.add('unavailable');
  }
}

function observeThumbnails(container) {
  container.querySelectorAll('img[data-path]').forEach((image) => thumbnailObserver.observe(image));
}

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
    return fileRow(item, detail, size, status, statusClass, { thumbnail: true });
  }).join('');
  observeThumbnails(compressorElements.fileList);
}

function fileRow(item, detail, value, status, statusClass, options = {}) {
  const thumbnail = options.thumbnail
    ? `<span class="file-thumb"><img data-path="${escapeHtml(item.path)}" alt="" loading="lazy"><span class="thumb-fallback">▧</span></span>`
    : '';
  const activeClass = options.active ? ' selected' : '';
  const itemId = options.selectable ? ` data-item-id="${escapeHtml(item.id)}"` : '';
  return `<div class="file-row${options.thumbnail ? ' has-thumbnail' : ''}${options.selectable ? ' selectable' : ''}${activeClass}"${itemId}>${thumbnail}<div class="file-info"><div class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div><div class="file-detail" title="${escapeHtml(detail)}">${escapeHtml(detail)}</div></div><div class="file-size">${escapeHtml(value)}</div><div class="file-status ${statusClass}">${escapeHtml(status)}</div></div>`;
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
    resizer.selectedItemId = resizer.items[0].id;
    await loadResizePreview(resizer.items[0], true);
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
    return fileRow(item, detail, value, status, statusClass, { selectable: true, active: item.id === resizer.selectedItemId });
  }).join('');
  resizeElements.fileList.querySelectorAll('[data-item-id]').forEach((row) => row.addEventListener('click', () => {
    const item = resizer.items.find((candidate) => candidate.id === row.dataset.itemId);
    if (!item || item.id === resizer.selectedItemId) return;
    resizer.selectedItemId = item.id;
    renderResizeQueue();
    loadResizePreview(item, true);
  }));
}

async function loadResizePreview(item, syncDimensions = false) {
  if (!item) return;
  resizeElements.previewName.textContent = item.name;
  resizeElements.previewMeta.textContent = 'Preparando simulação…';
  resizeElements.previewImage.classList.add('hidden');
  resizeElements.previewPlaceholder.classList.remove('hidden');
  try {
    let metadata = metadataCache.get(item.path);
    if (!metadata) {
      metadata = await window.arc.imageMetadata(item.path);
      metadataCache.set(item.path, metadata);
    }
    if (resizer.selectedItemId !== item.id) return;
    if (syncDimensions && metadata.width && metadata.height) {
      resizer.sourceRatio = metadata.width / metadata.height;
      resizeElements.width.value = metadata.width;
      resizeElements.height.value = metadata.height;
      resizer.primaryDimension = 'width';
      updateResizeTarget();
    }
    await refreshResizePreview(item, metadata);
  } catch {
    if (resizer.selectedItemId !== item.id) return;
    resizeElements.previewMeta.textContent = 'Preview indisponível';
    resizeElements.previewPlaceholder.querySelector('span').textContent = 'Não foi possível exibir esta imagem';
  }
}

async function refreshResizePreview(item = resizer.items.find((candidate) => candidate.id === resizer.selectedItemId), knownMetadata = null) {
  if (!item) return;
  const request = ++resizePreviewRequest;
  clearTimeout(resizePreviewTimer);
  resizeElements.previewImage.classList.add('updating');
  resizeElements.previewBadge.textContent = 'ATUALIZANDO';
  resizeElements.previewRefresh.disabled = true;
  try {
    let metadata = knownMetadata || metadataCache.get(item.path);
    if (!metadata) {
      metadata = await window.arc.imageMetadata(item.path);
      metadataCache.set(item.path, metadata);
    }
    const preview = await window.arc.resizePreview(item.path, resizeOptions(), 900, 620);
    if (request !== resizePreviewRequest || resizer.selectedItemId !== item.id) return;
    resizeElements.previewImage.src = preview.dataUrl;
    resizeElements.previewImage.classList.remove('hidden');
    resizeElements.previewPlaceholder.classList.add('hidden');
    resizeElements.previewMeta.textContent = `${metadata.width} × ${metadata.height} px → ${preview.outputWidth} × ${preview.outputHeight} px`;
    resizeElements.previewBadge.textContent = 'RESULTADO';
  } catch (error) {
    if (request !== resizePreviewRequest) return;
    resizeElements.previewMeta.textContent = error?.message || 'Preview indisponível';
    resizeElements.previewBadge.textContent = 'INDISPONÍVEL';
  } finally {
    if (request === resizePreviewRequest) {
      resizeElements.previewImage.classList.remove('updating');
      resizeElements.previewRefresh.disabled = false;
    }
  }
}

function scheduleResizePreview(delay = 160) {
  clearTimeout(resizePreviewTimer);
  if (!resizer.selectedItemId || resizer.running || resizer.completed) return;
  resizeElements.previewBadge.textContent = 'AGUARDANDO';
  resizePreviewTimer = setTimeout(() => refreshResizePreview(), delay);
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
  scheduleResizePreview(0);
}

function setRatioLock(value) {
  resizer.lockRatio = value;
  resizeElements.ratioLockInput.checked = value;
  resizeElements.templateRatioLockInput.checked = value;
  for (const control of [resizeElements.ratioLock, resizeElements.templateRatioLock]) {
    control.classList.toggle('active', value);
    const strong = control.querySelector('strong'), small = control.querySelector('small');
    if (control === resizeElements.ratioLock) { strong.textContent = 'Bloquear proporção'; small.textContent = value ? 'ativado · evita deformações' : 'desativado · dimensões independentes'; }
    else { strong.textContent = 'Preservar proporção'; small.textContent = value ? 'ativada · preenche sem deformar' : 'desativada · pode distorcer a imagem'; }
  }
  updateResizeTarget();
  scheduleResizePreview(0);
}

function syncDimension(changed) {
  resizer.primaryDimension = changed;
  if (resizer.lockRatio && Number.isFinite(resizer.sourceRatio) && resizer.sourceRatio > 0) {
    if (changed === 'width') resizeElements.height.value = Math.max(1, Math.round(Number(resizeElements.width.value) / resizer.sourceRatio));
    else resizeElements.width.value = Math.max(1, Math.round(Number(resizeElements.height.value) * resizer.sourceRatio));
  }
  updateResizeTarget();
  scheduleResizePreview();
}

function renderPresets() {
  const list = presets[resizer.platform];
  if (!list.some((preset) => preset.id === resizer.presetId)) resizer.presetId = list[0].id;
  resizeElements.presetGrid.innerHTML = list.map((preset) => `<button class="preset-card ${preset.id === resizer.presetId ? 'active' : ''}" data-preset="${preset.id}"><span class="preset-shape">${presetIcon(preset.kind)}</span><span><strong>${preset.name}</strong><small>${preset.width} × ${preset.height} px</small></span></button>`).join('');
  $$('.preset-card').forEach((button) => button.addEventListener('click', () => { resizer.presetId = button.dataset.preset; renderPresets(); updateResizeTarget(); scheduleResizePreview(0); }));
  updateResizeTarget();
}

function presetIcon(kind) {
  const common = '<path class="preset-mountain" d="m7 20 5-5 4 4 3-3 5 5"/><circle class="preset-sun" cx="20" cy="10" r="2"/>';
  if (kind === 'profile') return '<svg viewBox="0 0 32 32"><circle class="preset-frame" cx="16" cy="16" r="11"/><circle class="preset-person" cx="16" cy="13" r="4"/><path class="preset-person" d="M9.5 24c1.2-4 3.4-6 6.5-6s5.3 2 6.5 6"/></svg>';
  const frames = {
    cover: '<rect class="preset-frame" x="3" y="9" width="26" height="14" rx="2"/>',
    landscape: '<rect class="preset-frame" x="4" y="7" width="24" height="18" rx="2"/>',
    square: '<rect class="preset-frame" x="5" y="5" width="22" height="22" rx="2"/>',
    portrait: '<rect class="preset-frame" x="7" y="3" width="18" height="26" rx="2"/>',
    vertical: '<rect class="preset-frame" x="9" y="2" width="14" height="28" rx="2"/>'
  };
  return `<svg viewBox="0 0 32 32">${frames[kind] || frames.square}${common}</svg>`;
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
  clearTimeout(resizePreviewTimer); resizePreviewRequest += 1;
  Object.assign(resizer, { items: [], batchPath: '', completed: false, selectedItemId: '' }); resizer.results.clear();
  resizeElements.previewImage.removeAttribute('src'); resizeElements.previewImage.classList.add('hidden'); resizeElements.previewPlaceholder.classList.remove('hidden');
  resizeElements.previewName.textContent = 'Imagem selecionada'; resizeElements.previewMeta.textContent = 'Clique em um arquivo para visualizar'; resizeElements.previewBadge.textContent = 'RESULTADO'; resizeElements.previewRefresh.disabled = false;
  resizeElements.progressWrap.classList.add('hidden'); resizeElements.working.classList.add('hidden'); renderResizeQueue();
}

function removableMetadataTypes(analysis) {
  if (!analysis?.ok) return [];
  return analysis.types.filter((type) => !(metadataCleaner.preserveColorProfile && type.id === 'icc'));
}

function metadataDetailSummary(analysis) {
  if (!analysis?.ok) return '';
  const format = String(analysis.format || '').toUpperCase();
  const software = analysis.origin?.software ? ` · ${analysis.origin.software}` : '';
  return `${analysis.width} × ${analysis.height} px · ${format} · ${analysis.detailCount.toLocaleString('pt-BR')} metadados${software}`;
}

function renderMetadataInspector() {
  const item = metadataCleaner.items.find((candidate) => candidate.id === metadataCleaner.selectedItemId);
  const analysis = item ? metadataCleaner.analysis.get(item.id) : null;
  const ready = Boolean(item && analysis?.ok);
  metadataElements.inspectorEmpty.classList.toggle('hidden', ready);
  metadataElements.inspectorContent.classList.toggle('hidden', !ready);
  if (!item) return;
  if (!analysis) {
    metadataElements.inspectorEmpty.querySelector('strong').textContent = 'Analisando a imagem…';
    metadataElements.inspectorEmpty.querySelector('span').textContent = 'Os metadados aparecerão aqui.';
    return;
  }
  if (!analysis.ok) {
    metadataElements.inspectorEmpty.querySelector('strong').textContent = 'Análise indisponível';
    metadataElements.inspectorEmpty.querySelector('span').textContent = analysis.error || 'Não foi possível ler os metadados.';
    return;
  }

  metadataElements.inspectorName.textContent = item.name;
  metadataElements.inspectorSummary.textContent = metadataDetailSummary(analysis);
  metadataElements.totalBadge.textContent = `${analysis.detailCount.toLocaleString('pt-BR')} ${analysis.detailCount === 1 ? 'METADADO' : 'METADADOS'}`;

  const health = analysis.metadataHealth;
  metadataElements.health.classList.remove('missing', 'partial', 'complete');
  metadataElements.health.classList.toggle('hidden', !health || health.status === 'complete');
  if (health) {
    metadataElements.health.classList.add(health.status);
    metadataElements.healthLabel.textContent = health.label;
    metadataElements.healthDetail.textContent = health.detail;
  }

  const ai = analysis.ai;
  metadataElements.aiCard.classList.remove('detected', 'possible', 'unknown');
  metadataElements.aiCard.classList.add(ai.status);
  metadataElements.aiLabel.textContent = ai.label;
  metadataElements.aiDetail.textContent = ai.generator ? `${ai.generator} · confiança ${ai.confidence}` : `confiança ${ai.confidence}`;
  metadataElements.evidence.classList.toggle('hidden', !ai.evidence?.length);
  metadataElements.evidence.innerHTML = ai.evidence?.length
    ? `<strong>Evidências da origem</strong>${ai.evidence.map((evidence) => `<span>${escapeHtml(evidence)}</span>`).join('')}`
    : '';

  const location = analysis.origin?.location;
  metadataElements.locationLabel.textContent = location ? `${location.latitude}, ${location.longitude}` : 'GPS não veio no arquivo';
  metadataElements.locationDetail.textContent = location?.altitude ? `Altitude: ${location.altitude}` : 'O arquivo não contém coordenadas incorporadas';
  const deviceParts = [analysis.origin?.device, analysis.origin?.lens].filter(Boolean);
  metadataElements.deviceLabel.textContent = deviceParts.join(' · ') || 'Modelo não veio no arquivo';
  metadataElements.dateDetail.textContent = analysis.origin?.capturedAt || (analysis.origin?.author ? `Autor: ${analysis.origin.author}` : 'O arquivo não contém dados da câmera');

  const groupCounts = new Map();
  for (const detail of analysis.details) groupCounts.set(detail.group, (groupCounts.get(detail.group) || 0) + 1);
  if (metadataCleaner.groupFilter !== 'all' && !groupCounts.has(metadataCleaner.groupFilter)) metadataCleaner.groupFilter = 'all';
  metadataElements.groupFilter.innerHTML = [
    `<button class="${metadataCleaner.groupFilter === 'all' ? 'active' : ''}" data-metadata-group="all">Todos <span>${analysis.detailCount}</span></button>`,
    ...[...groupCounts.entries()].map(([group, count]) => `<button class="${metadataCleaner.groupFilter === group ? 'active' : ''}" data-metadata-group="${escapeHtml(group)}">${escapeHtml(group)} <span>${count}</span></button>`)
  ].join('');
  metadataElements.groupFilter.querySelectorAll('[data-metadata-group]').forEach((button) => button.addEventListener('click', () => {
    metadataCleaner.groupFilter = button.dataset.metadataGroup;
    renderMetadataInspector();
  }));

  const query = metadataCleaner.search.trim().toLocaleLowerCase('pt-BR');
  const visible = analysis.details.filter((detail) => {
    if (metadataCleaner.groupFilter !== 'all' && detail.group !== metadataCleaner.groupFilter) return false;
    return !query || `${detail.group} ${detail.name} ${detail.value}`.toLocaleLowerCase('pt-BR').includes(query);
  });
  const grouped = new Map();
  for (const detail of visible) {
    if (!grouped.has(detail.group)) grouped.set(detail.group, []);
    grouped.get(detail.group).push(detail);
  }
  metadataElements.visibleCount.textContent = `${visible.length.toLocaleString('pt-BR')} ${visible.length === 1 ? 'item' : 'itens'}`;
  metadataElements.details.innerHTML = visible.length ? [...grouped.entries()].map(([group, details]) => `
    <section class="metadata-detail-group"><h4><span>${escapeHtml(group)}</span><small>${details.length}</small></h4>${details.map((detail) => `
      <div class="metadata-detail-row"><div><strong>${escapeHtml(detail.name)}</strong>${detail.id ? `<small>${escapeHtml(detail.id)}</small>` : ''}</div><span title="${escapeHtml(detail.value)}">${escapeHtml(detail.value)}</span></div>`).join('')}
    </section>`).join('') : '<div class="metadata-no-results">Nenhum metadado corresponde à pesquisa.</div>';
}

function renderMetadataQueue() {
  if (metadataCleaner.completed) return;
  const hasItems = metadataCleaner.items.length > 0;
  metadataElements.dropZone.classList.toggle('hidden', hasItems);
  metadataElements.queue.classList.toggle('hidden', !hasItems);
  metadataElements.summary.classList.add('hidden');
  metadataElements.start.disabled = !hasItems || metadataCleaner.running || metadataCleaner.analyzing;
  metadataElements.clear.disabled = metadataCleaner.running;
  metadataElements.addMore.disabled = metadataCleaner.running;
  metadataElements.queueTitle.textContent = `${metadataCleaner.items.length.toLocaleString('pt-BR')} ${metadataCleaner.items.length === 1 ? 'imagem selecionada' : 'imagens selecionadas'}`;
  const analyzed = metadataCleaner.items.filter((item) => metadataCleaner.analysis.get(item.id)?.ok);
  const exposed = analyzed.filter((item) => removableMetadataTypes(metadataCleaner.analysis.get(item.id)).length).length;
  metadataElements.queueSubtitle.textContent = metadataCleaner.analyzing
    ? `Analisando dados ocultos… ${analyzed.length} de ${metadataCleaner.items.length}`
    : `${exposed.toLocaleString('pt-BR')} ${exposed === 1 ? 'imagem contém dados removíveis' : 'imagens contêm dados removíveis'}`;
  metadataElements.fileList.innerHTML = metadataCleaner.items.map((item) => {
    const analysis = metadataCleaner.analysis.get(item.id);
    const result = metadataCleaner.results.get(item.id);
    let status = analysis ? 'Pronta para limpar' : 'Analisando';
    let statusClass = analysis ? '' : 'working';
    let detail = item.path;
    if (analysis?.error) { status = 'Falhou na análise'; statusClass = 'error'; detail = analysis.error; }
    if (analysis?.ok) detail = metadataDetailSummary(analysis);
    if (result?.working) { status = 'Limpando'; statusClass = 'working'; }
    else if (result?.ok) {
      status = result.hadAiSignals && result.aiSignalsRemoved ? 'IA removida' : (result.alreadyClean ? 'Já protegida' : 'Limpa');
      statusClass = 'success';
      detail = result.hadAiSignals && result.aiSignalsRemoved
        ? `${result.filenameAnonymized ? 'Nome revelador neutralizado; ' : ''}rastros de IA, software gerador e C2PA removidos e verificados`
        : (result.alreadyClean ? 'Nenhum dado selecionado para remover' : `${result.removedTypes.join(', ')} removidos`);
    }
    else if (result?.error) { status = 'Falhou'; statusClass = 'error'; detail = result.error; }
    const active = item.id === metadataCleaner.selectedItemId ? ' selected' : '';
    return `<div class="file-row has-thumbnail metadata-row selectable${active}" data-item-id="${escapeHtml(item.id)}"><span class="file-thumb"><img data-path="${escapeHtml(item.path)}" alt="" loading="lazy"><span class="thumb-fallback">▧</span></span><div class="file-info"><div class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div><div class="file-detail" title="${escapeHtml(detail)}">${escapeHtml(detail)}</div></div><div class="file-status ${statusClass}">${escapeHtml(status)}</div></div>`;
  }).join('');
  observeThumbnails(metadataElements.fileList);
  metadataElements.fileList.querySelectorAll('[data-item-id]').forEach((row) => row.addEventListener('click', () => {
    metadataCleaner.selectedItemId = row.dataset.itemId;
    metadataCleaner.groupFilter = 'all';
    metadataCleaner.search = '';
    metadataElements.searchInput.value = '';
    renderMetadataQueue();
  }));
  renderMetadataInspector();
}

async function addMetadataItems(items) {
  const knownIds = new Set(metadataCleaner.items.map((item) => item.id));
  addUniqueItems(metadataCleaner, items);
  if (!metadataCleaner.selectedItemId && metadataCleaner.items[0]) metadataCleaner.selectedItemId = metadataCleaner.items[0].id;
  const pending = metadataCleaner.items.filter((item) => !knownIds.has(item.id) && !metadataCleaner.analysis.has(item.id));
  renderMetadataQueue();
  if (!pending.length) return;
  metadataCleaner.analyzing = true;
  renderMetadataQueue();
  try {
    const analyses = await window.arc.inspectMetadata(pending);
    for (const analysis of analyses) {
      if (metadataCleaner.items.some((item) => item.id === analysis.id)) metadataCleaner.analysis.set(analysis.id, analysis);
    }
  } catch (error) {
    for (const item of pending) metadataCleaner.analysis.set(item.id, { id: item.id, ok: false, error: error?.message || 'Não foi possível analisar a imagem.' });
  } finally {
    metadataCleaner.analyzing = false;
    renderMetadataQueue();
  }
}

async function chooseMetadataFiles(folder = false) {
  await addMetadataItems(folder ? await window.arc.selectFolder() : await window.arc.selectFiles());
}

async function startMetadataCleaning() {
  if (metadataCleaner.running || metadataCleaner.analyzing || !metadataCleaner.items.length) return;
  metadataCleaner.running = true;
  metadataCleaner.results.clear();
  setMetadataBusy(true);
  try {
    const response = await window.arc.cleanMetadata({
      items: metadataCleaner.items,
      outputRoot: metadataCleaner.outputRoot,
      preserveColorProfile: metadataCleaner.preserveColorProfile
    });
    metadataCleaner.batchPath = response.batchPath;
    metadataCleaner.completed = true;
    showMetadataSummary(response.results, response.batchPath);
  } catch (error) {
    window.alert(error?.message || 'Não foi possível limpar os metadados deste lote.');
  } finally {
    metadataCleaner.running = false;
    setMetadataBusy(false);
  }
}

function setMetadataBusy(busy) {
  for (const element of [metadataElements.selectFiles, metadataElements.selectFolder, metadataElements.addMore, metadataElements.selectOutput, metadataElements.clear, metadataElements.colorProfileInput]) element.disabled = busy;
  metadataElements.start.disabled = busy || !metadataCleaner.items.length || metadataCleaner.completed;
  metadataElements.progressWrap.classList.toggle('hidden', !busy);
  metadataElements.working.classList.toggle('hidden', !busy);
  if (busy) { metadataElements.progressBar.style.width = '0%'; metadataElements.progressText.textContent = `0 de ${metadataCleaner.items.length}`; }
  renderMetadataQueue();
}

function showMetadataSummary(results, batchPath) {
  const successful = results.filter((result) => result.ok);
  const failed = results.length - successful.length;
  const alreadyClean = successful.filter((result) => result.alreadyClean).length;
  const cleaned = successful.length - alreadyClean;
  const aiRemoved = successful.filter((result) => result.hadAiSignals && result.aiSignalsRemoved).length;
  metadataElements.queue.classList.add('hidden'); metadataElements.dropZone.classList.add('hidden'); metadataElements.summary.classList.remove('hidden'); metadataElements.working.classList.add('hidden');
  metadataElements.cleanedCount.textContent = cleaned.toLocaleString('pt-BR');
  metadataElements.alreadyCleanCount.textContent = aiRemoved.toLocaleString('pt-BR');
  metadataElements.processedCount.textContent = successful.length.toLocaleString('pt-BR');
  metadataElements.summaryText.textContent = failed
    ? `${successful.length} imagens protegidas e ${failed} não puderam ser processadas.`
    : `Tudo pronto. A limpeza foi verificada em ${successful.length.toLocaleString('pt-BR')} ${successful.length === 1 ? 'arquivo' : 'arquivos'}, sem alterar os originais.`;
  metadataElements.summaryPath.textContent = batchPath; metadataElements.summaryPath.title = batchPath;
}

function resetMetadataCleaner() {
  Object.assign(metadataCleaner, { items: [], batchPath: '', completed: false, analyzing: false, selectedItemId: '', groupFilter: 'all', search: '' });
  metadataCleaner.results.clear(); metadataCleaner.analysis.clear();
  metadataElements.searchInput.value = '';
  metadataElements.progressWrap.classList.add('hidden'); metadataElements.working.classList.add('hidden');
  renderMetadataQueue();
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
  $('#compressor-view').classList.toggle('hidden', tool !== 'compressor'); $('#resizer-view').classList.toggle('hidden', tool !== 'resizer'); $('#metadata-view').classList.toggle('hidden', tool !== 'metadata');
  const logos = {
    compressor: ['assets/logos/logo-image-compressor.png', 'ARC Image Compressor'],
    resizer: ['assets/logos/logo-image-resizer.png', 'ARC Image Resizer'],
    metadata: ['assets/logos/logo-metadata-editor.png', 'ARC Metadata Editor']
  };
  $('#brand-logo').src = logos[tool][0];
  $('#brand-logo').alt = logos[tool][1];
  window.scrollTo({ top: 0, behavior: 'smooth' });
}));

compressorElements.selectFiles.addEventListener('click', () => chooseCompressorFiles(false)); compressorElements.addMore.addEventListener('click', () => chooseCompressorFiles(false)); compressorElements.selectFolder.addEventListener('click', () => chooseCompressorFiles(true));
compressorElements.selectOutput.addEventListener('click', () => chooseOutput(compressor, compressorElements.outputPath)); compressorElements.start.addEventListener('click', startOptimization); compressorElements.clear.addEventListener('click', resetCompressor); compressorElements.newBatch.addEventListener('click', resetCompressor); compressorElements.openOutput.addEventListener('click', () => window.arc.showOutput(compressor.batchPath || compressor.outputRoot));
wireDropZone(compressorElements.dropZone, (items) => { addUniqueItems(compressor, items); renderCompressorQueue(); });

resizeElements.selectFiles.addEventListener('click', () => chooseResizeFiles(false)); resizeElements.addMore.addEventListener('click', () => chooseResizeFiles(false)); resizeElements.selectFolder.addEventListener('click', () => chooseResizeFiles(true));
resizeElements.selectOutput.addEventListener('click', () => chooseOutput(resizer, resizeElements.outputPath)); resizeElements.start.addEventListener('click', startResize); resizeElements.clear.addEventListener('click', resetResize); resizeElements.newBatch.addEventListener('click', resetResize); resizeElements.openOutput.addEventListener('click', () => window.arc.showOutput(resizer.batchPath || resizer.outputRoot));
resizeElements.previewRefresh.addEventListener('click', () => refreshResizePreview());
wireDropZone(resizeElements.dropZone, addResizeItems);

metadataElements.selectFiles.addEventListener('click', () => chooseMetadataFiles(false)); metadataElements.addMore.addEventListener('click', () => chooseMetadataFiles(false)); metadataElements.selectFolder.addEventListener('click', () => chooseMetadataFiles(true));
metadataElements.selectOutput.addEventListener('click', () => chooseOutput(metadataCleaner, metadataElements.outputPath)); metadataElements.start.addEventListener('click', startMetadataCleaning); metadataElements.clear.addEventListener('click', resetMetadataCleaner); metadataElements.newBatch.addEventListener('click', resetMetadataCleaner); metadataElements.openOutput.addEventListener('click', () => window.arc.showOutput(metadataCleaner.batchPath || metadataCleaner.outputRoot));
metadataElements.colorProfileInput.addEventListener('change', () => {
  metadataCleaner.preserveColorProfile = metadataElements.colorProfileInput.checked;
  metadataElements.colorProfile.classList.toggle('active', metadataCleaner.preserveColorProfile);
  metadataElements.colorProfile.querySelector('small').textContent = metadataCleaner.preserveColorProfile
    ? 'ICC mantido · EXIF e rastros de IA removidos'
    : 'limpeza total · inclusive perfil de cores ICC';
  renderMetadataQueue();
});
metadataElements.searchInput.addEventListener('input', () => { metadataCleaner.search = metadataElements.searchInput.value; renderMetadataInspector(); });
wireDropZone(metadataElements.dropZone, addMetadataItems);

$$('.resize-mode-tab').forEach((button) => button.addEventListener('click', () => setResizeMode(button.dataset.resizeMode)));
resizeElements.ratioLockInput.addEventListener('change', () => setRatioLock(resizeElements.ratioLockInput.checked)); resizeElements.templateRatioLockInput.addEventListener('change', () => setRatioLock(resizeElements.templateRatioLockInput.checked));
resizeElements.width.addEventListener('input', () => syncDimension('width')); resizeElements.height.addEventListener('input', () => syncDimension('height'));
resizeElements.percentage.addEventListener('input', () => { resizeElements.percentageRange.value = Math.min(200, Number(resizeElements.percentage.value) || 1); updateResizeTarget(); scheduleResizePreview(); });
resizeElements.percentageRange.addEventListener('input', () => { resizeElements.percentage.value = resizeElements.percentageRange.value; updateResizeTarget(); scheduleResizePreview(); });
$$('[data-percentage]').forEach((button) => button.addEventListener('click', () => { resizeElements.percentage.value = button.dataset.percentage; resizeElements.percentageRange.value = Math.min(200, Number(button.dataset.percentage)); $$('[data-percentage]').forEach((item) => item.classList.toggle('active', item === button)); updateResizeTarget(); scheduleResizePreview(0); }));
$$('[data-platform]').forEach((button) => button.addEventListener('click', () => { resizer.platform = button.dataset.platform; resizer.presetId = presets[resizer.platform][0].id; $$('[data-platform]').forEach((item) => item.classList.toggle('active', item === button)); renderPresets(); scheduleResizePreview(0); }));

window.arc.onProgress((progress) => { compressor.results.set(progress.id, progress); const done = progress.index + 1; compressorElements.progressBar.style.width = `${done / progress.total * 100}%`; compressorElements.progressText.textContent = `${done} de ${progress.total}`; if (!compressor.completed) renderCompressorQueue(); });
window.arc.onStarted(({ id }) => { if (!compressor.completed) { compressor.results.set(id, { working: true }); renderCompressorQueue(); } });
window.arc.onResizeProgress((progress) => { resizer.results.set(progress.id, progress); const done = progress.index + 1; resizeElements.progressBar.style.width = `${done / progress.total * 100}%`; resizeElements.progressText.textContent = `${done} de ${progress.total}`; if (!resizer.completed) renderResizeQueue(); });
window.arc.onResizeStarted(({ id }) => { if (!resizer.completed) { resizer.results.set(id, { working: true }); renderResizeQueue(); } });
window.arc.onMetadataProgress((progress) => { metadataCleaner.results.set(progress.id, progress); const done = progress.index + 1; metadataElements.progressBar.style.width = `${done / progress.total * 100}%`; metadataElements.progressText.textContent = `${done} de ${progress.total}`; if (!metadataCleaner.completed) renderMetadataQueue(); });
window.arc.onMetadataStarted(({ id }) => { if (!metadataCleaner.completed) { metadataCleaner.results.set(id, { working: true }); renderMetadataQueue(); } });
window.arc.onUpdateState(renderUpdateState);

updateElements.button.addEventListener('click', () => {
  if (updateUiState.status === 'available') window.arc.installUpdate();
  else window.arc.checkForUpdates();
});
updateElements.action.addEventListener('click', () => {
  if (updateUiState.status === 'available') window.arc.installUpdate();
  else window.arc.checkForUpdates();
});
updateElements.dismiss.addEventListener('click', () => {
  dismissedUpdateStatus = updateUiState.status;
  updateElements.notice.classList.add('hidden');
});

window.arc.defaultOutput().then((outputPath) => { compressor.outputRoot = outputPath; resizer.outputRoot = outputPath; metadataCleaner.outputRoot = outputPath; compressorElements.outputPath.value = outputPath; resizeElements.outputPath.value = outputPath; metadataElements.outputPath.value = outputPath; });
window.arc.getUpdateState().then(renderUpdateState);
metadataElements.colorProfile.classList.add('active');
renderPresets(); updateResizeTarget();
