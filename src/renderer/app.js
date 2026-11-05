const state = {
  items: [],
  outputRoot: '',
  batchPath: '',
  running: false,
  completed: false,
  results: new Map()
};

const elements = {
  selectFiles: document.querySelector('#select-files'),
  selectFolder: document.querySelector('#select-folder'),
  addMore: document.querySelector('#add-more'),
  selectOutput: document.querySelector('#select-output'),
  outputPath: document.querySelector('#output-path'),
  start: document.querySelector('#start'),
  clear: document.querySelector('#clear'),
  dropZone: document.querySelector('#drop-zone'),
  queue: document.querySelector('#queue'),
  queueTitle: document.querySelector('#queue-title'),
  queueSubtitle: document.querySelector('#queue-subtitle'),
  fileList: document.querySelector('#file-list'),
  progressWrap: document.querySelector('#progress-wrap'),
  progressBar: document.querySelector('#progress-bar'),
  progressText: document.querySelector('#progress-text'),
  workingAnimation: document.querySelector('#working-animation'),
  summary: document.querySelector('#summary'),
  summaryText: document.querySelector('#summary-text'),
  savedSize: document.querySelector('#saved-size'),
  savedPercent: document.querySelector('#saved-percent'),
  processedCount: document.querySelector('#processed-count'),
  openOutput: document.querySelector('#open-output'),
  newBatch: document.querySelector('#new-batch')
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: index === 0 ? 0 : 1 })} ${units[index]}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function addItems(items) {
  state.completed = false;
  const existing = new Set(state.items.map((item) => item.path.toLowerCase()));
  for (const item of items) {
    if (!existing.has(item.path.toLowerCase())) {
      state.items.push(item);
      existing.add(item.path.toLowerCase());
    }
  }
  renderQueue();
}

function renderQueue() {
  const hasItems = state.items.length > 0;
  elements.dropZone.classList.toggle('hidden', hasItems);
  elements.queue.classList.toggle('hidden', !hasItems);
  elements.summary.classList.add('hidden');
  elements.start.disabled = !hasItems || state.running || state.completed;
  elements.clear.disabled = state.running;
  elements.addMore.disabled = state.running;
  elements.queueTitle.textContent = `${state.items.length.toLocaleString('pt-BR')} ${state.items.length === 1 ? 'imagem selecionada' : 'imagens selecionadas'}`;
  const total = state.items.reduce((sum, item) => sum + item.size, 0);
  elements.queueSubtitle.textContent = `Tamanho total: ${formatBytes(total)}`;

  elements.fileList.innerHTML = state.items.map((item) => {
    const result = state.results.get(item.id);
    let statusClass = '';
    let statusText = 'Na fila';
    let sizeText = formatBytes(item.size);
    let detail = item.path;

    if (result?.working) {
      statusClass = 'working';
      statusText = 'Otimizando';
    } else if (result?.ok) {
      statusClass = 'success';
      statusText = result.savedBytes > 0 ? `−${result.savedPercent.toFixed(1)}%` : 'Já otimizada';
      sizeText = `${formatBytes(result.originalBytes)} → ${formatBytes(result.optimizedBytes)}`;
      detail = result.method;
    } else if (result?.error) {
      statusClass = 'error';
      statusText = 'Falhou';
      detail = result.error;
    }

    return `<div class="file-row" data-id="${escapeHtml(item.id)}">
      <div class="file-info">
        <div class="file-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
        <div class="file-detail" title="${escapeHtml(detail)}">${escapeHtml(detail)}</div>
      </div>
      <div class="file-size">${escapeHtml(sizeText)}</div>
      <div class="file-status ${statusClass}">${escapeHtml(statusText)}</div>
    </div>`;
  }).join('');
}

async function chooseFiles() {
  const items = await window.arc.selectFiles();
  addItems(items);
}

async function chooseFolder() {
  const items = await window.arc.selectFolder();
  addItems(items);
}

async function chooseOutput() {
  const selected = await window.arc.selectOutput();
  if (selected) {
    state.outputRoot = selected;
    elements.outputPath.value = selected;
  }
}

function selectedLevel() {
  return document.querySelector('input[name="level"]:checked').value;
}

