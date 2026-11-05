import { spawn } from 'node:child_process';
import { access, copyFile, mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);
const jpegtranPath = fileURLToPath(new URL('../vendor/jpegtran.exe', import.meta.url));
const optipngPath = fileURLToPath(new URL('../vendor/optipng.exe', import.meta.url));
const reservedDestinations = new Set();

function executablePath(binaryPath) {
  return binaryPath.replace('app.asar', 'app.asar.unpacked');
}

function run(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executablePath(binary), args, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    let errorText = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      errorText += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(errorText.trim() || `O otimizador terminou com o código ${code}.`));
    });
  });
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function safeRelativePath(relativePath, fallbackName) {
  const normalized = path.normalize(relativePath || fallbackName);
  const parts = normalized.split(path.sep).filter((part) => part && part !== '..' && part !== '.');
  return parts.join(path.sep) || fallbackName;
}

export function isSupportedImage(filePath) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export async function uniqueDestination(outputRoot, relativePath, fallbackName) {
  const safeRelative = safeRelativePath(relativePath, fallbackName);
  const parsed = path.parse(safeRelative);
  const directory = path.join(outputRoot, parsed.dir);
  await mkdir(directory, { recursive: true });

  let candidate = path.join(directory, parsed.base);
  let suffix = 2;
  while (reservedDestinations.has(candidate.toLowerCase()) || await exists(candidate)) {
    candidate = path.join(directory, `${parsed.name} (${suffix})${parsed.ext}`);
    suffix += 1;
  }
  reservedDestinations.add(candidate.toLowerCase());
  return candidate;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function batchLabel(date, prefix = 'Lote') {
  return `${prefix} ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

export async function createBatchDirectory(outputRoot, now = new Date(), prefix = 'Lote') {
  await mkdir(outputRoot, { recursive: true });
  const baseName = batchLabel(now, prefix);

  for (let attempt = 1; attempt <= 999; attempt += 1) {
    const suffix = attempt === 1 ? '' : `-${pad(attempt)}`;
    const candidate = path.join(outputRoot, `${baseName}${suffix}`);
    try {
      await mkdir(candidate);
      return candidate;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
  }

  throw new Error('Não foi possível criar uma nova pasta para este lote.');
}

async function compactToTemporary(sourcePath, temporaryPath) {
  const extension = path.extname(sourcePath).toLowerCase();
  const pipeline = sharp(sourcePath, { failOn: 'error', sequentialRead: true }).rotate();

  if (extension === '.png') {
    await pipeline.png({
      compressionLevel: 9,
      adaptiveFiltering: true,
      palette: true,
      quality: 88,
      effort: 5
    }).toFile(temporaryPath);
    return 'PNG reduzido com alta fidelidade visual';
  }

  await pipeline.jpeg({
    quality: 84,
    mozjpeg: true,
    progressive: true,
    chromaSubsampling: '4:2:0'
  }).toFile(temporaryPath);
  return 'JPEG recomprimido com alta fidelidade visual';
}

async function optimizeToTemporary(sourcePath, temporaryPath, mode) {
  if (mode === 'compact' || mode === 'maximum') {
    return compactToTemporary(sourcePath, temporaryPath);
  }

  const extension = path.extname(sourcePath).toLowerCase();
  if (extension === '.png') {
    await run(optipngPath, ['-o2', '-quiet', '-out', temporaryPath, sourcePath]);
    return 'PNG otimizado rapidamente sem alterar os pixels';
  }

  await run(jpegtranPath, [
    '-copy', 'all',
    '-optimize',
    '-progressive',
    '-outfile', temporaryPath,
    sourcePath
  ]);
  return 'JPEG reorganizado sem recodificar os pixels';
}

export async function optimizeImage({ sourcePath, outputRoot, relativePath, level = 'lossless' }) {
  if (!isSupportedImage(sourcePath)) {
    throw new Error('Formato não suportado. Use arquivos JPG, JPEG ou PNG.');
  }

  const sourceInfo = await stat(sourcePath);
  if (!sourceInfo.isFile()) throw new Error('O item selecionado não é um arquivo.');

  const destination = await uniqueDestination(outputRoot, relativePath, path.basename(sourcePath));
  const temporary = `${destination}.arc-temp-${process.pid}`;
  let method;

  try {
    method = await optimizeToTemporary(sourcePath, temporary, level);
    const optimizedInfo = await stat(temporary);

    if (optimizedInfo.size >= sourceInfo.size) {
      await rm(temporary, { force: true });
      await copyFile(sourcePath, destination);
      return {
        destination,
        originalBytes: sourceInfo.size,
        optimizedBytes: sourceInfo.size,
        savedBytes: 0,
        savedPercent: 0,
        method: 'O original já estava otimizado; foi copiado sem alterações'
      };
    }

    await rename(temporary, destination);
    const savedBytes = sourceInfo.size - optimizedInfo.size;
    return {
      destination,
      originalBytes: sourceInfo.size,
      optimizedBytes: optimizedInfo.size,
      savedBytes,
      savedPercent: sourceInfo.size === 0 ? 0 : (savedBytes / sourceInfo.size) * 100,
      method
    };
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}
