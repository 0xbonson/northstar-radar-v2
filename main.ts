import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript } from './src/board.ts';
import { parseSnapshot } from './src/snapshot.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const DASHBOARD_CAPS = { max_files: 400, max_bytes: 4_194_304 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEq = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEq === undefined ? fallback : withEq.slice(name.length + 3);
}

function copyDirFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(from).sort()) {
    if (name.startsWith('.')) continue;
    const p = join(from, name);
    if (!statSync(p).isFile()) continue;
    copyFileSync(p, join(to, name));
    names.push(name);
  }
  return names;
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot found at ${inputFile}\n`);
  process.exit(2);
}

const outDir = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const dataOnly = process.argv.includes('--data-only');
const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: invalid board: ${issue}\n`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board, model: radar.model })}\n`);
writeFileSync(join(outDir, 'data.js'), dataScript(radar));

const dashFiles = copyDirFiles(join(here, 'dashboard'), join(outDir, 'dashboard'));
if (dataOnly) {
  process.stdout.write(`token radar: wrote ${outDir} data (${board.length} rows, ${dashFiles.length} dashboard files)\n`);
  process.exit(0);
}
const shots = copyDirFiles(join(here, 'screenshots'), join(outDir, 'screenshots'));

if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ has ${shots.length} image(s); need 3 screenshots before building dossier.json\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: invalid screenshot filename ${name}\n`);
    process.exit(1);
  }
}

const dossier = buildDossier(outDir, {
  text_max_bytes: TEXT_MAX_BYTES,
  screenshots: SCREENSHOT_CAPS,
  dashboard: DASHBOARD_CAPS,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols | ${radar.watchlist_size} watchlist | ` +
    `${board.length} pre-token (${radar.early_size} early) | ${radar.peer_mcap_size} peers | ${radar.excluded_size} excluded\n` +
    `token radar: split=${radar.model.split_used} | formula: ${radar.model.formula_line}\n` +
    `token radar: wrote ${outDir} (${dashFiles.length} dashboard files, ${shots.length} screenshots, ${dossier.length}B dossier)\n`,
);
