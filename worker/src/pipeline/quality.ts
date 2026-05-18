import { RawJob, ParsedJob } from '../types/job';

export type QualityFactors = {
  hasDescription: number;
  hasSalary: number;
  hasRequirements: number;
  hasTechStack: number;
  hasLocation: number;
  descriptionLength: number;
  hasVisaInfo: number;
  hasBenefits: number;
};

/**
 * Calculates a quality score for a job posting.
 * Max points = 100.
 * Returns score as float 0.0-1.0.
 */
export function scoreJob(raw: RawJob, parsed: ParsedJob): { score: number; factors: QualityFactors } {
  const factors: QualityFactors = {
    hasDescription: 0,
    hasSalary: 0,
    hasRequirements: 0,
    hasTechStack: 0,
    hasLocation: 0,
    descriptionLength: 0,
    hasVisaInfo: 0,
    hasBenefits: 0,
  };

  // 1. hasDescription (0-25 points)
  const desc = raw.description || '';
  const descLen = desc.trim().length;
  if (descLen > 2000) {
    factors.hasDescription = 25;
  } else if (descLen >= 1000) {
    factors.hasDescription = 18;
  } else if (descLen >= 500) {
    factors.hasDescription = 10;
  } else if (descLen > 0) {
    factors.hasDescription = 3;
  } else {
    factors.hasDescription = 0;
  }

  // 2. hasSalary (0-20 points)
  const hasMin = parsed.salary_min !== undefined && parsed.salary_min !== null;
  const hasMax = parsed.salary_max !== undefined && parsed.salary_max !== null;
  if (hasMin && hasMax) {
    factors.hasSalary = 20;
  } else if (hasMin || hasMax) {
    factors.hasSalary = 10;
  } else {
    factors.hasSalary = 0;
  }

  // 3. hasRequirements (0-15 points)
  const reqs = parsed.requirements || [];
  if (reqs.length >= 3) {
    factors.hasRequirements = 15;
  } else if (reqs.length >= 1) {
    factors.hasRequirements = 8;
  } else {
    factors.hasRequirements = 0;
  }

  // 4. hasTechStack (0-15 points)
  const stack = parsed.tech_stack || [];
  if (stack.length >= 3) {
    factors.hasTechStack = 15;
  } else if (stack.length >= 1) {
    factors.hasTechStack = 8;
  } else {
    factors.hasTechStack = 0;
  }

  // 5. hasLocation (0-10 points)
  // Specific city/remote: 10. Just 'United States': 4. Missing: 0.
  const loc = (raw.locationName || '').trim();
  if (parsed.is_remote === true || (loc && loc.toLowerCase() !== 'united states')) {
    factors.hasLocation = 10;
  } else if (loc.toLowerCase() === 'united states') {
    factors.hasLocation = 4;
  } else {
    factors.hasLocation = 0;
  }

  // 6. descriptionLength bonus (0-5 points)
  if (descLen > 3000) {
    factors.descriptionLength = 5;
  } else {
    factors.descriptionLength = 0;
  }

  // 7. hasVisaInfo (0-5 points)
  // visa_sponsorship field is defined (not undefined): 5
  if (parsed.visa_sponsorship !== undefined && parsed.visa_sponsorship !== null) {
    factors.hasVisaInfo = 5;
  } else {
    factors.hasVisaInfo = 0;
  }

  // 8. hasBenefits (0-5 points)
  const benefits = parsed.benefits || [];
  if (benefits.length >= 1) {
    factors.hasBenefits = 5;
  } else {
    factors.hasBenefits = 0;
  }

  const totalPoints =
    factors.hasDescription +
    factors.hasSalary +
    factors.hasRequirements +
    factors.hasTechStack +
    factors.hasLocation +
    factors.descriptionLength +
    factors.hasVisaInfo +
    factors.hasBenefits;

  const score = Math.round((totalPoints / 100) * 100) / 100;

  return {
    score: Math.min(Math.max(score, 0.0), 1.0), // Clamp just in case
    factors,
  };
}

/**
 * Safe wrapper for scoreJob.
 * Returns 0.0 on any error.
 */
export function scoreJobSafe(raw: RawJob, parsed: ParsedJob): { score: number; factors: QualityFactors } {
  try {
    return scoreJob(raw, parsed);
  } catch (error) {
    return {
      score: 0.0,
      factors: {
        hasDescription: 0,
        hasSalary: 0,
        hasRequirements: 0,
        hasTechStack: 0,
        hasLocation: 0,
        descriptionLength: 0,
        hasVisaInfo: 0,
        hasBenefits: 0,
      },
    };
  }
}
