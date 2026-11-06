import { spawn } from 'node:child_process';
import { copyFile, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExifReader from 'exifreader';
import sharp from 'sharp';
import { isSupportedImage, uniqueDestination } from './optimizer.mjs';

const jpegtranPath = fileURLToPath(new URL('../vendor/jpegtran.exe', import.meta.url));

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
    child.stderr.on('data', (chunk) => { errorText += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(errorText.trim() || `A limpeza terminou com o código ${code}.`));
    });
  });
}

function byteLength(value) {
  if (!value) return 0;
  if (Buffer.isBuffer(value)) return value.length;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + Buffer.byteLength(String(item)), 0);
  return Buffer.byteLength(String(value));
}

function metadataTypes(metadata) {
  const types = [];
  if (metadata.exif) types.push({ id: 'exif', label: 'EXIF / câmera / localização', bytes: byteLength(metadata.exif) });
  if (metadata.xmp) types.push({ id: 'xmp', label: 'XMP', bytes: byteLength(metadata.xmp) });
  if (metadata.iptc) types.push({ id: 'iptc', label: 'IPTC', bytes: byteLength(metadata.iptc) });
  if (metadata.comments?.length) types.push({ id: 'comments', label: 'Comentários', bytes: byteLength(metadata.comments) });
  if (metadata.icc) types.push({ id: 'icc', label: 'Perfil de cores', bytes: byteLength(metadata.icc) });
  return types;
}

const GROUP_LABELS = {
  file: 'Arquivo e imagem',
  jfif: 'JFIF',
  exif: 'EXIF',
  gps: 'Localização GPS',
  iptc: 'IPTC',
  xmp: 'XMP',
  icc: 'Perfil de cores ICC',
  photoshop: 'Adobe Photoshop',
  makerNotes: 'Dados do fabricante',
  mpf: 'Multi-Picture Format',
  png: 'Metadados PNG',
  pngFile: 'Estrutura PNG',
  pngText: 'Textos PNG',
  riff: 'RIFF / WebP',
  gif: 'GIF',
  composite: 'Dados calculados',
  thumbnail: 'Miniatura incorporada'
};

function safeValue(value) {
  if (value === undefined || value === null) return '—';
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return `<dados binários · ${value.length.toLocaleString('pt-BR')} bytes>`;
  if (typeof value === 'string') return value || '—';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    const json = JSON.stringify(value, (_key, item) => {
      if (Buffer.isBuffer(item) || item instanceof Uint8Array) return `<dados binários · ${item.length} bytes>`;
      return item;
    });
    return json.length > 2400 ? `${json.slice(0, 2400)}…` : json;
  } catch {
    return String(value);
  }
}

function tagValue(tag) {
  if (tag === undefined || tag === null) return '—';
  if (typeof tag !== 'object' || Buffer.isBuffer(tag) || tag instanceof Uint8Array) return safeValue(tag);
  if (tag.description !== undefined && tag.description !== '') return safeValue(tag.description);
  if (tag.value !== undefined) return safeValue(tag.value);
  return safeValue(tag);
}

function flattenMetadataGroups(groups) {
  const details = [];
  for (const [groupId, group] of Object.entries(groups || {})) {
    if (!group || typeof group !== 'object') continue;
    if (groupId === 'png' && groups.pngFile) continue;
    const groupLabel = GROUP_LABELS[groupId] || groupId;
    if (groupId === 'thumbnail') {
      details.push({ group: groupLabel, groupId, name: 'Miniatura', value: tagValue(group) });
      continue;
    }
    for (const [name, tag] of Object.entries(group)) {
      details.push({
        group: groupLabel,
        groupId,
        name,
        value: tagValue(tag),
        id: Number.isFinite(tag?.id) ? `0x${tag.id.toString(16).toUpperCase()}` : ''
      });
    }
  }
  return details;
}

function findDetail(details, names, groupId = null) {
  const normalized = names.map((name) => name.toLowerCase().replaceAll(/[^a-z0-9]/g, ''));
  return details.find((detail) => {
    if (groupId && detail.groupId !== groupId) return false;
    return normalized.includes(detail.name.toLowerCase().replaceAll(/[^a-z0-9]/g, ''));
  });
}

