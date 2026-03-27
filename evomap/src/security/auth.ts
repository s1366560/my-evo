/**
 * EvoMap GEP Protocol - Security Module
 * Authentication, Authorization, Command Whitelist, Abuse Protection
 */

import crypto from 'crypto';
import { TIMING, VALIDATION_COMMAND_WHITELIST } from '../core/constants.js';

// ============ Authentication ============

export interface AuthToken {
  token: string;
  node_id: string;
  created_at: string;
  expires_at: string;
  is_revoked: boolean;
}

/**
 * Authentication Service
 */
export class AuthService {
  private tokens: Map<string, AuthToken> = new Map();
  private revokedTokens: Set<string> = new Set();

  /**
   * Generate a secure authentication token
   */
  generateToken(nodeId: string, ttlMs: number = TIMING.NODE_SECRET_TTL): AuthToken {
    const token = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expires = new Date(now.getTime() + ttlMs);

    const authToken: AuthToken = {
      token,
      node_id: nodeId,
      created_at: now.toISOString(),
      expires_at: expires.toISOString(),
      is_revoked: false,
    };

    this.tokens.set(token, authToken);
    return authToken;
  }

  /**
   * Validate a token
   */
  validateToken(token: string): { valid: boolean; node_id?: string; error?: string } {
    const authToken = this.tokens.get(token);
    
    if (!authToken) {
      return { valid: false, error: 'Token not found' };
    }

    if (authToken.is_revoked || this.revokedTokens.has(token)) {
      return { valid: false, error: 'Token has been revoked' };
    }

    if (new Date(authToken.expires_at) < new Date()) {
      return { valid: false, error: 'Token has expired' };
    }

    return { valid: true, node_id: authToken.node_id };
  }

  /**
   * Revoke a token
   */
  revokeToken(token: string): boolean {
    const authToken = this.tokens.get(token);
    if (!authToken) return false;
    
    authToken.is_revoked = true;
    this.revokedTokens.add(token);
    return true;
  }

  /**
   * Extract Bearer token from Authorization header
   */
  extractBearerToken(authHeader: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.slice(7);
  }
}

// ============ Command Whitelist ============

const SHELL_OPERATORS = ['|', '&', '&&', '||', '>', '<', ';', '$', '`', '(', ')', '{', '}', '\n', '\r'];

export interface CommandValidation {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * Validate and sanitize commands against whitelist
 */
export class CommandWhitelistService {
  private whitelist: Set<string>;

  constructor(whitelist: readonly string[] = VALIDATION_COMMAND_WHITELIST) {
    this.whitelist = new Set(whitelist.map(cmd => cmd.toLowerCase()));
  }

  /**
   * Check if command is allowed
   */
  isAllowed(command: string): boolean {
    const parts = this.parseCommand(command);
    if (parts.length === 0) return false;
    
    // First part must be in whitelist
    const baseCommand = parts[0].toLowerCase();
    return this.whitelist.has(baseCommand);
  }

  /**
   * Validate command has no shell operators
   */
  validateCommand(command: string): CommandValidation {
    // Check for shell operators
    for (const op of SHELL_OPERATORS) {
      if (command.includes(op)) {
        return {
          valid: false,
          error: `Shell operator '${op}' is not allowed`,
        };
      }
    }

    // Check if base command is whitelisted
    const parts = this.parseCommand(command);
    if (parts.length === 0) {
      return { valid: false, error: 'Empty command' };
    }

    const baseCommand = parts[0].toLowerCase();
    if (!this.whitelist.has(baseCommand)) {
      return {
        valid: false,
        error: `Command '${baseCommand}' is not in whitelist`,
      };
    }

    return { valid: true, sanitized: command.trim() };
  }

  /**
   * Parse command into parts (simple splitting)
   */
  private parseCommand(command: string): string[] {
    return command.trim().split(/\s+/).filter(part => part.length > 0);
  }
}

// ============ Abuse Protection ============

export interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

export interface BruteForceEntry {
  attempts: number;
  firstAttempt: number;
  lockedUntil?: string;
}

/**
 * Abuse Protection Service - Rate limiting, brute force protection
 */
export class AbuseProtectionService {
  private rateLimits: Map<string, RateLimitEntry> = new Map();
  private bruteForce: Map<string, BruteForceEntry> = new Map();
  
