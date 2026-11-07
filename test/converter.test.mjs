import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { convertImage, conversionPreview, isSupportedConversionInput } from '../src/converter.mjs';

sharp.cache(false);

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-converter-'));
  const source = path.join(root, 'imagem transparente.png');
  await sharp({ create: { width: 60, height: 40, channels: 4, background: { r: 20, g: 100, b: 210, alpha: 0.5 } } }).png().toFile(source);
  return { root, source, output: path.join(root, 'saida') };
}

test('reconhece os formatos de entrada do conversor', () => {
  for (const extension of ['jpg', 'jpeg', 'png', 'webp', 'avif', 'tif', 'tiff', 'svg']) {
    assert.equal(isSupportedConversionInput(`imagem.${extension}`), true);
  }
  assert.equal(isSupportedConversionInput('imagem.bmp'), false);
});

test('converte PNG para WebP preservando dimensões e transparência', async (t) => {
  const paths = await fixture();
  t.after(() => rm(paths.root, { recursive: true, force: true }));
  const result = await convertImage({
    sourcePath: paths.source,
    relativePath: 'imagem transparente.png',
    outputRoot: paths.output,
    options: { format: 'webp', quality: 90, preserveColorProfile: true }
  });
  const metadata = await sharp(result.destination).metadata();
  assert.equal(path.extname(result.destination), '.webp');
  assert.equal(metadata.width, 60);
  assert.equal(metadata.height, 40);
  assert.equal(metadata.hasAlpha, true);
  assert.equal(result.outputFormat, 'WebP');
});

test('aplica fundo escolhido ao converter transparência para JPG', async (t) => {
  const paths = await fixture();
  t.after(() => rm(paths.root, { recursive: true, force: true }));
  const result = await convertImage({
    sourcePath: paths.source,
    relativePath: 'imagem transparente.png',
    outputRoot: paths.output,
    options: { format: 'jpeg', quality: 100, background: '#ffffff' }
  });
  const metadata = await sharp(result.destination).metadata();
  assert.equal(path.extname(result.destination), '.jpg');
  assert.equal(metadata.hasAlpha, false);
  assert.equal(result.outputFormat, 'JPG');
});

test('gera preview seguro para a interface', async (t) => {
  const paths = await fixture();
  t.after(() => rm(paths.root, { recursive: true, force: true }));
  const preview = await conversionPreview(paths.source, 320, 240);
  assert.match(preview.dataUrl, /^data:image\/webp;base64,/);
  assert.equal(preview.width, 60);
  assert.equal(preview.height, 40);
  assert.equal(preview.hasAlpha, true);
});
