import crypto from 'crypto';

// --- Config ---
const JWT_SECRET = process.env.JWT_SECRET || 'my-evo-jwt-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
const SALT_ROUNDS = 12;

// --- Types ---
export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// --- Helpers ---
function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60; // default 7 days
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 24 * 60 * 60;
    default:  return 7 * 24 * 60 * 60;
  }
}

// --- HMAC Sign / Verify ---
function hmacSign(payload: string): string {
  return crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex');
}

// --- Password hashing ---
export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.pbkdf2(password, salt, SALT_ROUNDS, 64, 'sha512', (err, derivedKey) => {
      if (err) return reject(err);
      resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, storedHash] = hash.split(':');
    if (!salt || !storedHash) return resolve(false);
    crypto.pbkdf2(password, salt, SALT_ROUNDS, 64, 'sha512', (err, derivedKey) => {
      if (err) return reject(err);
      resolve(derivedKey.toString('hex') === storedHash);
    });
  });
}

// --- JWT Sign ---
export function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  const expiresIn = parseExpiry(JWT_EXPIRY);
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);

  const payloadWithExp: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payloadWithExp));

  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = hmacSign(signatureInput);
  const encodedSignature = base64url(signature);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

// --- JWT Verify ---
export function verifyToken(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  // Verify signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSig = hmacSign(signatureInput);
  const providedSig = Buffer.from(encodedSignature.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('hex');

  if (expectedSig !== providedSig) {
    throw new Error('Invalid token signature');
  }

  // Parse payload
  const payload: JwtPayload = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf8'));

  // Check expiry
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    const err: any = new Error('Token has expired');
    err.name = 'TokenExpiredError';
    throw err;
  }

  return payload;
}
