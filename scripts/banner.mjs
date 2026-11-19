// Terminal logo. Usage: node scripts/banner.mjs [subtitle]
// Respects NO_COLOR (https://no-color.org).
const color = !process.env.NO_COLOR && process.stdout.isTTY !== false;
const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);

// figlet "small"-style glyphs, 4 rows each
const G = {
  R: [' ___ ', '| _ \\', '|   /', '|_|_\\'],
  E: [' ___ ', '| __|', '| _| ', '|___|'],
  H: [' _  _ ', '| || |', '| __ |', '|_||_|'],
  L: [' _    ', '| |   ', '| |__ ', '|____|'],
  T: [' _____ ', '|_   _|', '  | |  ', '  |_|  '],
  A: ['   _   ', '  /_\\  ', ' / _ \\ ', '/_/ \\_\\'],
  K: [' _  __', '| |/ /', "| ' < ", '|_|\\_\\'],
  B: [' ___ ', '| _ )', '| _ \\', '|___/'],
  ' ': ['   ', '   ', '   ', '   '],
};
const word = (s) => [0, 1, 2, 3].map((r) => [...s].map((ch) => G[ch][r]).join(''));

const book = [
  '                          ★',
  '                   .-~~~~-. .-~~~~-.',
  '                  / ≡≡≡≡≡≡ Y ≡≡≡≡≡≡ \\',
  '                 /  ≡≡≡≡≡≡ | ≡≡≡≡≡≡  \\',
  '                /___≡≡≡≡≡≡_|_≡≡≡≡≡≡___\\',
];
const title = word('REHLET ALKETAB');
const shades = ['38;5;220', '38;5;214', '38;5;178', '38;5;172', '38;5;130'];

console.log('');
book.forEach((line, i) => console.log('  ' + (i === 0 ? c('1;38;5;220', line) : c(shades[i], line))));
title.forEach((line, i) => console.log('  ' + c('1;' + shades[i + 1], line)));
const sub = process.argv.slice(2).join(' ');
console.log('');
console.log('  ' + c('1;38;5;220', 'The Book Journey') + c('2', '  ·  one chapter a day, one step a day'));
console.log('');
