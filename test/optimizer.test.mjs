import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { createBatchDirectory, isSupportedImage, optimizeImage, uniqueDestination } from '../src/optimizer.mjs';

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDzqiiiv6TP50P/2Q==';

test('reconhece somente os formatos atendidos pelo modo sem perda', () => {
  assert.equal(isSupportedImage('foto.JPG'), true);
  assert.equal(isSupportedImage('imagem.png'), true);
  assert.equal(isSupportedImage('animacao.gif'), false);
  assert.equal(isSupportedImage('documento.txt'), false);
});

test('não sobrescreve um arquivo de saída existente', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-resizer-'));
  try {
    await mkdir(path.join(root, 'album'));
    await writeFile(path.join(root, 'album', 'foto.png'), 'existente');
    const destination = await uniqueDestination(root, path.join('album', 'foto.png'), 'foto.png');
    assert.equal(destination, path.join(root, 'album', 'foto (2).png'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('cada processamento recebe uma subpasta exclusiva', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-resizer-'));
  const instant = new Date(2026, 10, 5, 14, 30, 12);
  try {
    const first = await createBatchDirectory(root, instant);
    const second = await createBatchDirectory(root, instant);
    assert.equal(path.basename(first), 'Lote 2026-11-05 14-30-12');
    assert.equal(path.basename(second), 'Lote 2026-11-05 14-30-12-02');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('otimiza PNG e mantém um arquivo válido sem aumentar o tamanho', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-resizer-'));
  const source = path.join(root, 'pixel.png');
  const output = path.join(root, 'output');
  try {
    const original = Buffer.from(PNG_BASE64, 'base64');
    await writeFile(source, original);
    const result = await optimizeImage({ sourcePath: source, outputRoot: output, relativePath: 'pixel.png' });
    const optimized = await readFile(result.destination);
    assert.equal(optimized.subarray(1, 4).toString('ascii'), 'PNG');
    assert.ok(optimized.length <= original.length);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('otimiza JPEG sem aumentar o tamanho', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-resizer-'));
  const source = path.join(root, 'foto.jpg');
  const output = path.join(root, 'output');
  try {
    const original = Buffer.from(JPEG_BASE64, 'base64');
    await writeFile(source, original);
    const result = await optimizeImage({ sourcePath: source, outputRoot: output, relativePath: 'foto.jpg' });
    const optimized = await readFile(result.destination);
    assert.equal(optimized[0], 0xff);
    assert.equal(optimized[1], 0xd8);
    assert.ok(optimized.length <= original.length);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('modo de redução forte diminui um JPEG mantendo formato válido', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'arc-resizer-'));
  const source = path.join(root, 'foto-grande.jpg');
  const output = path.join(root, 'output');
  try {
    await sharp({
      create: {
        width: 1400,
        height: 900,
        channels: 3,
        background: { r: 28, g: 115, b: 210 }
      }
    }).jpeg({ quality: 100, chromaSubsampling: '4:4:4' }).toFile(source);

    const result = await optimizeImage({
      sourcePath: source,
      outputRoot: output,
      relativePath: 'foto-grande.jpg',
      level: 'compact'
    });
    const optimized = await readFile(result.destination);
    assert.equal(optimized[0], 0xff);
    assert.equal(optimized[1], 0xd8);
    assert.ok(result.optimizedBytes < result.originalBytes);
    assert.match(result.method, /alta fidelidade visual/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
