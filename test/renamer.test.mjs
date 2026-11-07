import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildRenamePlan, isSupportedRenameInput, renameBatch, sanitizeFilenameBase } from '../src/renamer.mjs';

function item(filePath, id) {
  return { id, path: filePath, name: path.basename(filePath), size: 1 };
}

test('reconhece formatos de imagem atendidos pelo renomeador', () => {
  assert.equal(isSupportedRenameInput('foto.JPG'), true);
  assert.equal(isSupportedRenameInput('arte.svg'), true);
  assert.equal(isSupportedRenameInput('texto.txt'), false);
});

test('gera preview com tokens, numeração e transformação de caixa', () => {
  const items = [item('C:\\fotos\\minha foto.JPG', 'a'), item('C:\\fotos\\outra foto.png', 'b')];
  const plan = buildRenamePlan(items, { pattern: '{data}-{nome}-{n}', startNumber: 7, digits: 2, caseMode: 'upper' }, new Date(2026, 10, 7, 14, 30, 0));
  assert.equal(plan[0].newName, '2026-11-07-MINHA FOTO-07.JPG');
  assert.equal(plan[1].newName, '2026-11-07-OUTRA FOTO-08.png');
});

test('neutraliza nomes inválidos e resolve duplicatas no preview', () => {
  assert.equal(sanitizeFilenameBase('CON'), '_CON');
  assert.equal(sanitizeFilenameBase('foto: teste?. '), 'foto- teste-');
  const items = [item('C:\\a\\um.jpg', 'a'), item('C:\\b\\dois.jpg', 'b')];
  const plan = buildRenamePlan(items, { pattern: 'imagem', outputMode: 'copy' });
  assert.equal(plan[0].newName, 'imagem.jpg');
  assert.equal(plan[1].newName, 'imagem-2.jpg');
  assert.equal(plan[1].conflictAdjusted, true);
});

test('cria cópias renomeadas em uma pasta exclusiva', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'arc-renamer-copy-'));
  try {
    const source = path.join(directory, 'original.png');
    await writeFile(source, 'conteudo');
    const response = await renameBatch({
      items: [item(source, 'a')],
      outputRoot: directory,
      options: { pattern: 'produto-{n}', digits: 2, outputMode: 'copy' },
      now: new Date(2026, 10, 7, 10, 20, 30)
    });
    assert.equal(await readFile(source, 'utf8'), 'conteudo');
    assert.equal(await readFile(path.join(response.batchPath, 'produto-01.png'), 'utf8'), 'conteudo');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('renomeia originais sem sobrescrever arquivo externo', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'arc-renamer-original-'));
  try {
    const first = path.join(directory, 'um.jpg');
    const second = path.join(directory, 'dois.jpg');
    const occupied = path.join(directory, 'foto.jpg');
    await Promise.all([writeFile(first, 'um'), writeFile(second, 'dois'), writeFile(occupied, 'externo')]);
    const response = await renameBatch({
      items: [item(first, 'a'), item(second, 'b')],
      options: { pattern: 'foto', outputMode: 'original' }
    });
    assert.equal(await readFile(occupied, 'utf8'), 'externo');
    assert.equal(await readFile(path.join(directory, 'foto-2.jpg'), 'utf8'), 'um');
    assert.equal(await readFile(path.join(directory, 'foto-3.jpg'), 'utf8'), 'dois');
    assert.equal(response.outputMode, 'original');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
