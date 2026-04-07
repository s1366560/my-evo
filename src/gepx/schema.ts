/**
 * Schema validation for .gepx payloads.
 * Uses manual property checks instead of ajv to avoid version conflicts
 * between the project's ajv v6 and @fastify/ajv-compiler's ajv v8.
 */

import {
  ValidationResult,
  ValidationErrorDetail,
  BundleType,
  AssetType,
} from './types';

const BUNDLE_TYPES: BundleType[] = [
  'Gene',
  'Capsule',
  'EvolutionEvent',
  'Mutation',
  'Recipe',
  'Organism',
  'FullSnapshot',
];

const ASSET_TYPES: AssetType[] = [
  'Gene',
  'Capsule',
  'EvolutionEvent',
  'Mutation',
  'Recipe',
  'Organism',
];

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function pushError(
  errors: ValidationErrorDetail[],
  field: string,
  message: string,
  code: string,
): void {
  errors.push({ field, message, code });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

// ---------------------------------------------------------------------------
// validateSchema — full GepxPayload
// ---------------------------------------------------------------------------

export function validateSchema(payload: unknown): ValidationResult {
  const errors: ValidationErrorDetail[] = [];

  if (!isObject(payload)) {
    pushError(errors, 'payload', 'Payload must be an object', 'INVALID_TYPE');
    return { valid: false, errors };
  }

  const obj = payload as Record<string, unknown>;

  // version
  if (!isString(obj['version'])) {
    pushError(errors, 'version', 'version must be a string', 'INVALID_TYPE');
  }

  // exported_at
  if (!isString(obj['exported_at'])) {
    pushError(errors, 'exported_at', 'exported_at must be an ISO-8601 string', 'INVALID_TYPE');
  }

  // bundle_type
  if (!isString(obj['bundle_type'])) {
    pushError(errors, 'bundle_type', 'bundle_type must be a string', 'INVALID_TYPE');
  } else if (!BUNDLE_TYPES.includes(obj['bundle_type'] as BundleType)) {
    pushError(
      errors,
      'bundle_type',
      `bundle_type must be one of: ${BUNDLE_TYPES.join(', ')}`,
      'INVALID_ENUM',
    );
  }

  // metadata
  if (!isObject(obj['metadata'])) {
    pushError(errors, 'metadata', 'metadata must be an object', 'INVALID_TYPE');
  } else {
    const metaErrors = validateMetadataFields(obj['metadata'] as Record<string, unknown>);
    for (const e of metaErrors) {
      errors.push({ ...e, field: `metadata.${e.field}` });
    }
  }

  // assets
  if (!Array.isArray(obj['assets'])) {
    pushError(errors, 'assets', 'assets must be an array', 'INVALID_TYPE');
  } else {
    for (let i = 0; i < obj['assets'].length; i++) {
      const assetErrors = validateAssetFields(obj['assets'][i] as Record<string, unknown>, `assets[${i}]`);
      for (const e of assetErrors) {
        errors.push(e);
      }
    }
  }

  // lineage
  if (!Array.isArray(obj['lineage'])) {
    pushError(errors, 'lineage', 'lineage must be an array', 'INVALID_TYPE');
  } else {
    for (let i = 0; i < obj['lineage'].length; i++) {
      const linErrors = validateLineageFields(obj['lineage'][i] as Record<string, unknown>, `lineage[${i}]`);
      for (const e of linErrors) {
        errors.push(e);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// validateAssetObject — single Asset
// ---------------------------------------------------------------------------

export function validateAssetObject(asset: unknown): ValidationResult {
  const errors: ValidationErrorDetail[] = [];

  if (!isObject(asset)) {
    pushError(errors, 'asset', 'Asset must be an object', 'INVALID_TYPE');
    return { valid: false, errors };
  }

  const obj = asset as Record<string, unknown>;
  const fieldErrors = validateAssetFields(obj, 'asset');
  return { valid: fieldErrors.length === 0, errors: fieldErrors };
}

function validateAssetFields(
  obj: Record<string, unknown>,
  prefix: string,
): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];

  if (!isString(obj['asset_id'])) {
    pushError(errors, `${prefix}.asset_id`, 'asset_id must be a string', 'INVALID_TYPE');
  }
  if (!isString(obj['asset_type'])) {
    pushError(errors, `${prefix}.asset_type`, 'asset_type must be a string', 'INVALID_TYPE');
  } else if (!ASSET_TYPES.includes(obj['asset_type'] as AssetType)) {
    pushError(
      errors,
      `${prefix}.asset_type`,
      `asset_type must be one of: ${ASSET_TYPES.join(', ')}`,
      'INVALID_ENUM',
    );
  }
  if (!isString(obj['name'])) {
    pushError(errors, `${prefix}.name`, 'name must be a string', 'INVALID_TYPE');
  }
  if (!isString(obj['version'])) {
    pushError(errors, `${prefix}.version`, 'version must be a string', 'INVALID_TYPE');
  }
  if (!isString(obj['content'])) {
    pushError(errors, `${prefix}.content`, 'content must be a string', 'INVALID_TYPE');
  }
  if (!Array.isArray(obj['tags'])) {
    pushError(errors, `${prefix}.tags`, 'tags must be an array', 'INVALID_TYPE');
  } else if (!obj['tags'].every(isString)) {
    pushError(errors, `${prefix}.tags`, 'tags must be an array of strings', 'INVALID_ARRAY_TYPE');
  }

  return errors;
}

// ---------------------------------------------------------------------------
// validateGene — Gene-specific rules
// ---------------------------------------------------------------------------

export function validateGene(asset: unknown): ValidationResult {
  const errors: ValidationErrorDetail[] = [];

  if (!isObject(asset)) {
    pushError(errors, 'gene', 'Gene must be an object', 'INVALID_TYPE');
    return { valid: false, errors };
  }

  const obj = asset as Record<string, unknown>;

  if (obj['asset_type'] !== 'Gene') {
    pushError(
      errors,
      'asset_type',
      `Expected asset_type "Gene", got "${String(obj['asset_type'])}"`,
      'INVALID_ASSET_TYPE',
    );
  }

  if (!obj['content'] || typeof obj['content'] !== 'string') {
    pushError(errors, 'content', 'Gene content must be a non-empty string', 'MISSING_CONTENT');
  } else if (obj['content'].trim().length === 0) {
    pushError(errors, 'content', 'Gene content must not be blank', 'EMPTY_CONTENT');
  }

  if (!obj['name'] || typeof obj['name'] !== 'string') {
    pushError(errors, 'name', 'Gene must have a name', 'MISSING_NAME');
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// validateMetadataObject — GepxMetadata
// ---------------------------------------------------------------------------

export function validateMetadataObject(metadata: unknown): ValidationResult {
  if (!isObject(metadata)) {
    return {
      valid: false,
      errors: [{ field: 'metadata', message: 'Metadata must be an object', code: 'INVALID_TYPE' }],
    };
  }
  const errors = validateMetadataFields(metadata as Record<string, unknown>);
  return { valid: errors.length === 0, errors };
}

function validateMetadataFields(
  obj: Record<string, unknown>,
): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];

  if (!isString(obj['format_version'])) {
    pushError(errors, 'format_version', 'format_version must be a string', 'INVALID_TYPE');
  }
  if (!isString(obj['hub_version'])) {
    pushError(errors, 'hub_version', 'hub_version must be a string', 'INVALID_TYPE');
  }
  if (!isString(obj['bundle_name'])) {
    pushError(errors, 'bundle_name', 'bundle_name must be a string', 'INVALID_TYPE');
  }
  if (!isString(obj['description'])) {
    pushError(errors, 'description', 'description must be a string', 'INVALID_TYPE');
  }
  if (!Array.isArray(obj['tags'])) {
    pushError(errors, 'tags', 'tags must be an array', 'INVALID_TYPE');
  } else if (!obj['tags'].every(isString)) {
    pushError(errors, 'tags', 'tags must be an array of strings', 'INVALID_ARRAY_TYPE');
  }
  if (!isString(obj['exported_by'])) {
    pushError(errors, 'exported_by', 'exported_by must be a string', 'INVALID_TYPE');
  }
  if (!isNonNegativeInteger(obj['asset_count'])) {
    pushError(errors, 'asset_count', 'asset_count must be a non-negative integer', 'INVALID_TYPE');
  }
  if (!isString(obj['checksum'])) {
    pushError(errors, 'checksum', 'checksum must be a string', 'INVALID_TYPE');
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Lineage validation helper
// ---------------------------------------------------------------------------

function validateLineageFields(
  obj: Record<string, unknown>,
  prefix: string,
): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];

  if (!isString(obj['asset_id'])) {
    pushError(errors, `${prefix}.asset_id`, 'asset_id must be a string', 'INVALID_TYPE');
  }
  if (!Array.isArray(obj['parent_ids'])) {
    pushError(errors, `${prefix}.parent_ids`, 'parent_ids must be an array', 'INVALID_TYPE');
  } else if (!obj['parent_ids'].every(isString)) {
    pushError(errors, `${prefix}.parent_ids`, 'parent_ids must be an array of strings', 'INVALID_ARRAY_TYPE');
  }
  if (!isNonNegativeInteger(obj['generation'])) {
    pushError(errors, `${prefix}.generation`, 'generation must be a non-negative integer', 'INVALID_TYPE');
  }
  if (!isString(obj['created_at'])) {
    pushError(errors, `${prefix}.created_at`, 'created_at must be an ISO-8601 string', 'INVALID_TYPE');
  }

  return errors;
}
