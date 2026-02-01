/**
 * Shared domain type used by api and domain-terminology.
 * Isolated here to break circular dependency: api <-> domain-terminology.
 */

export type Domain = 'business' | 'home' | 'personal' | 'world' | 'mixed';