const AI_GENERATORS = [
  ['Adobe Firefly', /\bfirefly\b/i],
  ['OpenAI / DALL·E / ChatGPT', /\b(openai|dall[· ._-]?e|chatgpt)\b/i],
  ['Midjourney', /\bmidjourney\b/i],
  ['Stable Diffusion', /\b(stable diffusion|automatic1111|a1111|comfyui|invokeai|fooocus|dreamstudio)\b/i],
  ['Google Gemini / Imagen', /\b(gemini|imagen\s*[234]?)\b/i],
  ['Microsoft Copilot / Designer', /\b(microsoft designer|copilot)\b/i],
  ['FLUX', /\b(black forest labs|flux[ ._-]?[1-9])\b/i],
  ['Ideogram', /\bideogram\b/i],
  ['Leonardo AI', /\bleonardo(?:\.ai| ai)?\b/i],
  ['Runway', /\brunway(?:ml)?\b/i],
  ['NovelAI', /\bnovelai\b/i],
  ['Anthropic / Claude', /\b(anthropic|claude)\b/i]
];

export function detectAiOrigin(details, rawText = '') {
  const metadataText = details.map((detail) => `${detail.name}: ${detail.value}`).join('\n');
  const searchable = `${metadataText}\n${rawText}`;
  const generatorMatch = AI_GENERATORS.find(([, pattern]) => pattern.test(searchable));
  const hasDigitalSource = /(trainedalgorithmicmedia|compositewithtrainedalgorithmicmedia|algorithmicmedia|compositesynthetic)/i.test(searchable);
  const hasC2pa = /(^|[^a-z])(c2pa|jumbf|content credentials?)([^a-z]|$)/i.test(searchable);
  const hasExplicitAi = /(ai[ -]?generated|generated by (?:an? )?ai|generative ai|synthetic media|text[ -]?to[ -]?image|txt2img|img2img)/i.test(searchable);
  const hasPrompt = details.some((detail) => /(negative.?prompt|prompt|generation.?parameters|workflow)/i.test(detail.name));
  const evidence = [];
  if (hasDigitalSource) evidence.push('DigitalSourceType identifica mídia algorítmica');
  if (hasC2pa) evidence.push('Content Credentials / C2PA encontrados');
  if (generatorMatch) evidence.push(`Software ou criador associado a ${generatorMatch[0]}`);
  if (hasExplicitAi) evidence.push('Declaração explícita de conteúdo gerado por IA');
  if (hasPrompt) evidence.push('Prompt ou parâmetros de geração encontrados');

  const highConfidence = hasDigitalSource || hasExplicitAi || Boolean(generatorMatch);
  const possible = Boolean(generatorMatch) || hasPrompt || hasC2pa;
  if (highConfidence) {
    return { status: 'detected', label: 'Sinais fortes de geração por IA', confidence: 'alta', generator: generatorMatch?.[0] || '', evidence };
  }
  if (possible) {
    return { status: 'possible', label: 'Possíveis sinais de IA', confidence: 'moderada', generator: generatorMatch?.[0] || '', evidence };
  }
  return {
    status: 'unknown',
    label: 'Nenhum sinal de IA encontrado',
    confidence: 'indeterminada',
    generator: '',
    evidence: ['A ausência de metadados não comprova que a imagem não foi gerada por IA.']
  };
}

function buildOriginSummary(details) {
  const read = (names, groupId = null) => findDetail(details, names, groupId)?.value || '';
  const latitude = read(['Latitude'], 'gps') || read(['GPSLatitude']);
  const longitude = read(['Longitude'], 'gps') || read(['GPSLongitude']);
  const altitude = read(['Altitude'], 'gps') || read(['GPSAltitude']);
  const make = read(['Make']);
  const model = read(['Model']);
  const lens = read(['LensModel', 'Lens']);
  return {
    capturedAt: read(['DateTimeOriginal', 'CreateDate', 'DateTimeDigitized', 'DateTime', 'ModifyDate']),
    device: [make, model].filter(Boolean).join(' ') || '',
    lens,
    software: read(['Software', 'CreatorTool', 'HistorySoftwareAgent']),
    author: read(['Artist', 'Creator', 'By-line', 'Author']),
    copyright: read(['Copyright', 'CopyrightNotice', 'Rights']),
    location: latitude && longitude ? { latitude, longitude, altitude } : null
  };
}

