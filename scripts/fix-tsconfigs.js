/*
 * Fix tsconfig.json files that use single quotes or trailing semicolons
 * - Replaces single quotes surrounding keys and string values with double quotes
 * - Removes a trailing semicolon if present
 * - Writes the updated content back
 * This is conservative for the repo tsconfig files which are simple JSON-like files.
 */
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const glob = require('glob');

const patterns = ['packages/**/tsconfig.json'];
let files = [];
patterns.forEach(p => (files = files.concat(glob.sync(p, { nodir: true }))));
if (!files.length) {
  console.log('No tsconfig.json files found under packages/');
  process.exit(0);
}

files.forEach(file => {
  const abs = path.join(root, file);
  let s = fs.readFileSync(abs, 'utf8');

  // Remove trailing semicolon at end of file if present
  s = s.replace(/;\s*$/m, '');

  // Replace single-quoted JSON-ish keys/strings with double quotes
  // This is a pragmatic replacement targeted at the repo format: keys and string values are single-quoted
  // Avoid changing single quotes inside comments or complex embedded code—these tsconfigs are simple.
  s = s.replace(/'(.*?)'/g, (m, p1) => {
    // If string contains a double quote, escape it
    const escaped = p1.replace(/"/g, '\\"');
    return '"' + escaped + '"';
  });

  // Write back
  fs.writeFileSync(abs, s, 'utf8');
  console.log('Fixed', file);
});

console.log('Done');
