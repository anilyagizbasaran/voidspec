import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

// Logout edilen token'ların jti listesi. Diskte tutulur ki backend yeniden
// başladığında çıkış yapılmış bir token tekrar geçerli hale gelmesin.
const STORE_FILE = process.env.REVOKED_TOKEN_FILE || '/root/serverpanel/backend/logs/revoked-tokens.json';

const revoked = new Map(); // jti -> exp (unix saniye)

function sweep() {
  const now = Math.floor(Date.now() / 1000);
  let changed = false;
  for (const [jti, exp] of revoked) {
    if (exp <= now) {
      revoked.delete(jti);
      changed = true;
    }
  }
  return changed;
}

async function persist() {
  try {
    await mkdir(dirname(STORE_FILE), { recursive: true });
    await writeFile(STORE_FILE, JSON.stringify([...revoked]));
  } catch {
    // Diske yazılamazsa bellekteki liste yine de geçerli — logout'u bozma.
  }
}

export async function loadRevokedTokens() {
  try {
    const raw = await readFile(STORE_FILE, 'utf8');
    for (const [jti, exp] of JSON.parse(raw)) revoked.set(jti, exp);
    sweep();
  } catch {
    // Dosya yoksa boş listeyle başla.
  }
}

export async function revokeToken(jti, exp) {
  if (!jti) return;
  revoked.set(jti, exp || Math.floor(Date.now() / 1000) + 86400);
  sweep();
  await persist();
}

export function isRevoked(jti) {
  if (!jti) return false;
  const exp = revoked.get(jti);
  if (exp === undefined) return false;
  if (exp <= Math.floor(Date.now() / 1000)) {
    revoked.delete(jti);
    return false;
  }
  return true;
}

export function revokedCount() {
  return revoked.size;
}
