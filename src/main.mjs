import { app, BrowserWindow, dialog, ipcMain, Notification, shell } from 'electron';
import { readdir, stat } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import updaterPackage from 'electron-updater';
import { createBatchDirectory, isSupportedImage, optimizeImage } from './optimizer.mjs';
import { imageMetadata, imagePreview, resizeImage, resizePreview } from './resizer.mjs';
import { cleanMetadataImage, inspectImageMetadata } from './metadata-cleaner.mjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const { autoUpdater } = updaterPackage;
let updateState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  availableVersion: '',
  percent: 0,
  transferred: 0,
  total: 0,
  message: '',
  showNotice: false
};
let manualUpdateCheck = false;
let installAfterDownload = false;

function publicUpdateState() {
  return { ...updateState };
}

function sendUpdateState(patch) {
  updateState = { ...updateState, ...patch, currentVersion: app.getVersion() };
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('update:state', publicUpdateState());
  }
  return publicUpdateState();
}

function friendlyUpdateError(error) {
  const message = error instanceof Error ? error.message : String(error || 'Falha desconhecida');
  if (/net::|network|internet|ENOTFOUND|ECONN/i.test(message)) return 'Não foi possível acessar o GitHub. Confira sua conexão e tente novamente.';
  if (/404|latest\.yml/i.test(message)) return 'O release mais recente ainda não possui os arquivos de atualização.';
  return 'Não foi possível concluir a atualização. Tente novamente em alguns minutos.';
}

async function checkForUpdates({ manual = false } = {}) {
  manualUpdateCheck = manual;
  if (!app.isPackaged) {
    return sendUpdateState({
      status: 'development',
      message: 'A verificação automática funciona na versão instalada.',
      showNotice: manual
    });
  }
  if (['downloading', 'installing'].includes(updateState.status)) return publicUpdateState();
  sendUpdateState({ status: 'checking', message: 'Procurando uma versão mais recente…', showNotice: manual, percent: 0 });
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    sendUpdateState({ status: 'error', message: friendlyUpdateError(error), showNotice: manual });
  }
  return publicUpdateState();
}

function configureAutoUpdater() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => {
    sendUpdateState({ status: 'checking', message: 'Procurando uma versão mais recente…', showNotice: manualUpdateCheck });
  });
  autoUpdater.on('update-available', (info) => {
    sendUpdateState({
      status: 'available',
      availableVersion: info.version,
      message: `A versão ${info.version} está pronta para baixar.`,
      showNotice: true,
      percent: 0
    });
  });
  autoUpdater.on('update-not-available', () => {
    sendUpdateState({
      status: 'up-to-date',
      availableVersion: '',
      message: 'Você já está usando a versão mais recente.',
      showNotice: manualUpdateCheck,
      percent: 0
    });
    manualUpdateCheck = false;
  });
  autoUpdater.on('download-progress', (progress) => {
    sendUpdateState({
      status: 'downloading',
      percent: Math.max(0, Math.min(100, progress.percent || 0)),
      transferred: progress.transferred || 0,
      total: progress.total || 0,
      message: 'Baixando a atualização com segurança…',
      showNotice: true
    });
  });
  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateState({
      status: 'installing',
      availableVersion: info.version,
      percent: 100,
      message: 'Download concluído. Reiniciando para instalar…',
      showNotice: true
    });
    if (installAfterDownload) setTimeout(() => autoUpdater.quitAndInstall(true, true), 900);
  });
  autoUpdater.on('error', (error) => {
    sendUpdateState({ status: 'error', message: friendlyUpdateError(error), showNotice: manualUpdateCheck || installAfterDownload });
    installAfterDownload = false;
    manualUpdateCheck = false;
  });

  setTimeout(() => checkForUpdates(), 5000);
  setInterval(() => checkForUpdates(), 6 * 60 * 60 * 1000).unref();
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1240,
    height: 900,
    minWidth: 1000,
    minHeight: 720,
    backgroundColor: '#030610',
    title: 'ARC Image Studio',
    icon: path.join(currentDirectory, 'renderer', 'assets', 'app.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(currentDirectory, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.loadFile(path.join(currentDirectory, 'renderer', 'index.html'));
}

async function fileEntry(filePath, relativePath = path.basename(filePath)) {
  const info = await stat(filePath);
  return {
    id: `${filePath}:${info.size}:${info.mtimeMs}`,
    path: filePath,
    name: path.basename(filePath),
    relativePath,
    size: info.size
  };
}

async function scanDirectory(root, directory = root) {
  const entries = await readdir(directory, { withFileTypes: true });
  const images = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      images.push(...await scanDirectory(root, fullPath));
    } else if (entry.isFile() && isSupportedImage(fullPath)) {
      images.push(await fileEntry(fullPath, path.relative(root, fullPath)));
    }
  }
  return images;
}

