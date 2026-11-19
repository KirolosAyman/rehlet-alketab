import { assertEquals, test } from './_testkit.ts';
import { normalizeUsername } from './normalize.ts';

test('normalize: Arabic alef variants and spaces', () => assertEquals(normalizeUsername(' أحمد '), normalizeUsername('احمد')));
test('normalize: case-insensitive', () => assertEquals(normalizeUsername('Mina'), normalizeUsername('mina')));
test('normalize: ى/ي and ة/ه and inner spaces', () => assertEquals(normalizeUsername('مارى  نعمة'), 'ماري نعمه'));
