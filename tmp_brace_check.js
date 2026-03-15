const fs = require('fs');
const path = 'D:/Ausdav/Pentathlon/src/pages/public/PasswordPage.tsx';
const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
let stack = 0;
let max = [0, 0];
for (let i = 0; i < lines.length; i++) {
  for (const ch of lines[i]) {
    if (ch === '{') stack++;
    if (ch === '}') stack--;
  }
  if (stack > max[0]) max = [stack, i + 1];
}
console.log('max stack', max, 'end stack', stack);
