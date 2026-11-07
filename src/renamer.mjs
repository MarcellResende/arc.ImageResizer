import { access, copyFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createBatchDirectory } from './optimizer.mjs';

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff', '.svg']);
const RESERVED_WINDOWS_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export function isSupportedRenameInput(filePath) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function safeInteger(value, fallback, minimum, maximum) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

export function normalizeRenameOptions(options = {}) {
  const outputMode = options.outputMode === 'original' ? 'original' : 'copy';
  const caseMode = ['keep', 'lower', 'upper', 'title'].includes(options.caseMode) ? options.caseMode : 'keep';
  return {
    pattern: String(options.pattern || '{nome}-{n}').slice(0, 180),
    prefix: String(options.prefix || '').slice(0, 80),
    suffix: String(options.suffix || '').slice(0, 80),
    find: String(options.find || '').slice(0, 120),
    replace: String(options.replace || '').slice(0, 120),
    caseSensitive: Boolean(options.caseSensitive),
    caseMode,
    startNumber: safeInteger(options.startNumber, 1, 0, 999_999_999),
    digits: safeInteger(options.digits, 3, 1, 9),
    outputMode
  };
}

function dateParts(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  };
}

function literalReplace(value, find, replacement, caseSensitive) {
  if (!find) return value;
  if (caseSensitive) return value.split(find).join(replacement);
  const expression = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  return value.replace(expression, replacement);
}

function applyCase(value, mode) {
  if (mode === 'lower') return value.toLocaleLowerCase('pt-BR');
  if (mode === 'upper') return value.toLocaleUpperCase('pt-BR');
  if (mode === 'title') {
    return value.toLocaleLowerCase('pt-BR').replace(/(^|[\s_-])([\p{L}\p{N}])/gu, (_match, separator, letter) => `${separator}${letter.toLocaleUpperCase('pt-BR')}`);
  }
  return value;
}

export function sanitizeFilenameBase(value) {
  let safe = String(value)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  if (!safe) safe = 'imagem';
  if (RESERVED_WINDOWS_NAMES.test(safe)) safe = `_${safe}`;
  return safe.slice(0, 180).replace(/[. ]+$/g, '') || 'imagem';
}

function numberedName(base, extension, used) {
  let candidate = `${base}${extension}`;
  let suffix = 2;
  while (used.has(candidate.toLocaleLowerCase('pt-BR'))) {
    candidate = `${base}-${suffix}${extension}`;
    suffix += 1;
  }
  used.add(candidate.toLocaleLowerCase('pt-BR'));
  return candidate;
}

export function buildRenamePlan(items, options = {}, now = new Date()) {
  const normalized = normalizeRenameOptions(options);
  const clock = dateParts(now);
  const usedByLocation = new Map();

  return items.map((item, index) => {
    const parsed = path.parse(item.name || item.path);
    const sequence = String(normalized.startNumber + index).padStart(normalized.digits, '0');
    let base = normalized.pattern
      .replaceAll('{nome}', parsed.name)
      .replaceAll('{n}', sequence)
      .replaceAll('{data}', clock.date)
      .replaceAll('{hora}', clock.time);
    base = literalReplace(base, normalized.find, normalized.replace, normalized.caseSensitive);
    base = applyCase(`${normalized.prefix}${base}${normalized.suffix}`, normalized.caseMode);
    base = sanitizeFilenameBase(base);

    const location = normalized.outputMode === 'original' ? path.dirname(item.path).toLocaleLowerCase('pt-BR') : '__copy__';
    if (!usedByLocation.has(location)) usedByLocation.set(location, new Set());
    const newName = numberedName(base, parsed.ext, usedByLocation.get(location));
    return {
      id: item.id,
      sourcePath: item.path,
      originalName: parsed.base,
      base,
      extension: parsed.ext,
      newName,
      changed: parsed.base !== newName,
      conflictAdjusted: newName !== `${base}${parsed.ext}`
    };
  });
}

async function pathExists(filePath) {
  try { await access(filePath); return true; } catch { return false; }
}

