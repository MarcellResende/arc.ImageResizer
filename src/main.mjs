import { app, BrowserWindow, dialog, ipcMain, Notification, shell } from 'electron';
import { readdir, stat } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBatchDirectory, isSupportedImage, optimizeImage } from './optimizer.mjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const window = new BrowserWindow({
    width: 1240,
    height: 900,
    minWidth: 1000,
    minHeight: 720,
    backgroundColor: '#030610',
    title: 'ARC Image Resizer',
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
    title: 'Selecione onde salvar as imagens otimizadas',
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('output:default', () => path.join(app.getPath('pictures'), 'ARC Image Resizer'));

ipcMain.handle('output:show', async (_event, outputPath) => {
  if (typeof outputPath === 'string' && outputPath) await shell.openPath(outputPath);
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
      title: 'ARC Image Resizer — concluído',
      body: `${successful} ${successful === 1 ? 'imagem pronta' : 'imagens prontas'} em ${path.basename(batchPath)}.`,
      icon: path.join(currentDirectory, 'renderer', 'assets', 'app.ico')
    });
    notification.on('click', () => shell.openPath(batchPath));
    notification.show();
  }

  return { results, batchPath };
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
