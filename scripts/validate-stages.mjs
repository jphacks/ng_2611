import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAX_STAGE_FILE_BYTES,
  validateStageCollection,
} from '../packages/stage-schema/index.js';

const stageDirectory = fileURLToPath(new URL('../src/data/stages/', import.meta.url));

function formatDiagnostic(diagnostic) {
  const location = diagnostic.file ? `${diagnostic.file}: ` : '';
  return `  ${location}${diagnostic.code} ${diagnostic.message}`;
}

async function main() {
  let fileNames;
  try {
    fileNames = (await readdir(stageDirectory))
      .filter((fileName) => fileName.endsWith('.json'))
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    console.error(`ステージフォルダを読み込めません: ${stageDirectory}`);
    console.error(error);
    process.exitCode = 1;
    return;
  }

  const fileErrors = [];
  const entries = [];

  for (const file of fileNames) {
    const filePath = join(stageDirectory, file);
    const fileStat = await stat(filePath);
    if (fileStat.size > MAX_STAGE_FILE_BYTES) {
      fileErrors.push({
        severity: 'error',
        code: 'E015',
        message: `ファイルサイズが上限（${MAX_STAGE_FILE_BYTES} bytes）を超えています`,
        file,
      });
    }

    try {
      const source = await readFile(filePath, 'utf8');
      entries.push({ file, stage: JSON.parse(source) });
    } catch (error) {
      fileErrors.push({
        severity: 'error',
        code: 'E001',
        message: `JSONとして読み込めません: ${error.message}`,
        file,
      });
    }
  }

  const result = validateStageCollection(entries);
  const errors = [...fileErrors, ...result.errors];
  const warnings = result.warnings;

  if (warnings.length > 0) {
    console.warn(`警告 ${warnings.length}件`);
    for (const warning of warnings) console.warn(formatDiagnostic(warning));
  }

  if (errors.length > 0) {
    console.error(`エラー ${errors.length}件`);
    for (const error of errors) console.error(formatDiagnostic(error));
    console.error(`ステージ検証に失敗しました（${fileNames.length}ファイル確認）`);
    process.exitCode = 1;
    return;
  }

  console.log(`ステージ検証OK: ${fileNames.length}ファイル`);
}

await main();