async function startOptimization() {
  if (state.running || state.items.length === 0) return;
  state.running = true;
  state.results.clear();
  elements.start.disabled = true;
  elements.selectFiles.disabled = true;
  elements.selectFolder.disabled = true;
  elements.addMore.disabled = true;
  elements.selectOutput.disabled = true;
  elements.progressWrap.classList.remove('hidden');
  elements.workingAnimation.classList.remove('hidden');
  elements.progressBar.style.width = '0%';
  elements.progressText.textContent = `0 de ${state.items.length}`;
  renderQueue();

  try {
    const payload = await window.arc.optimize({
      items: state.items,
      outputRoot: state.outputRoot,
      level: selectedLevel()
    });
    state.batchPath = payload.batchPath;
    state.completed = true;
    showSummary(payload.results, payload.batchPath);
  } catch (error) {
    elements.workingAnimation.classList.add('hidden');
    window.alert(error?.message || 'Não foi possível processar este lote.');
  } finally {
    state.running = false;
    elements.selectFiles.disabled = false;
    elements.selectFolder.disabled = false;
    elements.addMore.disabled = false;
    elements.selectOutput.disabled = false;
    elements.start.disabled = state.items.length === 0 || state.completed;
  }
}

function showSummary(results, batchPath) {
  const successful = results.filter((result) => result.ok);
  const failed = results.length - successful.length;
  const originalBytes = successful.reduce((sum, result) => sum + result.originalBytes, 0);
  const savedBytes = successful.reduce((sum, result) => sum + result.savedBytes, 0);
  const percentage = originalBytes === 0 ? 0 : (savedBytes / originalBytes) * 100;

  elements.queue.classList.add('hidden');
  elements.dropZone.classList.add('hidden');
  elements.summary.classList.remove('hidden');
  elements.workingAnimation.classList.add('hidden');
  elements.savedSize.textContent = formatBytes(savedBytes);
  elements.savedPercent.textContent = `${percentage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  elements.processedCount.textContent = successful.length.toLocaleString('pt-BR');
  const batchName = batchPath?.split(/[\\/]/).filter(Boolean).pop() || 'novo lote';
  elements.summaryText.textContent = failed > 0
    ? `${successful.length} imagens foram salvas em “${batchName}” e ${failed} não puderam ser processadas.`
    : `Tudo foi salvo em “${batchName}”, preservando integralmente a qualidade.`;
}

function resetBatch() {
  state.items = [];
  state.batchPath = '';
  state.completed = false;
  state.results.clear();
  elements.progressWrap.classList.add('hidden');
  elements.workingAnimation.classList.add('hidden');
  elements.progressBar.style.width = '0%';
  renderQueue();
}

elements.selectFiles.addEventListener('click', chooseFiles);
elements.addMore.addEventListener('click', chooseFiles);
elements.selectFolder.addEventListener('click', chooseFolder);
elements.selectOutput.addEventListener('click', chooseOutput);
elements.start.addEventListener('click', startOptimization);
elements.clear.addEventListener('click', resetBatch);
elements.newBatch.addEventListener('click', resetBatch);
elements.openOutput.addEventListener('click', () => window.arc.showOutput(state.batchPath || state.outputRoot));

for (const eventName of ['dragenter', 'dragover']) {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add('dragging');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove('dragging');
  });
}
elements.dropZone.addEventListener('drop', async (event) => {
  const paths = [...event.dataTransfer.files]
    .map((file) => window.arc.getPathForFile(file))
    .filter(Boolean);

  if (paths.length > 0) {
    const selected = await window.arc.addPaths(paths);
    if (selected.length > 0) addItems(selected);
  }
});

window.arc.onProgress((progress) => {
  state.results.set(progress.id, progress);
  const completed = progress.index + 1;
  elements.progressBar.style.width = `${(completed / progress.total) * 100}%`;
  elements.progressText.textContent = `${completed} de ${progress.total}`;
  renderQueue();
});

window.arc.onStarted(({ id }) => {
  state.results.set(id, { working: true });
  renderQueue();
});

window.arc.defaultOutput().then((outputPath) => {
  state.outputRoot = outputPath;
  elements.outputPath.value = outputPath;
});
