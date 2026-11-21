import { assertEquals, test } from './_testkit.ts';
import { normalizeBookName, normalizeUsername } from './normalize.ts';

test('normalize: Arabic alef variants and spaces', () => assertEquals(normalizeUsername(' أحمد '), normalizeUsername('احمد')));
test('normalize: case-insensitive', () => assertEquals(normalizeUsername('Mina'), normalizeUsername('mina')));
test('normalize: ى/ي and ة/ه and inner spaces', () => assertEquals(normalizeUsername('مارى  نعمة'), 'ماري نعمه'));
test('normalizeBookName: strips prefixes and normalizes chars', () => {
  assertEquals(normalizeBookName('سفر التكوين'), 'التكوين');
  assertEquals(normalizeBookName('إنجيل متى'), 'متي');
  assertEquals(normalizeBookName('رسالة رومية'), 'روميه');
  assertEquals(normalizeBookName('صموئيل الثاني'), 'صموئيل الثاني');
});
