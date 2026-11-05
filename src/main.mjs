import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBatchDirectory, isSupportedImage, optimizeImage } from './optimizer.mjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#0b1020',
    title: 'ARC Image Resizer',
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
    filters: [{ name: 'Imagens sem perda', extensions: ['jpg', 'jpeg', 'png'] }]
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
  const results = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    try {
      const result = await optimizeImage({
        sourcePath: item.path,
        relativePath: item.relativePath,
        outputRoot: batchPath,
        level
      });
      results.push({ id: item.id, ok: true, ...result });
      event.sender.send('optimize:progress', {
        id: item.id,
        index,
        total: items.length,
        ok: true,
        ...result
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ id: item.id, ok: false, error: message });
      event.sender.send('optimize:progress', {
        id: item.id,
        index,
        total: items.length,
        ok: false,
        error: message
      });
    }
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
