import { validateStageCollection } from '../../packages/stage-schema/index.js';

const stageModules = import.meta.glob('./stages/*.json', {
  eager: true,
  import: 'default',
});

const entries = Object.entries(stageModules).map(([path, stage]) => ({
  file: path.split('/').pop(),
  stage,
}));

const { ok, errors, warnings } = validateStageCollection(entries);

if (warnings.length > 0) {
  console.warn(
    `[stages] ${warnings.length}件の警告があります\n${warnings
      .map((warning) => `  ${warning.file ?? 'stages'}: ${warning.code} ${warning.message}`)
      .join('\n')}`,
  );
}

if (!ok) {
  const details = errors
    .map((error) => `  ${error.file ?? 'stages'}: ${error.code} ${error.message}`)
    .join('\n');
  throw new Error(`ステージデータが不正です。\n${details}`);
}

const STAGES = entries
  .map(({ stage }) => stage)
  .sort((a, b) => a.number - b.number || a.id.localeCompare(b.id));

export default STAGES;

