const fs = require('fs');
const path = require('path');

// Regenerates the repo's Docsify _sidebar.md. Run after adding/removing
// files in any exam folder, or after registering a new exam.
const ROOT = path.resolve(__dirname, '..');
const EXAMS = [
  { vendor: 'AWS', folder: 'AWSDEA', label: 'AWS · Data Engineer Associate (DEA-C01)' },
  { vendor: 'AWS', folder: 'AWSAIF', label: 'AWS · AI Practitioner (AIF-C01)' },
  { vendor: 'GCP', folder: 'GCPPCA', label: 'GCP · Professional Cloud Architect' },
  { vendor: 'GCP', folder: 'PAA', label: 'GCP · Professional Agentic Architect (Beta)' },
];
const NUMBERED = ['00-START-HERE','01-domains','02-services','03-comparisons','04-architectures','05-labs','06-practice','07-revision','08-interview','09-assets'];
const EXAM_ROOT_SKIP = new Set(['README.md', 'CLAUDE.md', 'GEMINI.md', 'AGENTS.md', 'llms.txt']);

// Acronyms/initialisms used across the exam folders (grounded in actual filenames plus
// each exam's own required vocabulary, e.g. PAA CLAUDE.md §8) — rendered upper-case
// regardless of how the source filename cased them.
const ACRONYMS = new Set([
  'aws', 'dea', 'aif', 'pca', 'paa', 'gcp',
  'iam', 'kms', 'dms', 'emr', 'msk', 'mwaa', 'efs', 'cdc', 's3',
  'ml', 'ai', 'sql', 'api', 'rag',
  'gke', 'vpc', 'dr', 'ha', 'ehr',
  'adk', 'mcp', 'a2a', 'cx', 'llm', 'slm', 'hitl', 'pab',
]);
// Tokens with a non-simple-uppercase canonical rendering.
const SPECIAL_CASE = { cicd: 'CI/CD', oauth: 'OAuth' };
// Small connector words that stay lowercase mid-title (but not as the first word).
const CONNECTORS = new Set(['and', 'or', 'of', 'to', 'vs', 'on', 'in', 'a', 'the', 'for', 'with']);

function isAllUpper(w) { return /^[A-Z0-9]+$/.test(w) && /[A-Z]/.test(w); }
function isAllLower(w) { return /^[a-z0-9]+$/.test(w); }

// Cases one hyphen/underscore-delimited word, preserving already-mixed-case tokens
// (e.g. "LakeFormation", "DynamoDB") untouched, upper-casing known acronyms regardless
// of how the source filename cased them, and Title-Casing everything else — so an
// ALL-CAPS-HYPHEN filename (AWSDEA's convention) and a lowercase-hyphen filename
// (PAA/GCPPCA's convention) render identically instead of one "shouting".
function caseWord(w, isFirst) {
  const lw = w.toLowerCase();
  if (SPECIAL_CASE[lw]) return SPECIAL_CASE[lw];
  if (ACRONYMS.has(lw)) return lw.toUpperCase();
  if (/^[0-9]+$/.test(w)) return w;
  if (CONNECTORS.has(lw) && !isFirst) return lw;
  if (!isAllUpper(w) && !isAllLower(w)) return w; // already a proper-cased name — leave alone
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function titleFromFilename(f) {
  const words = f.replace(/\.[^.]+$/, '').split(/[-_]/);
  return words.map((w, i) => caseWord(w, i === 0)).join(' ');
}

// Recursively walks a directory, returning { files: [...linkable files, README excluded...],
// hasReadme: bool, dirs: { name: <same shape> } } at each nesting level, sorted, so the
// sidebar renders nested folders as extra indentation levels with their own README as the link.
function walkDir(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = entries
    .filter(e => e.isFile() && e.name.endsWith('.md') && e.name !== 'README.md')
    .map(e => e.name)
    .sort();
  const hasReadme = entries.some(e => e.isFile() && e.name === 'README.md');
  const dirs = {};
  for (const e of entries.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    dirs[e.name] = walkDir(path.join(dirPath, e.name));
  }
  return { files, hasReadme, dirs };
}

function renderDir(node, urlPrefix, indent) {
  let s = '';
  for (const f of node.files) {
    s += `${indent}- [${titleFromFilename(f)}](${urlPrefix}/${f})\n`;
  }
  for (const [name, child] of Object.entries(node.dirs)) {
    const link = child.hasReadme ? `${urlPrefix}/${name}/README.md` : '#';
    s += `${indent}- [${titleFromFilename(name)}](${link})\n`;
    s += renderDir(child, `${urlPrefix}/${name}`, indent + '  ');
  }
  return s;
}

let out = '- [🏠 Home](/README.md)\n';

for (const exam of EXAMS) {
  const examPath = path.join(ROOT, exam.vendor, exam.folder);
  if (!fs.existsSync(examPath)) continue;
  out += `- **${exam.label}**\n`;
  out += `  - [Overview](/${exam.vendor}/${exam.folder}/README.md)\n`;

  // Exam-root extra files: anything besides the standard agent-context set
  // and the numbered subfolders (e.g. a cheat-sheet PDF sitting at the exam root).
  const rootEntries = fs.readdirSync(examPath, { withFileTypes: true })
    .filter(e => e.isFile() && !EXAM_ROOT_SKIP.has(e.name))
    .map(e => e.name)
    .sort();
  for (const f of rootEntries) {
    out += `  - [${titleFromFilename(f)}](/${exam.vendor}/${exam.folder}/${f})\n`;
  }

  for (const sub of NUMBERED) {
    const subPath = path.join(examPath, sub);
    if (!fs.existsSync(subPath)) continue;
    const node = walkDir(subPath);
    const hasReadme = fs.existsSync(path.join(subPath, 'README.md'));
    const readmeLink = hasReadme ? `/${exam.vendor}/${exam.folder}/${sub}/README.md` : null;
    if (node.files.length === 0 && Object.keys(node.dirs).length === 0 && !hasReadme) continue;
    out += `    - [${titleFromFilename(sub)}](${readmeLink || '#'})\n`;
    out += renderDir(node, `/${exam.vendor}/${exam.folder}/${sub}`, '      ');
  }
}

fs.writeFileSync(path.join(ROOT, '_sidebar.md'), out);
console.log('Written _sidebar.md —', out.split('\n').length, 'lines');
