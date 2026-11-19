// Passwords: PBKDF2-SHA256, versioned format pbkdf2$<iter>$<salt>$<hash> (D-005).
// Tokens: 32 random bytes; only SHA-256 hex is stored.
export const PBKDF2_ITERATIONS = 100_000;
const MAX_ITER = 2_000_000;
const enc = new TextEncoder();

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(pw: string, salt: Uint8Array, iter: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(pw: string, iter = PBKDF2_ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${iter}$${b64(salt)}$${b64(await derive(pw, salt, iter))}`;
}

export async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [algo, iterS, saltS, hashS] = stored.split('$');
  const iter = Number(iterS);
  if (algo !== 'pbkdf2' || !Number.isInteger(iter) || iter < 1 || iter > MAX_ITER || !saltS || !hashS) return false;
  try {
    return timingSafeEqual(await derive(pw, unb64(saltS), iter), unb64(hashS));
  } catch {
    return false;
  }
}

export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export async function sha256Bytes(s: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

export async function sha256Hex(s: string): Promise<string> {
  return [...(await sha256Bytes(s))].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string compare (hashes first, so lengths don't leak). */
export async function safeStringEqual(a: string, b: string): Promise<boolean> {
  return timingSafeEqual(await sha256Bytes(a), await sha256Bytes(b));
}

export function randomToken(): string {
  return b64(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
