const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('arc', {
  selectFiles: () => ipcRenderer.invoke('files:select'),
  selectFolder: () => ipcRenderer.invoke('folder:select'),
  addPaths: (paths) => ipcRenderer.invoke('files:from-paths', paths),
  selectOutput: () => ipcRenderer.invoke('output:select'),
  defaultOutput: () => ipcRenderer.invoke('output:default'),
  showOutput: (outputPath) => ipcRenderer.invoke('output:show', outputPath),
  imageMetadata: (sourcePath) => ipcRenderer.invoke('image:metadata', sourcePath),
  imagePreview: (sourcePath, maxWidth, maxHeight) => ipcRenderer.invoke('image:preview', sourcePath, maxWidth, maxHeight),
  resizePreview: (sourcePath, options, maxWidth, maxHeight) => ipcRenderer.invoke('image:resize-preview', sourcePath, options, maxWidth, maxHeight),
  inspectMetadata: (items) => ipcRenderer.invoke('metadata:inspect', items),
  optimize: (payload) => ipcRenderer.invoke('optimize:start', payload),
  resize: (payload) => ipcRenderer.invoke('resize:start', payload),
  cleanMetadata: (payload) => ipcRenderer.invoke('metadata:start', payload),
  getUpdateState: () => ipcRenderer.invoke('update:get-state'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdateState: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('update:state', listener);
    return () => ipcRenderer.removeListener('update:state', listener);
  },
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
  onMetadataProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('metadata:progress', listener);
    return () => ipcRenderer.removeListener('metadata:progress', listener);
  },
  onMetadataStarted: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('metadata:started', listener);
    return () => ipcRenderer.removeListener('metadata:started', listener);
  },
  getPathForFile: (file) => webUtils.getPathForFile(file)
});