function buildMetadataHealth(details, origin) {
  const hasExif = details.some((detail) => detail.groupId === 'exif');
  const hasGps = Boolean(origin.location) || details.some((detail) => detail.groupId === 'gps' || /^GPS/i.test(detail.name));
  const hasCaptureData = Boolean(origin.device || origin.lens || origin.capturedAt);
  if (!hasExif && !hasGps && !hasCaptureData) {
    return {
      status: 'missing',
      label: 'EXIF de câmera e GPS ausente',
      detail: 'O arquivo pode ter sido reprocessado por WhatsApp, rede social ou editor. Dados já removidos não podem ser recuperados.'
    };
  }
  if (!hasGps) {
    return {
      status: 'partial',
      label: 'EXIF encontrado, mas sem GPS',
      detail: 'O dispositivo ou a configuração de privacidade pode não ter gravado a localização.'
    };
  }
  return { status: 'complete', label: 'Dados de captura encontrados', detail: 'O arquivo contém informações de dispositivo e/ou localização.' };
}

function addMetadataType(types, id, label, bytes = 0) {
  if (!types.some((type) => type.id === id)) types.push({ id, label, bytes });
}

const AI_FILENAME_PATTERN = /(?:chatgpt|openai|dall[· ._-]?e|midjourney|stable[ ._-]?diffusion|gemini|imagen|firefly|copilot|ideogram|leonardo[ ._-]?ai|flux[ ._-]?[1-9]?|generated[ ._-]?image|ai[ ._-]?generated|generated[ ._-]?(?:by[ ._-]?)?ai|imagem[ ._-]?gerada[ ._-]?(?:por[ ._-]?)?ia)/i;

function anonymizeAiFilename(relativePath, sourcePath) {
  const safeRelative = relativePath || path.basename(sourcePath);
  const parsed = path.parse(safeRelative);
  if (!AI_FILENAME_PATTERN.test(parsed.name)) return { relativePath: safeRelative, anonymized: false };
  return {
    relativePath: path.join(parsed.dir, `imagem-limpa${parsed.ext.toLowerCase()}`),
    anonymized: true
  };
}

export async function inspectImageMetadata(sourcePath) {
  if (!isSupportedImage(sourcePath)) throw new Error('Formato não suportado. Use arquivos JPG, JPEG ou PNG.');
  const [info, metadata, expanded, fileBuffer] = await Promise.all([
    stat(sourcePath),
    sharp(sourcePath, { failOn: 'error', sequentialRead: true }).metadata(),
    ExifReader.load(sourcePath, { expanded: true, async: true }),
    readFile(sourcePath)
  ]);
  if (!info.isFile()) throw new Error('O item selecionado não é um arquivo.');
  const types = metadataTypes(metadata);
  const details = flattenMetadataGroups(expanded);
  const rawText = fileBuffer.subarray(0, Math.min(fileBuffer.length, 64 * 1024 * 1024)).toString('latin1');
  const ai = detectAiOrigin(details, rawText);
  const hasC2pa = /\b(c2pa|jumbf)\b/i.test(rawText);
  if (hasC2pa && !details.some((detail) => detail.groupId === 'provenance')) {
    details.push({ group: 'Proveniência e autenticidade', groupId: 'provenance', name: 'Content Credentials', value: 'Bloco C2PA / JUMBF encontrado', id: '' });
  }
  const detailedTypes = [
    ['photoshop', 'Dados do Photoshop'],
    ['makerNotes', 'Dados do fabricante'],
    ['pngText', 'Textos e dados PNG'],
    ['mpf', 'Multi-Picture Format']
  ];
  for (const [id, label] of detailedTypes) {
    if (details.some((detail) => detail.groupId === id)) addMetadataType(types, id, label);
  }
  if (hasC2pa || ai.status !== 'unknown') addMetadataType(types, 'provenance', 'Content Credentials / sinais de IA');
  const origin = buildOriginSummary(details);
  return {
    format: metadata.format,
    width: metadata.width,
    height: metadata.height,
    orientation: metadata.orientation || 1,
    types,
    metadataBytes: types.reduce((sum, type) => sum + type.bytes, 0),
    hasMetadata: types.length > 0,
    hasRemovableMetadata: types.some((type) => type.id !== 'icc'),
    hasColorProfile: Boolean(metadata.icc),
    details,
    detailCount: details.length,
    groups: [...new Set(details.map((detail) => detail.group))],
    origin,
    ai,
    metadataHealth: buildMetadataHealth(details, origin)
  };
}

function jpegTransformArgs(orientation) {
  const transforms = {
    2: ['-flip', 'horizontal'],
    3: ['-rotate', '180'],
    4: ['-flip', 'vertical'],
    5: ['-transpose'],
    6: ['-rotate', '90'],
    7: ['-transverse'],
    8: ['-rotate', '270']
  };
  return transforms[orientation] || [];
}

