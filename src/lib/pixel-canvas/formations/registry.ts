// FormationRegistry — loads precomputed formation data and provides lookup
//
// Usage:
//   import { registry } from './formations/registry';
//   const monstera = registry.get('monstera_deliciosa');
//   const result = registry.search('monstera');
//   const plants = registry.list('plant');

import type { FormationData, FormationEntry } from '../types';
import formationsData from './precomputed/formations.json';

/**
 * Decode a base64 bitfield into an array of {x, y} grid positions.
 */
function decodeFormation(data: FormationData): { x: number; y: number }[] {
  const bytes = Uint8Array.from(atob(data.bits), (c) => c.charCodeAt(0));
  const positions: { x: number; y: number }[] = [];

  for (let r = 0; r < data.rows; r++) {
    for (let c = 0; c < data.cols; c++) {
      const flatIndex = r * data.cols + c;
      const isActive =
        (bytes[Math.floor(flatIndex / 8)] >> (flatIndex % 8)) & 1;
      if (isActive) {
        positions.push({ x: c, y: r });
      }
    }
  }

  return positions;
}

class FormationRegistry {
  private entries = new Map<string, FormationEntry>();

  constructor() {
    for (const data of formationsData as FormationData[]) {
      this.entries.set(data.id, {
        id: data.id,
        category: data.category,
        displayName: data.displayName,
        pixelCount: data.pixelCount,
        positions: decodeFormation(data),
      });
    }
  }

  /** Exact ID lookup. */
  get(id: string): FormationEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Fuzzy lookup — the LLM might say "monstera" not "monstera_deliciosa".
   * Tries exact match, then partial ID match, then display name match.
   */
  search(query: string): FormationEntry | undefined {
    const lower = query.toLowerCase().replace(/\s+/g, '_');

    // Exact match
    if (this.entries.has(lower)) return this.entries.get(lower);

    // Partial match on ID
    for (const [id, entry] of this.entries) {
      if (id.includes(lower) || lower.includes(id)) return entry;
    }

    // Display name match
    for (const [, entry] of this.entries) {
      if (entry.displayName.toLowerCase().includes(query.toLowerCase())) {
        return entry;
      }
    }

    return undefined;
  }

  /** List all formations, optionally filtered by category. */
  list(category?: 'plant' | 'tool' | 'icon'): FormationEntry[] {
    const all = [...this.entries.values()];
    return category ? all.filter((e) => e.category === category) : all;
  }

  /** Number of loaded formations. */
  get size(): number {
    return this.entries.size;
  }
}

export const registry = new FormationRegistry();
