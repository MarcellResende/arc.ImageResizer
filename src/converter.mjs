import { rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { uniqueDestination } from './optimizer.mjs';

const INPUT_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff', '.svg']);
const OUTPUT_FORMATS = {
  jpeg: { extension: '.jpg', label: 'JPG' },
  png: { extension: '.png', label: 'PNG' },
  webp: { extension: '.webp', label: 'WebP' },
  avif: { extension: '.avif', label: 'AVIF' }
};

export function isSupportedConversionInput(filePath) {
  return INPUT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function conversionOptions(options = {}) {
  const format = String(options.format || 'webp').toLowerCase();
  if (!OUTPUT_FORMATS[format]) throw new Error('Formato de saída inválido.');
  const quality = Math.round(Number(options.quality ?? 88));
  if (!Number.isFinite(quality) || quality < 1 || quality > 100) throw new Error('A qualidade deve estar entre 1 e 100.');
  return {
    format,
    quality,
    lossless: Boolean(options.lossless) && ['webp', 'avif'].includes(format),
    background: /^#[0-9a-f]{6}$/i.test(options.background || '') ? options.background : '#ffffff',
    preserveColorProfile: options.preserveColorProfile !== false,
    keepMetadata: Boolean(options.keepMetadata)
  };
}

function outputRelativePath(relativePath, sourcePath, format) {
  const parsed = path.parse(relativePath || path.basename(sourcePath));
  return path.join(parsed.dir, `${parsed.name}${OUTPUT_FORMATS[format].extension}`);
}

function applyOutputFormat(pipeline, options) {
  if (options.format === 'jpeg') {
    return pipeline.flatten({ background: options.background }).jpeg({
      quality: options.quality,
      mozjpeg: true,
      progressive: true,
      chromaSubsampling: options.quality >= 90 ? '4:4:4' : '4:2:0'
    });
  }
  if (options.format === 'png') {
    return pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, effort: 7 });
  }
  if (options.format === 'avif') {
    return pipeline.avif({
      quality: options.quality,
      lossless: options.lossless,
      effort: 6,
      chromaSubsampling: '4:4:4'
    });
  }
  return pipeline.webp({
    quality: options.quality,
    alphaQuality: 100,
    lossless: options.lossless,
    smartSubsample: true,
    effort: 6
  });
}

export async function conversionPreview(sourcePath, maxWidth = 900, maxHeight = 700) {
  if (!isSupportedConversionInput(sourcePath)) throw new Error('Formato de entrada não suportado.');
  const image = sharp(sourcePath, { failOn: 'error', sequentialRead: true });
  const metadata = await image.metadata();
  if ((metadata.pages || 1) > 1) throw new Error('Imagens animadas ou com várias páginas ainda não são suportadas.');
  const width = Math.min(1200, Math.max(80, Math.round(Number(maxWidth) || 900)));
  const height = Math.min(900, Math.max(80, Math.round(Number(maxHeight) || 700)));
  const buffer = await image.autoOrient().resize({ width, height, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86, effort: 4 }).toBuffer();
  return {
    dataUrl: `data:image/webp;base64,${buffer.toString('base64')}`,
    format: metadata.format || path.extname(sourcePath).slice(1),
    width: metadata.width,
    height: metadata.height,
    hasAlpha: Boolean(metadata.hasAlpha),
    pages: metadata.pages || 1
  };
}

export async function convertImage({ sourcePath, outputRoot, relativePath, options }) {
  if (!isSupportedConversionInput(sourcePath)) {
    throw new Error('Formato não suportado. Use JPG, PNG, WebP, AVIF, TIFF ou SVG.');
  }
  const normalized = conversionOptions(options);
  const sourceInfo = await stat(sourcePath);
  if (!sourceInfo.isFile()) throw new Error('O item selecionado não é um arquivo.');

  const image = sharp(sourcePath, { failOn: 'error', sequentialRead: true });
  const metadata = await image.metadata();
  if ((metadata.pages || 1) > 1) throw new Error('Imagens animadas ou TIFFs com várias páginas ainda não são suportados.');

  const relativeOutput = outputRelativePath(relativePath, sourcePath, normalized.format);
  const destination = await uniqueDestination(outputRoot, relativeOutput, path.basename(relativeOutput));
  const temporary = `${destination}.convert-temp-${process.pid}-${Math.random().toString(16).slice(2)}`;

  try {
    let pipeline = image.autoOrient();
    if (normalized.keepMetadata) pipeline = pipeline.keepMetadata();
    else if (normalized.preserveColorProfile && metadata.icc) pipeline = pipeline.keepIccProfile();
    pipeline = applyOutputFormat(pipeline, normalized);
    const outputInfo = await pipeline.toFile(temporary);
    await rename(temporary, destination);

    return {
      destination,
      originalBytes: sourceInfo.size,
      outputBytes: outputInfo.size,
      width: outputInfo.width,
      height: outputInfo.height,
      inputFormat: String(metadata.format || path.extname(sourcePath).slice(1)).toUpperCase(),
      outputFormat: OUTPUT_FORMATS[normalized.format].label,
      lossless: normalized.lossless || normalized.format === 'png',
      metadataPreserved: normalized.keepMetadata,
      colorProfilePreserved: normalized.keepMetadata || (normalized.preserveColorProfile && Boolean(metadata.icc))
    };
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}
