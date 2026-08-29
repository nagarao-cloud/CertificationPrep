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

function titleFromFilename(f) {
  return f.replace(/\.md$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

let out = '- [🏠 Home](/README.md)\n';

for (const exam of EXAMS) {
  const examPath = path.join(ROOT, exam.vendor, exam.folder);
  if (!fs.existsSync(examPath)) continue;
  out += `- **${exam.label}**\n`;
  out += `  - [Overview](/${exam.vendor}/${exam.folder}/README.md)\n`;
  for (const sub of NUMBERED) {
    const subPath = path.join(examPath, sub);
    if (!fs.existsSync(subPath)) continue;
    const files = fs.readdirSync(subPath)
      .filter(f => f.endsWith('.md') && f !== 'README.md')
      .sort();
    const hasReadme = fs.existsSync(path.join(subPath, 'README.md'));
    const readmeLink = hasReadme ? `/${exam.vendor}/${exam.folder}/${sub}/README.md` : null;
    if (files.length === 0 && !hasReadme) continue;
    out += `    - [${sub}](${readmeLink || '#'})\n`;
    for (const f of files) {
      out += `      - [${titleFromFilename(f)}](/${exam.vendor}/${exam.folder}/${sub}/${f})\n`;
    }
  }
}

fs.writeFileSync(path.join(ROOT, '_sidebar.md'), out);
console.log('Written _sidebar.md —', out.split('\n').length, 'lines');
