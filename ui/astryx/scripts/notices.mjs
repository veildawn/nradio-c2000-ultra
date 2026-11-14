import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const project = JSON.parse(readFileSync('package.json', 'utf8'));
const pending = Object.keys(project.dependencies), seen = new Set();
let text = 'NRadio Astryx UI — third-party notices\n\n';
while (pending.length) {
  const name = pending.shift();
  if (seen.has(name)) continue;
  seen.add(name);
  const dir = resolve('node_modules', name);
  const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8'));
  text += `\n${name} ${pkg.version}\n${'='.repeat(64)}\n`;
  const licenses = readdirSync(dir).filter(file => /^(license|copying|notice)(\.|$)/i.test(file));
  if (!licenses.length) {
    if (name.startsWith('@astryxdesign/') && pkg.license === 'MIT') text += readFileSync('reference/Astryx-MIT.txt', 'utf8');
    else if (name.startsWith('@stylexjs/') && pkg.license === 'MIT') text += readFileSync('reference/StyleX-MIT.txt', 'utf8');
    else throw new Error(`License file missing for ${name}`);
  }
  for (const file of licenses) text += readFileSync(resolve(dir, file), 'utf8') + '\n';
  pending.push(...Object.keys(pkg.dependencies || {}));
}
text += '\nLuCI Bootstrap compatibility stylesheet and theme template adaptation\n';
text += 'Copyright 2012 Nut & Bolt / David Menting; Copyright 2011 Twitter, Inc.\n';
text += 'Theme templates: Copyright 2008 Steven Barth; Copyright 2008–2022 Jo-Philipp Wich.\n';
text += 'Modified for NRadio Astryx UI: navigation, layouts, visual styles and responsive behavior.\n';
text += readFileSync('reference/Apache-2.0.txt', 'utf8');
writeFileSync('../../board/files/www/luci-static/astryx/THIRD-PARTY-NOTICES.txt', text);