ipcMain.handle('files:select', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Selecione as imagens',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Imagens compatíveis', extensions: ['jpg', 'jpeg', 'png'] }]
  });
  if (result.canceled) return [];
  return Promise.all(result.filePaths.map((filePath) => fileEntry(filePath)));
});

ipcMain.handle('folder:select', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Selecione a pasta com as imagens',
    properties: ['openDirectory']
  });
  if (result.canceled || !result.filePaths[0]) return [];
  return scanDirectory(result.filePaths[0]);
});

ipcMain.handle('files:from-paths', async (_event, paths) => {
  if (!Array.isArray(paths) || paths.length > 10000) return [];
  const images = [];
  for (const candidate of paths) {
    if (typeof candidate !== 'string' || !candidate) continue;
    try {
      const info = await stat(candidate);
      if (info.isDirectory()) images.push(...await scanDirectory(candidate));
      else if (info.isFile() && isSupportedImage(candidate)) images.push(await fileEntry(candidate));
    } catch {
      // A dragged item may disappear before it is inspected; skip it safely.
    }
  }
  return images.slice(0, 10000);
});

ipcMain.handle('output:select', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Selecione onde salvar os lotes do ARC Image Studio',
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('output:default', () => path.join(app.getPath('pictures'), 'ARC Image Studio'));

ipcMain.handle('output:show', async (_event, outputPath) => {
  if (typeof outputPath === 'string' && outputPath) await shell.openPath(outputPath);
});

ipcMain.handle('update:get-state', () => publicUpdateState());
ipcMain.handle('update:check', () => checkForUpdates({ manual: true }));
ipcMain.handle('update:install', () => {
  if (updateState.status === 'installing') {
    autoUpdater.quitAndInstall(true, true);
    return publicUpdateState();
  }
  if (updateState.status !== 'available') return publicUpdateState();
  installAfterDownload = true;
  sendUpdateState({ status: 'downloading', percent: 0, message: 'Preparando o download…', showNotice: true });
  autoUpdater.downloadUpdate().catch((error) => {
    sendUpdateState({ status: 'error', message: friendlyUpdateError(error), showNotice: true });
    installAfterDownload = false;
  });
  return publicUpdateState();
});

ipcMain.handle('image:metadata', async (_event, sourcePath) => {
  if (typeof sourcePath !== 'string' || !sourcePath) throw new Error('Imagem inválida.');
  return imageMetadata(sourcePath);
});

ipcMain.handle('image:preview', async (_event, sourcePath, maxWidth, maxHeight) => {
  if (typeof sourcePath !== 'string' || !sourcePath) throw new Error('Imagem inválida.');
  return imagePreview(sourcePath, maxWidth, maxHeight);
});

ipcMain.handle('image:resize-preview', async (_event, sourcePath, options, maxWidth, maxHeight) => {
  if (typeof sourcePath !== 'string' || !sourcePath) throw new Error('Imagem inválida.');
  return resizePreview(sourcePath, options, maxWidth, maxHeight);
});

ipcMain.handle('metadata:inspect', async (_event, items) => {
  if (!Array.isArray(items) || items.length > 10000) return [];
  const results = new Array(items.length);
  const workerCount = Math.min(items.length, Math.max(1, Math.min(4, availableParallelism() - 1)));
  let nextIndex = 0;

  async function inspectNext() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      try {
        results[index] = { id: item.id, ok: true, ...await inspectImageMetadata(item.path) };
      } catch (error) {
        results[index] = { id: item.id, ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => inspectNext()));
  return results;
});

ipcMain.handle('optimize:start', async (event, payload) => {
  const { items, outputRoot, level } = payload ?? {};
  if (!Array.isArray(items) || items.length === 0) throw new Error('Nenhuma imagem foi selecionada.');
  if (typeof outputRoot !== 'string' || !outputRoot.trim()) throw new Error('Escolha a pasta de saída.');
  if (items.length > 10000) throw new Error('O limite por lote é de 10.000 imagens.');

  const batchPath = await createBatchDirectory(outputRoot);
  const results = new Array(items.length);
  const workerCount = Math.min(items.length, Math.max(1, Math.min(4, availableParallelism() - 1)));
  let nextIndex = 0;
  let completed = 0;

  async function processNext() {
    while (nextIndex < items.length) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      const item = items[itemIndex];
      event.sender.send('optimize:started', { id: item.id });

    try {
      const result = await optimizeImage({
        sourcePath: item.path,
        relativePath: item.relativePath,
        outputRoot: batchPath,
        level
      });
      results[itemIndex] = { id: item.id, ok: true, ...result };
      completed += 1;
      event.sender.send('optimize:progress', {
        id: item.id,
        index: completed - 1,
        total: items.length,
        ok: true,
        ...result
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results[itemIndex] = { id: item.id, ok: false, error: message };
      completed += 1;
      event.sender.send('optimize:progress', {
        id: item.id,
        index: completed - 1,
        total: items.length,
        ok: false,
        error: message
      });
    }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => processNext()));

  if (Notification.isSupported()) {
    const successful = results.filter((result) => result?.ok).length;
    const notification = new Notification({
      title: 'ARC Image Studio — concluído',
      body: `${successful} ${successful === 1 ? 'imagem pronta' : 'imagens prontas'} em ${path.basename(batchPath)}.`,
      icon: path.join(currentDirectory, 'renderer', 'assets', 'app.ico')
    });
    notification.on('click', () => shell.openPath(batchPath));
    notification.show();
  }

  return { results, batchPath };
});

ipcMain.handle('resize:start', async (event, payload) => {
  const { items, outputRoot, options } = payload ?? {};
  if (!Array.isArray(items) || items.length === 0) throw new Error('Nenhuma imagem foi selecionada.');
  if (typeof outputRoot !== 'string' || !outputRoot.trim()) throw new Error('Escolha a pasta de saída.');
  if (items.length > 10000) throw new Error('O limite por lote é de 10.000 imagens.');

  const batchPath = await createBatchDirectory(outputRoot, new Date(), 'Redimensionado');
  const results = new Array(items.length);
  const workerCount = Math.min(items.length, Math.max(1, Math.min(4, availableParallelism() - 1)));
  let nextIndex = 0;
  let completed = 0;

  async function processNext() {
    while (nextIndex < items.length) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      const item = items[itemIndex];
      event.sender.send('resize:started', { id: item.id });

      try {
        const result = await resizeImage({
          sourcePath: item.path,
          relativePath: item.relativePath,
          outputRoot: batchPath,
          options
        });
        results[itemIndex] = { id: item.id, ok: true, ...result };
        completed += 1;
        event.sender.send('resize:progress', { id: item.id, index: completed - 1, total: items.length, ok: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results[itemIndex] = { id: item.id, ok: false, error: message };
        completed += 1;
        event.sender.send('resize:progress', { id: item.id, index: completed - 1, total: items.length, ok: false, error: message });
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => processNext()));

  if (Notification.isSupported()) {
    const successful = results.filter((result) => result?.ok).length;
    const notification = new Notification({
      title: 'ARC Image Studio — concluído',
      body: `${successful} ${successful === 1 ? 'imagem redimensionada' : 'imagens redimensionadas'} em ${path.basename(batchPath)}.`,
      icon: path.join(currentDirectory, 'renderer', 'assets', 'app.ico')
    });
    notification.on('click', () => shell.openPath(batchPath));
    notification.show();
  }

  return { results, batchPath };
});

ipcMain.handle('metadata:start', async (event, payload) => {
  const { items, outputRoot, preserveColorProfile = true } = payload ?? {};
  if (!Array.isArray(items) || items.length === 0) throw new Error('Nenhuma imagem foi selecionada.');
  if (typeof outputRoot !== 'string' || !outputRoot.trim()) throw new Error('Escolha a pasta de saída.');
  if (items.length > 10000) throw new Error('O limite por lote é de 10.000 imagens.');

  const batchPath = await createBatchDirectory(outputRoot, new Date(), 'Metadados removidos');
  const results = new Array(items.length);
  const workerCount = Math.min(items.length, Math.max(1, Math.min(4, availableParallelism() - 1)));
  let nextIndex = 0;
  let completed = 0;

  async function processNext() {
    while (nextIndex < items.length) {
      const itemIndex = nextIndex;
      nextIndex += 1;
      const item = items[itemIndex];
      event.sender.send('metadata:started', { id: item.id });
      try {
        const result = await cleanMetadataImage({
          sourcePath: item.path,
          relativePath: item.relativePath,
          outputRoot: batchPath,
          preserveColorProfile
        });
        results[itemIndex] = { id: item.id, ok: true, ...result };
        completed += 1;
        event.sender.send('metadata:progress', { id: item.id, index: completed - 1, total: items.length, ok: true, ...result });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results[itemIndex] = { id: item.id, ok: false, error: message };
        completed += 1;
        event.sender.send('metadata:progress', { id: item.id, index: completed - 1, total: items.length, ok: false, error: message });
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => processNext()));

  if (Notification.isSupported()) {
    const successful = results.filter((result) => result?.ok).length;
    const notification = new Notification({
      title: 'ARC Image Studio — metadados removidos',
      body: `${successful} ${successful === 1 ? 'imagem protegida' : 'imagens protegidas'} em ${path.basename(batchPath)}.`,
      icon: path.join(currentDirectory, 'renderer', 'assets', 'app.ico')
    });
    notification.on('click', () => shell.openPath(batchPath));
    notification.show();
  }

  return { results, batchPath };
});

app.whenReady().then(() => {
  createWindow();
  configureAutoUpdater();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
