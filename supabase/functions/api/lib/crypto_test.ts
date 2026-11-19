import { assert, assertEquals, test } from './_testkit.ts';
import { hashPassword, randomToken, safeStringEqual, sha256Hex, verifyPassword } from './crypto.ts';

test('password hash round-trip and versioned format', async () => {
  const h = await hashPassword('1234', 1000);
  assert(h.startsWith('pbkdf2$1000$'));
  assert(await verifyPassword('1234', h));
  assert(!(await verifyPassword('12345', h)));
  assert(!(await verifyPassword('1234', null)));
  assert(!(await verifyPassword('1234', 'garbage')));
});
test('same password → different hashes (random salt)', async () => {
  assert((await hashPassword('x', 1000)) !== (await hashPassword('x', 1000)));
});
test('tokens are random and url-safe', () => {
  const a = randomToken();
  assert(/^[A-Za-z0-9_-]{43}$/.test(a), a);
  assert(a !== randomToken());
});
test('sha256 hex', async () => {
  assertEquals(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('safe string equal', async () => {
  assert(await safeStringEqual('secret', 'secret'));
  assert(!(await safeStringEqual('secret', 'secreT')));
});
