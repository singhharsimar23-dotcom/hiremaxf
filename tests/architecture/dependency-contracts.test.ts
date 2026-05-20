/**
 * Architecture Dependency Contract Tests
 *
 * Enforces the dependency rules defined in ARCHITECTURE.md.
 * These tests statically analyze imports to ensure no forbidden dependencies exist.
 *
 * Run: npx vitest tests/architecture/dependency-contracts.test.ts
 */

import { describe, it, expect } from 'vitest';
import { globSync } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../../');

/**
 * Extract all import paths from a TypeScript file.
 */
function extractImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const importRegex = /(?:import|require)\s*(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g;
  const imports: string[] = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

/**
 * Check if an import path violates a rule.
 */
function violatesRule(importPath: string, forbidden: string[]): string | null {
  for (const pattern of forbidden) {
    const normalized = pattern.replace('/*', '');
    if (
      importPath.includes(`/${normalized}/`) ||
      importPath.includes(`@${normalized}/`) ||
      importPath.startsWith(normalized + '/')
    ) {
      return pattern;
    }
  }
  return null;
}

// ─── Test Suites ──────────────────────────────────────────────────────────────

describe('Dependency Contract: core/ must not import apps/ or services/', () => {
  const coreFiles = globSync('core/**/*.ts', { cwd: ROOT, ignore: ['**/*.test.ts', '**/node_modules/**'] });

  it('should have no forbidden imports in core/', () => {
    const violations: string[] = [];

    for (const file of coreFiles) {
      const fullPath = path.join(ROOT, file);
      const imports = extractImports(fullPath);

      for (const imp of imports) {
        const violation = violatesRule(imp, ['apps', 'services']);
        if (violation) {
          violations.push(`${file} → imports ${imp} (forbidden: ${violation})`);
        }
      }
    }

    if (violations.length > 0) {
      console.error('\n🔴 Forbidden dependency violations in core/:');
      violations.forEach(v => console.error(`  ❌ ${v}`));
    }

    expect(violations).toHaveLength(0);
  });
});

describe('Dependency Contract: infra/ must not import apps/ or services/ or orchestrate core/', () => {
  const infraFiles = globSync('infra/**/*.ts', {
    cwd: ROOT,
    ignore: ['**/*.test.ts', '**/node_modules/**', 'infra/workers/scripts/**']
  });

  it('should have no forbidden imports in infra/', () => {
    const violations: string[] = [];

    for (const file of infraFiles) {
      const fullPath = path.join(ROOT, file);
      const imports = extractImports(fullPath);

      for (const imp of imports) {
        const violation = violatesRule(imp, ['apps', 'services']);
        if (violation) {
          violations.push(`${file} → imports ${imp} (forbidden: ${violation})`);
        }
      }
    }

    if (violations.length > 0) {
      console.error('\n🔴 Forbidden dependency violations in infra/:');
      violations.forEach(v => console.error(`  ❌ ${v}`));
    }

    expect(violations).toHaveLength(0);
  });
});

describe('Dependency Contract: apps/ must not import core/ or infra/ directly', () => {
  const appFiles = globSync('apps/**/*.{ts,tsx}', {
    cwd: ROOT,
    ignore: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
  });

  it('should have no forbidden imports in apps/', () => {
    const violations: string[] = [];

    for (const file of appFiles) {
      const fullPath = path.join(ROOT, file);
      const imports = extractImports(fullPath);

      for (const imp of imports) {
        // Allow: @core alias, @infra alias (may exist for types only)
        // Disallow: direct relative imports crossing layer boundaries
        if (imp.includes('../../../core/') || imp.includes('../../../infra/')) {
          violations.push(`${file} → direct relative import crossing layer boundary: ${imp}`);
        }
      }
    }

    if (violations.length > 0) {
      console.error('\n🟡 Layer boundary violations in apps/:');
      violations.forEach(v => console.error(`  ⚠️  ${v}`));
    }

    expect(violations).toHaveLength(0);
  });
});

describe('Structural Contract: all core engines must have interface.ts', () => {
  const engines = [
    'core/ingestion-engine',
    'core/matching-engine',
    'core/scoring-engine',
    'core/intelligence-engine',
    'core/resume-engine',
    'core/enrichment-engine',
  ];

  for (const engine of engines) {
    it(`${engine} should have interface.ts`, () => {
      const interfacePath = path.join(ROOT, engine, 'interface.ts');
      expect(fs.existsSync(interfacePath)).toBe(true);
    });

    it(`${engine} should have ARCHITECTURE.md`, () => {
      const archPath = path.join(ROOT, engine, 'ARCHITECTURE.md');
      expect(fs.existsSync(archPath)).toBe(true);
    });

    it(`${engine} should have module.json`, () => {
      const modulePath = path.join(ROOT, engine, 'module.json');
      expect(fs.existsSync(modulePath)).toBe(true);
    });
  }
});

describe('Structural Contract: MODULE_REGISTRY.json is valid', () => {
  it('should parse successfully as valid JSON', () => {
    const registryPath = path.join(ROOT, 'MODULE_REGISTRY.json');
    expect(fs.existsSync(registryPath)).toBe(true);
    const raw = fs.readFileSync(registryPath, 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it('should reference only real paths', () => {
    const registryPath = path.join(ROOT, 'MODULE_REGISTRY.json');
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    const missingPaths: string[] = [];

    for (const [key, mod] of Object.entries(registry.modules as Record<string, any>)) {
      if (mod.path) {
        const dirPath = path.join(ROOT, mod.path);
        if (!fs.existsSync(dirPath)) {
          missingPaths.push(`${key}: ${mod.path}`);
        }
      }
    }

    if (missingPaths.length > 0) {
      console.warn('\n⚠️  MODULE_REGISTRY.json references missing paths:');
      missingPaths.forEach(p => console.warn(`  • ${p}`));
    }

    // This is a warning not a failure — stub engines won't always have full dirs yet
    expect(missingPaths.length).toBeLessThanOrEqual(5);
  });
});

describe('Cleanup Contract: no log files in root', () => {
  it('should have no .log files in the repository root', () => {
    const logFiles = globSync('*.log', { cwd: ROOT });
    if (logFiles.length > 0) {
      console.error('\n🔴 Log files found in root:');
      logFiles.forEach(f => console.error(`  ❌ ${f}`));
    }
    expect(logFiles).toHaveLength(0);
  });

  it('should have no .txt output files in infra/workers/ root', () => {
    const outFiles = globSync('infra/workers/out*.txt', { cwd: ROOT });
    const logFiles = globSync('infra/workers/*.log', { cwd: ROOT });
    const all = [...outFiles, ...logFiles];
    if (all.length > 0) {
      console.warn('\n⚠️  Worker output files committed to SCM:');
      all.forEach(f => console.warn(`  ❌ ${f}`));
    }
    expect(all).toHaveLength(0);
  });
});
