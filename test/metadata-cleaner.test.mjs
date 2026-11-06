import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { cleanMetadataImage, inspectImageMetadata } from '../src/metadata-cleaner.mjs';

async function fixture(extension = 'jpg') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-metadata-'));
  const source = path.join(root, `entrada.${extension}`);
  const output = path.join(root, 'saida');
  let pipeline = sharp({
    create: { width: 80, height: 50, channels: 3, background: { r: 28, g: 126, b: 214 } }
  }).withExif({ IFD0: { Artist: 'ARC Test', Copyright: 'Private', Software: 'Adobe Firefly' } });
  pipeline = extension === 'png' ? pipeline.png() : pipeline.withIccProfile('srgb').jpeg({ quality: 92 });
  await pipeline.toFile(source);
  return { root, source, output };
}

test('detecta e remove EXIF de JPEG sem alterar suas dimensões', async (t) => {
  const paths = await fixture('jpg');
  t.after(() => rm(paths.root, { recursive: true, force: true }));

  const before = await inspectImageMetadata(paths.source);
  assert.equal(before.types.some((type) => type.id === 'exif'), true);
  assert.equal(before.detailCount > 10, true);
  assert.equal(before.groups.includes('EXIF'), true);
  assert.equal(before.origin.software, 'Adobe Firefly');
  assert.equal(before.ai.status, 'detected');

  const result = await cleanMetadataImage({
    sourcePath: paths.source,
    relativePath: 'entrada.jpg',
    outputRoot: paths.output,
    preserveColorProfile: false
  });
  const after = await inspectImageMetadata(result.destination);
  assert.equal(after.types.some((type) => type.id === 'exif'), false);
  assert.equal(after.hasMetadata, false);
  assert.equal(after.width, before.width);
  assert.equal(after.height, before.height);
  assert.deepEqual(result.removedTypes.includes('EXIF / câmera / localização'), true);
});

test('preserva o perfil de cores quando solicitado', async (t) => {
  const paths = await fixture('jpg');
  t.after(() => rm(paths.root, { recursive: true, force: true }));

  const result = await cleanMetadataImage({
    sourcePath: paths.source,
    relativePath: 'entrada.jpg',
    outputRoot: paths.output,
    preserveColorProfile: true
  });
  const after = await inspectImageMetadata(result.destination);
  assert.equal(after.types.some((type) => type.id === 'exif'), false);
  assert.equal(after.hasColorProfile, true);
  assert.equal(result.preservedColorProfile, true);
});

test('limpa PNG sem perda de dimensões', async (t) => {
  const paths = await fixture('png');
  t.after(() => rm(paths.root, { recursive: true, force: true }));

  const beforePixels = await sharp(paths.source).raw().toBuffer();
  const result = await cleanMetadataImage({
    sourcePath: paths.source,
    relativePath: 'entrada.png',
    outputRoot: paths.output,
    preserveColorProfile: false
  });
  const after = await inspectImageMetadata(result.destination);
  const afterPixels = await sharp(result.destination).raw().toBuffer();
  assert.equal(after.types.some((type) => type.id === 'exif'), false);
  assert.deepEqual(afterPixels, beforePixels);
});

test('remove e verifica rastros de IA e Content Credentials de PNG', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-ai-metadata-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.resolve('src/renderer/assets/logos/logo-image-compressor.png');
  const before = await inspectImageMetadata(source);

  assert.notEqual(before.ai.status, 'unknown');
  assert.equal(before.types.some((type) => type.id === 'provenance'), true);

  const result = await cleanMetadataImage({
    sourcePath: source,
    relativePath: 'logo-image-compressor.png',
    outputRoot: root,
    preserveColorProfile: true
  });
  const after = await inspectImageMetadata(result.destination);

  assert.equal(result.hadAiSignals, true);
  assert.equal(result.aiSignalsRemoved, true);
  assert.equal(after.ai.status, 'unknown');
  assert.equal(after.types.some((type) => type.id === 'provenance'), false);
});

test('neutraliza nome de arquivo que revela um gerador de IA', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-ai-name-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'Imagem do ChatGPT.png');
  await sharp({ create: { width: 20, height: 20, channels: 3, background: '#305eb8' } }).png().toFile(source);

  const result = await cleanMetadataImage({
    sourcePath: source,
    relativePath: 'Imagem do ChatGPT.png',
    outputRoot: path.join(root, 'saida'),
    preserveColorProfile: true
  });

  assert.equal(result.filenameAnonymized, true);
  assert.equal(path.basename(result.destination), 'imagem-limpa.png');
  assert.equal(result.hadAiSignals, true);
  assert.equal(result.aiSignalsRemoved, true);
});
