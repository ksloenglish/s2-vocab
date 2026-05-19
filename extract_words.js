const fs = require('fs');
const code = fs.readFileSync('data.js', 'utf8') + '\nmodule.exports = { UNITS, TERM_UNITS };';
const tmpFile = '/tmp/data_export.js';
fs.writeFileSync(tmpFile, code);
const { UNITS } = require(tmpFile);

const words = [];
for (const [unitKey, unit] of Object.entries(UNITS)) {
  for (const w of unit.words) {
    words.push({ unitKey, item: w.item, pos: w.pos });
  }
}
console.log(JSON.stringify(words, null, 2));
