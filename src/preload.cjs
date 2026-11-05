const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('arc', {
  selectFiles: () => ipcRenderer.invoke('files:select'),
  selectFolder: () => ipcRenderer.invoke('folder:select'),
  addPaths: (paths) => ipcRenderer.invoke('files:from-paths', paths),
  selectOutput: () => ipcRenderer.invoke('output:select'),
  defaultOutput: () => ipcRenderer.invoke('output:default'),
  showOutput: (outputPath) => ipcRenderer.invoke('output:show', outputPath),
  imageMetadata: (sourcePath) => ipcRenderer.invoke('image:metadata', sourcePath),
  optimize: (payload) => ipcRenderer.invoke('optimize:start', payload),
  resize: (payload) => ipcRenderer.invoke('resize:start', payload),
  onProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('optimize:progress', listener);
    return () => ipcRenderer.removeListener('optimize:progress', listener);
  },
  onStarted: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('optimize:started', listener);
    return () => ipcRenderer.removeListener('optimize:started', listener);
  },
  onResizeProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('resize:progress', listener);
    return () => ipcRenderer.removeListener('resize:progress', listener);
  },
  onResizeStarted: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('resize:started', listener);
    return () => ipcRenderer.removeListener('resize:started', listener);
  },
  getPathForFile: (file) => webUtils.getPathForFile(file)
});
