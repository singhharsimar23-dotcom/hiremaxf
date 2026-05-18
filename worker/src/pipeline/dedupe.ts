import { RawJob } from "../types/job";
import { NormalizedRaw } from "./normalize";

/**
 * Converts an ArrayBuffer to a hex string.
 */
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Computes the unique fingerprint for a job.
 * Used for basic deduplication and change detection.
 */
export async function computeFingerprint(
  normalizedCompany: string,
  normalizedTitle: string,
  normalizedLocation: string,
  externalId: string
): Promise<string> {
  const payload = `${normalizedCompany}|${normalizedTitle}|${normalizedLocation}|${externalId}`;
  const msgUint8 = new TextEncoder().encode(payload);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", msgUint8);
  return bufToHex(hashBuffer);
}

/**
 * Computes the canonical hash for a job.
 * Used for detecting reposts or same-role duplicates across companies/sources.
 */
export async function computeCanonicalHash(
  normalizedCompany: string,
  normalizedTitle: string,
  roleCategory: string,
  seniorityBand: string
): Promise<string> {
  const payload = `${normalizedCompany}|${normalizedTitle}|${roleCategory}|${seniorityBand}`;
  const msgUint8 = new TextEncoder().encode(payload);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", msgUint8);
  return bufToHex(hashBuffer);
}

/**
 * Builds both fingerprint and canonical hash for a normalized job.
 * Note: canonical_hash uses 'unknown' for role/seniority on first pass.
 */
export async function buildHashes(
  normalized: NormalizedRaw,
  raw: RawJob
): Promise<{ fingerprint: string; canonical_hash: string } | null> {
  try {
    const fingerprint = await computeFingerprint(
      normalized.company_name,
      normalized.title,
      normalized.location_name,
      raw.externalId
    );

    const canonical_hash = await computeCanonicalHash(
      normalized.company_name,
      normalized.title,
      "unknown",
      "unknown"
    );

    return { fingerprint, canonical_hash };
  } catch (err) {
    // Pipeline error contract: return null on error, never throw
    return null;
  }
}