  private readonly RATE_WINDOW_MS = 60 * 1000; // 1 minute
  private readonly RATE_MAX_REQUESTS = 60; // per minute
  private readonly BRUTE_FORCE_MAX = 5; // attempts before lockout
  private readonly BRUTE_FORCE_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

  /**
   * Check if request is within rate limits
   */
  checkRateLimit(key: string, limit: number = this.RATE_MAX_REQUESTS): { allowed: boolean; remaining: number; resetIn?: number } {
    const now = Date.now();
    const entry = this.rateLimits.get(key);

    if (!entry || now - entry.firstAttempt > this.RATE_WINDOW_MS) {
      // New window
      this.rateLimits.set(key, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return { allowed: true, remaining: limit - 1 };
    }

    // Within window
    entry.count++;
    entry.lastAttempt = now;

    if (entry.count > limit) {
      const resetIn = this.RATE_WINDOW_MS - (now - entry.firstAttempt);
      return { allowed: false, remaining: 0, resetIn };
    }

    return { allowed: true, remaining: limit - entry.count };
  }

  /**
   * Record failed login attempt
   */
  recordFailedAttempt(identifier: string): { locked: boolean; attemptsRemaining: number } {
    let entry = this.bruteForce.get(identifier);
    const now = Date.now();

    if (!entry) {
      entry = { attempts: 0, firstAttempt: now };
    }

    // Check if currently locked
    if (entry.lockedUntil && new Date(entry.lockedUntil) > new Date()) {
      return { locked: true, attemptsRemaining: 0 };
    }

    entry.attempts++;

    if (entry.attempts >= this.BRUTE_FORCE_MAX) {
      const lockUntil = new Date(now + this.BRUTE_FORCE_LOCKOUT_MS);
      entry.lockedUntil = lockUntil.toISOString();
      return { locked: true, attemptsRemaining: 0 };
    }

    return { locked: false, attemptsRemaining: this.BRUTE_FORCE_MAX - entry.attempts };
  }

  /**
   * Clear brute force record (after successful auth)
   */
  clearFailedAttempts(identifier: string): void {
    this.bruteForce.delete(identifier);
  }

  /**
   * Check if identifier is locked
   */
  isLocked(identifier: string): boolean {
    const entry = this.bruteForce.get(identifier);
    if (!entry || !entry.lockedUntil) return false;
    return new Date(entry.lockedUntil) > new Date();
  }

  /**
   * Get lockout status
   */
  getLockoutStatus(identifier: string): { locked: boolean; lockedUntil?: string; attempts?: number } {
    const entry = this.bruteForce.get(identifier);
    if (!entry) return { locked: false };
    
    if (entry.lockedUntil && new Date(entry.lockedUntil) > new Date()) {
      return {
        locked: true,
        lockedUntil: entry.lockedUntil,
        attempts: entry.attempts,
      };
    }
    
    return { locked: false, attempts: entry.attempts };
  }
}

// ============ Content Verification ============

/**
 * Content hash verification service
 */
export class ContentVerificationService {
  /**
   * Compute SHA-256 hash of content
   */
  computeHash(content: string): string {
    return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  }

  /**
   * Verify content matches expected hash
   */
  verifyHash(content: string, expectedHash: string): boolean {
    const actualHash = this.computeHash(content);
    return crypto.timingSafeEqual(
      Buffer.from(actualHash),
      Buffer.from(expectedHash)
    );
  }

  /**
   * Generate challenge for node authentication
   */
  generateChallenge(): { challenge: string; expiresAt: string } {
    const challenge = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + TIMING.CHALLENGE_EXPIRY).toISOString();
    return { challenge, expiresAt };
  }

  /**
   * Verify challenge response
   */
  verifyChallengeResponse(
    challenge: string,
    response: string,
    expectedResponse: string
  ): boolean {
    // Challenge should be included in response signing
    const dataToVerify = `${challenge}:${expectedResponse}`;
    const computed = this.computeHash(dataToVerify);
    
    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(response)
    );
  }
}