function extractJpegIccSegments(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return [];
  const segments = [];
  let offset = 2;
  while (offset + 4 <= buffer.length && buffer[offset] === 0xff) {
    const markerStart = offset;
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    const end = offset + length;
    if (length < 2 || end > buffer.length) break;
    if (marker === 0xe2 && buffer.subarray(offset + 2, Math.min(end, offset + 14)).toString('ascii') === 'ICC_PROFILE\0') {
      segments.push(buffer.subarray(markerStart, end));
    }
    offset = end;
  }
  return segments;
}

async function restoreJpegColorProfile(sourcePath, destinationPath) {
  const source = await readFile(sourcePath);
  const iccSegments = extractJpegIccSegments(source);
  if (!iccSegments.length) return;
  const output = await readFile(destinationPath);
  if (output[0] !== 0xff || output[1] !== 0xd8) return;
  await writeFile(destinationPath, Buffer.concat([output.subarray(0, 2), ...iccSegments, output.subarray(2)]));
}

async function cleanJpeg(sourcePath, temporaryPath, metadata, preserveColorProfile) {
  const args = [
    '-copy', 'none',
    '-optimize',
    '-progressive',
    ...jpegTransformArgs(metadata.orientation),
    '-outfile', temporaryPath,
    sourcePath
  ];
  await run(jpegtranPath, args);
  if (preserveColorProfile && metadata.hasColorProfile) {
    await restoreJpegColorProfile(sourcePath, temporaryPath);
  }
}

async function cleanPng(sourcePath, temporaryPath, preserveColorProfile) {
  let pipeline = sharp(sourcePath, { failOn: 'error', sequentialRead: true }).autoOrient();
  if (preserveColorProfile) pipeline = pipeline.keepIccProfile();
  await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(temporaryPath);
}

export async function cleanMetadataImage({ sourcePath, outputRoot, relativePath, preserveColorProfile = true }) {
  const metadata = await inspectImageMetadata(sourcePath);
  const removableTypes = metadata.types.filter((type) => !(preserveColorProfile && type.id === 'icc'));
  const outputName = anonymizeAiFilename(relativePath, sourcePath);
  const destination = await uniqueDestination(outputRoot, outputName.relativePath, path.basename(sourcePath));
  const sourceInfo = await stat(sourcePath);
  const hadAiSignals = metadata.ai.status !== 'unknown' || outputName.anonymized;

  if (!removableTypes.length) {
    await copyFile(sourcePath, destination);
    return {
      destination,
      originalBytes: sourceInfo.size,
      cleanedBytes: sourceInfo.size,
      removedTypes: [],
      removedMetadataBytes: 0,
      alreadyClean: true,
      preservedColorProfile: preserveColorProfile && metadata.hasColorProfile,
      filenameAnonymized: outputName.anonymized,
      hadAiSignals,
      aiSignalsRemoved: metadata.ai.status === 'unknown',
      verification: outputName.anonymized
        ? 'O nome que revelava o gerador de IA foi neutralizado'
        : (metadata.ai.status === 'unknown' ? 'Nenhum sinal de IA estava presente' : 'O arquivo não foi alterado')
    };
  }

  const temporary = `${destination}.arc-metadata-${process.pid}`;
  try {
    const extension = path.extname(sourcePath).toLowerCase();
    if (extension === '.png') await cleanPng(sourcePath, temporary, preserveColorProfile);
    else await cleanJpeg(sourcePath, temporary, metadata, preserveColorProfile);
    await rename(temporary, destination);
    const outputInfo = await stat(destination);
    const verified = await inspectImageMetadata(destination);
    return {
      destination,
      originalBytes: sourceInfo.size,
      cleanedBytes: outputInfo.size,
      removedTypes: removableTypes.map((type) => type.label),
      removedMetadataBytes: removableTypes.reduce((sum, type) => sum + type.bytes, 0),
      alreadyClean: false,
      preservedColorProfile: preserveColorProfile && metadata.hasColorProfile,
      filenameAnonymized: outputName.anonymized,
      hadAiSignals,
      aiSignalsRemoved: verified.ai.status === 'unknown',
      verification: verified.ai.status === 'unknown'
        ? 'EXIF, C2PA, software gerador, prompts e sinais de IA não foram encontrados no resultado'
        : 'Ainda existem possíveis sinais de origem no arquivo resultante',
      remainingMetadataCount: verified.detailCount
    };
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}