async function resolveOriginalConflicts(plan) {
  const selectedSources = new Set(plan.map((item) => path.resolve(item.sourcePath).toLocaleLowerCase('pt-BR')));
  const reservedTargets = new Set();
  const resolved = [];

  for (const item of plan) {
    const directory = path.dirname(item.sourcePath);
    let candidate = item.newName;
    let suffix = 2;
    while (true) {
      const targetPath = path.join(directory, candidate);
      const targetKey = path.resolve(targetPath).toLocaleLowerCase('pt-BR');
      const occupiedByExternalFile = await pathExists(targetPath) && !selectedSources.has(targetKey);
      if (!reservedTargets.has(targetKey) && !occupiedByExternalFile) {
        reservedTargets.add(targetKey);
        resolved.push({ ...item, newName: candidate, targetPath, conflictAdjusted: item.conflictAdjusted || candidate !== item.newName });
        break;
      }
      candidate = `${item.base}-${suffix}${item.extension}`;
      suffix += 1;
    }
  }
  return resolved;
}

export async function buildRenamePreview(items, options = {}, now = new Date()) {
  const normalized = normalizeRenameOptions(options);
  const plan = buildRenamePlan(items, normalized, now);
  return normalized.outputMode === 'original' ? resolveOriginalConflicts(plan) : plan;
}

async function renameOriginals(plan) {
  const resolved = await resolveOriginalConflicts(plan);
  const changed = resolved.filter((item) => path.basename(item.sourcePath) !== item.newName);
  const staged = [];

  try {
    for (const item of changed) {
      const temporaryPath = path.join(path.dirname(item.sourcePath), `.arc-rename-${randomUUID()}.tmp`);
      await rename(item.sourcePath, temporaryPath);
      staged.push({ ...item, temporaryPath, committed: false });
    }
  } catch (error) {
    for (const item of staged.reverse()) await rename(item.temporaryPath, item.sourcePath).catch(() => {});
    throw error;
  }

  try {
    for (const item of staged) {
      await rename(item.temporaryPath, item.targetPath);
      item.committed = true;
    }
  } catch (error) {
    for (const item of staged) {
      if (!item.committed) continue;
      const rollbackPath = path.join(path.dirname(item.sourcePath), `.arc-rollback-${randomUUID()}.tmp`);
      await rename(item.targetPath, rollbackPath).catch(() => {});
      item.temporaryPath = rollbackPath;
    }
    for (const item of staged.reverse()) await rename(item.temporaryPath, item.sourcePath).catch(() => {});
    throw error;
  }

  const byId = new Map(resolved.map((item) => [item.id, item]));
  return plan.map((item) => {
    const finalItem = byId.get(item.id);
    return {
      id: item.id,
      ok: true,
      originalName: item.originalName,
      newName: finalItem.newName,
      destination: finalItem.targetPath,
      changed: path.basename(item.sourcePath) !== finalItem.newName,
      conflictAdjusted: finalItem.conflictAdjusted
    };
  });
}

export async function renameBatch({ items, outputRoot, options, now = new Date(), onProgress }) {
  if (!Array.isArray(items) || !items.length) throw new Error('Nenhuma imagem foi selecionada.');
  const normalized = normalizeRenameOptions(options);
  const plan = buildRenamePlan(items, normalized, now);

  if (normalized.outputMode === 'original') {
    const results = await renameOriginals(plan);
    results.forEach((result, index) => onProgress?.(result, index, results.length));
    return { results, batchPath: '', outputMode: 'original' };
  }

  if (typeof outputRoot !== 'string' || !outputRoot.trim()) throw new Error('Escolha a pasta de saída.');
  const batchPath = await createBatchDirectory(outputRoot, now, 'Renomeado');
  const results = [];
  for (const item of plan) {
    const destination = path.join(batchPath, item.newName);
    await copyFile(item.sourcePath, destination);
    results.push({
      id: item.id,
      ok: true,
      originalName: item.originalName,
      newName: item.newName,
      destination,
      changed: item.originalName !== item.newName,
      conflictAdjusted: item.conflictAdjusted
    });
    onProgress?.(results.at(-1), results.length - 1, plan.length);
  }
  return { results, batchPath, outputMode: 'copy' };
}
