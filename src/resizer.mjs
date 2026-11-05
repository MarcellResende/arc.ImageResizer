import { rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { isSupportedImage, uniqueDestination } from './optimizer.mjs';

const MAX_DIMENSION = 20000;

function positiveInteger(value, label) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_DIMENSION) {
    throw new Error(`${label} deve estar entre 1 e ${MAX_DIMENSION.toLocaleString('pt-BR')} pixels.`);
  }
  return parsed;
}

function orientedSize(metadata) {
  const rotated = [5, 6, 7, 8].includes(metadata.orientation);
  return {
    width: rotated ? metadata.height : metadata.width,
    height: rotated ? metadata.width : metadata.height
  };
}

function resizePlan(metadata, options = {}) {
  const source = orientedSize(metadata);
  if (!source.width || !source.height) throw new Error('Não foi possível identificar as dimensões da imagem.');

  if (options.mode === 'percentage') {
    const percentage = Number(options.percentage);
    if (!Number.isFinite(percentage) || percentage < 1 || percentage > 500) {
      throw new Error('A porcentagem deve estar entre 1% e 500%.');
    }
    return {
      width: Math.max(1, Math.round(source.width * percentage / 100)),
      height: Math.max(1, Math.round(source.height * percentage / 100)),
      fit: 'fill'
    };
  }

  const width = positiveInteger(options.width, 'A largura');
  const height = positiveInteger(options.height, 'A altura');

  if (options.mode === 'template') {
    return { width, height, fit: options.lockRatio === false ? 'fill' : 'cover' };
  }

  if (options.lockRatio === false) return { width, height, fit: 'fill' };

  const sourceRatio = source.width / source.height;
  if (options.primaryDimension === 'height') {
    return { width: Math.max(1, Math.round(height * sourceRatio)), height, fit: 'fill' };
  }
  return { width, height: Math.max(1, Math.round(width / sourceRatio)), fit: 'fill' };
}

export async function imageMetadata(sourcePath) {
  if (!isSupportedImage(sourcePath)) throw new Error('Formato não suportado.');
  const metadata = await sharp(sourcePath, { failOn: 'error' }).metadata();
  return orientedSize(metadata);
}

export async function resizeImage({ sourcePath, outputRoot, relativePath, options }) {
  if (!isSupportedImage(sourcePath)) {
    throw new Error('Formato não suportado. Use arquivos JPG, JPEG ou PNG.');
  }

  const sourceInfo = await stat(sourcePath);
  if (!sourceInfo.isFile()) throw new Error('O item selecionado não é um arquivo.');

  const image = sharp(sourcePath, { failOn: 'error', sequentialRead: true });
  const metadata = await image.metadata();
  const sourceSize = orientedSize(metadata);
  const plan = resizePlan(metadata, options);
  const destination = await uniqueDestination(outputRoot, relativePath, path.basename(sourcePath));
  const temporary = `${destination}.resize-temp-${process.pid}-${Math.random().toString(16).slice(2)}`;
  const extension = path.extname(sourcePath).toLowerCase();

  try {
    let pipeline = image.rotate().resize({
      width: plan.width,
      height: plan.height,
      fit: plan.fit,
      position: 'centre',
      withoutEnlargement: false
    });

    if (extension === '.png') {
      pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true, effort: 7 });
    } else {
      pipeline = pipeline.jpeg({ quality: 92, mozjpeg: true, progressive: true, chromaSubsampling: '4:4:4' });
    }

    const outputInfo = await pipeline.toFile(temporary);
    await rename(temporary, destination);

    return {
      destination,
      originalBytes: sourceInfo.size,
      outputBytes: outputInfo.size,
      originalWidth: sourceSize.width,
      originalHeight: sourceSize.height,
      outputWidth: outputInfo.width,
      outputHeight: outputInfo.height,
      method: options.mode === 'template'
        ? 'Redimensionada para o formato social selecionado'
        : 'Redimensionada com alta qualidade'
    };
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}
