/**
 * Validation Utilities
 * Input validation and sanitization for API requests
 */

import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

/**
 * Validation result type
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  field?: string;
}

/**
 * Validate node ID format
 */
export function validateNodeId(nodeId: string): ValidationResult {
  if (!nodeId) {
    return { valid: false, error: 'Node ID is required', field: 'node_id' };
  }
  if (typeof nodeId !== 'string') {
    return { valid: false, error: 'Node ID must be a string', field: 'node_id' };
  }
  // Node IDs should be alphanumeric with underscores/hyphens, 3-64 chars
  if (!/^[a-zA-Z0-9_-]{3,64}$/.test(nodeId)) {
    return { valid: false, error: 'Invalid node ID format', field: 'node_id' };
  }
  return { valid: true };
}

/**
 * Validate UUID format
 */
export function validateUUID(id: string, fieldName: string = 'id'): ValidationResult {
  if (!id) {
    return { valid: false, error: `${fieldName} is required`, field: fieldName };
  }
  if (!uuidValidate(id)) {
    return { valid: false, error: `Invalid ${fieldName} format`, field: fieldName };
  }
  return { valid: true };
}

/**
 * Validate asset type
 */
export function validateAssetType(type: string): ValidationResult {
  const validTypes = ['Gene', 'Capsule', 'EvolutionEvent'];
  if (!type) {
    return { valid: false, error: 'Asset type is required', field: 'type' };
  }
  if (!validTypes.includes(type)) {
    return { valid: false, error: `Asset type must be one of: ${validTypes.join(', ')}`, field: 'type' };
  }
  return { valid: true };
}

/**
 * Validate GDI score (0-100)
 */
export function validateGDIScore(score: number): ValidationResult {
  if (typeof score !== 'number' || isNaN(score)) {
    return { valid: false, error: 'GDI score must be a number', field: 'gdi_score' };
  }
  if (score < 0 || score > 100) {
    return { valid: false, error: 'GDI score must be between 0 and 100', field: 'gdi_score' };
  }
  return { valid: true };
}

/**
 * Validate credit amount
 */
export function validateCreditAmount(amount: number, min: number = 0, max: number = 1000000): ValidationResult {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return { valid: false, error: 'Credit amount must be a number', field: 'credits' };
  }
  if (amount < min) {
    return { valid: false, error: `Credit amount must be at least ${min}`, field: 'credits' };
  }
  if (amount > max) {
    return { valid: false, error: `Credit amount cannot exceed ${max}`, field: 'credits' };
  }
  return { valid: true };
}

/**
 * Validate model identifier
 */
export function validateModelId(model: string): ValidationResult {
  if (!model) {
    return { valid: false, error: 'Model is required', field: 'model' };
  }
  if (typeof model !== 'string') {
    return { valid: false, error: 'Model must be a string', field: 'model' };
  }
  if (model.length < 2 || model.length > 128) {
    return { valid: false, error: 'Model identifier must be 2-128 characters', field: 'model' };
  }
  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email) {
    return { valid: false, error: 'Email is required', field: 'email' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format', field: 'email' };
  }
  return { valid: true };
}

/**
 * Validate URL format
 */
export function validateUrl(url: string): ValidationResult {
  if (!url) {
    return { valid: false, error: 'URL is required', field: 'url' };
  }
  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format', field: 'url' };
  }
}

/**
 * Validate pagination parameters
 */
export function validatePagination(
  page?: number,
  limit?: number,
  maxLimit: number = 100
): ValidationResult {
  if (page !== undefined) {
    if (!Number.isInteger(page) || page < 1) {
      return { valid: false, error: 'Page must be a positive integer', field: 'page' };
    }
  }
  if (limit !== undefined) {
    if (!Number.isInteger(limit) || limit < 1) {
      return { valid: false, error: 'Limit must be a positive integer', field: 'limit' };
    }
    if (limit > maxLimit) {
      return { valid: false, error: `Limit cannot exceed ${maxLimit}`, field: 'limit' };
    }
  }
  return { valid: true };
}

/**
 * Sanitize string input (remove control characters)
 */
export function sanitizeString(input: string, maxLength: number = 1000): string {
  if (!input) return '';
  // Remove control characters except newline and tab
  const sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Trim and truncate
  return sanitized.trim().slice(0, maxLength);
}

/**
 * Validate status enum
 */
export function validateStatus(status: string, validStatuses: string[]): ValidationResult {
  if (!status) {
    return { valid: false, error: 'Status is required', field: 'status' };
  }
  if (!validStatuses.includes(status)) {
    return { valid: false, error: `Status must be one of: ${validStatuses.join(', ')}`, field: 'status' };
  }
  return { valid: true };
}

/**
 * Validate required fields in an object
 */
export function validateRequired<T extends Record<string, unknown>>(
  obj: T,
  requiredFields: (keyof T)[]
): ValidationResult {
  for (const field of requiredFields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      return { valid: false, error: `${String(field)} is required`, field: String(field) };
    }
  }
  return { valid: true };
}

/**
 * Check if a value is within acceptable range
 */
export function inRange(value: number, min: number, max: number): boolean {
  return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
}
