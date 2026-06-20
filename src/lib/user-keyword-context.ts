/**
 * User Keyword Context Library
 *
 * Identifies keywords and phrases the user actually typed, separates them from
 * library-suggested terminology, and builds contextual summary sentences for
 * downstream AI analysis and description generation.
 */

import type { Domain } from './domain-types';
import { DESCRIPTION_GENERATION_CONFIG, USER_KEYWORD_CONTEXT } from './ai-config';

export interface UserKeywordAnalysis {
  /** Keywords found directly in user text */
  keywords: string[];
  /** Multi-word phrases found directly in user text */
  phrases: string[];
}

export interface UserKeywordContextInput {
  taskText: string;
  allKeywords?: string[];
  allPhrases?: string[];
  verbs?: string[];
  nouns?: string[];
  libraryKeywords?: string[];
  libraryPhrases?: string[];
  domain?: Domain;
  externalSummary?: string;
}

export interface UserKeywordContextResult {
  userKeywords: string[];
  libraryKeywords: string[];
  userPhrases: string[];
  libraryPhrases: string[];
  contextSentences: string[];
  contextSummary: string;
}

function normalizeText(text: string): string {
  return text
    .replace(/\bappt\.?\b/gi, 'appointment')
    .replace(/\bdr\.?\b/gi, 'doctor')
    .replace(/\bphys\.?\b/gi, 'physician')
    .trim();
}

function getStopWords(): Set<string> {
  return new Set(
    (DESCRIPTION_GENERATION_CONFIG.stopWords as readonly string[]).map((w) => w.toLowerCase()),
  );
}

function isGenericKeyword(keyword: string): boolean {
  const lower = keyword.toLowerCase().trim();
  return (USER_KEYWORD_CONTEXT.genericKeywords as readonly string[]).includes(lower);
}

function appearsInText(term: string, textLower: string): boolean {
  const termLower = term.toLowerCase().trim();
  if (!termLower) return false;
  if (textLower.includes(termLower)) return true;
  if (termLower.includes(' ')) {
    const words = termLower.split(/\s+/);
    return words.every((word) => {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(textLower);
    });
  }
  const regex = new RegExp(`\\b${termLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return regex.test(textLower);
}

function dedupeTerms(terms: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of terms) {
    const lower = term.toLowerCase().trim();
    if (!lower || seen.has(lower) || isGenericKeyword(lower)) continue;
    seen.add(lower);
    out.push(term.trim());
    if (out.length >= max) break;
  }
  return out;
}

function joinNaturalList(items: string[], maxItems: number): string {
  const slice = items.slice(0, maxItems).filter(Boolean);
  if (slice.length === 0) return '';
  if (slice.length === 1) return slice[0];
  if (slice.length === 2) {
    return `${slice[0]}${DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.commaAnd}${slice[1]}`;
  }
  const head = slice.slice(0, -1).join(DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.comma);
  return `${head}${DESCRIPTION_GENERATION_CONFIG.descriptionSeparators.commaAnd}${slice[slice.length - 1]}`;
}

/**
 * Extract keywords and phrases that originate from user input (not library inference).
 */
export function identifyUserKeywords(taskText: string): UserKeywordAnalysis {
  const normalized = normalizeText(taskText);
  if (!normalized) {
    return { keywords: [], phrases: [] };
  }

  const keywords: string[] = [];
  const stopWords = getStopWords();
  const patterns = USER_KEYWORD_CONTEXT.compoundPatterns;

  for (const match of normalized.matchAll(patterns.priceRange)) {
    if (match[0]) keywords.push(match[0].toLowerCase().trim());
  }
  for (const match of normalized.matchAll(patterns.researchWithObject)) {
    if (match[0]) keywords.push(match[0].toLowerCase().trim());
  }
  for (const match of normalized.matchAll(patterns.vehicleOr)) {
    if (match[0]) keywords.push(match[0].toLowerCase().trim());
  }
  for (const match of normalized.matchAll(patterns.budgetBound)) {
    if (match[0]) keywords.push(match[0].toLowerCase().trim());
  }
  for (const match of normalized.matchAll(patterns.numberWithUnit)) {
    if (match[0]) keywords.push(match[0].toLowerCase().trim());
  }

  const cleaned = normalized
    .replace(/[^\w\s\-–—/$.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const words = cleaned
    .split(/\s+/)
    .filter((w) => w.length >= USER_KEYWORD_CONTEXT.minWordLength)
    .filter((w) => !stopWords.has(w));

  const wordFreq = new Map<string, number>();
  words.forEach((word) => {
    const isPartOfCompound = keywords.some((kw) => kw.includes(word) && kw !== word);
    if (!isPartOfCompound) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  });

  for (const rk of USER_KEYWORD_CONTEXT.researchKeywords) {
    if (words.includes(rk)) {
      wordFreq.set(rk, (wordFreq.get(rk) || 0) + USER_KEYWORD_CONTEXT.researchKeywordBoost);
    }
  }
  for (const vk of USER_KEYWORD_CONTEXT.vehicleKeywords) {
    if (words.includes(vk)) {
      wordFreq.set(vk, (wordFreq.get(vk) || 0) + USER_KEYWORD_CONTEXT.vehicleKeywordBoost);
    }
  }

  const sortedWords = Array.from(wordFreq.entries())
    .sort((a, b) => {
      const aPriority =
        (USER_KEYWORD_CONTEXT.researchKeywords as readonly string[]).includes(a[0])
        || (USER_KEYWORD_CONTEXT.vehicleKeywords as readonly string[]).includes(a[0]);
      const bPriority =
        (USER_KEYWORD_CONTEXT.researchKeywords as readonly string[]).includes(b[0])
        || (USER_KEYWORD_CONTEXT.vehicleKeywords as readonly string[]).includes(b[0]);
      if (aPriority && !bPriority) return -1;
      if (!aPriority && bPriority) return 1;
      if (b[1] !== a[1]) return b[1] - a[1];
      return b[0].length - a[0].length;
    })
    .map(([word]) => word);

  keywords.push(...sortedWords);

  const uniqueKeywords = dedupeTerms(keywords, USER_KEYWORD_CONTEXT.maxUserKeywords);
  const keywordSet = new Set(uniqueKeywords.map((k) => k.toLowerCase()));

  const phrases: string[] = [];
  for (let i = 0; i < words.length; i += 1) {
    for (
      let len = USER_KEYWORD_CONTEXT.minPhraseLength;
      len <= USER_KEYWORD_CONTEXT.maxPhraseLength && i + len <= words.length;
      len += 1
    ) {
      const phrase = words.slice(i, i + len).join(' ');
      const contentWords = phrase.split(/\s+/).filter((w) => !stopWords.has(w));
      if (contentWords.length < USER_KEYWORD_CONTEXT.minPhraseLength) continue;
      const containsKeyword = contentWords.some((w) => keywordSet.has(w));
      if (!containsKeyword) continue;
      if (!phrases.some((p) => p.toLowerCase() === phrase)) {
        phrases.push(phrase);
      }
    }
  }

  phrases.sort((a, b) => {
    const aScore = a.split(/\s+/).filter((w) => keywordSet.has(w)).length;
    const bScore = b.split(/\s+/).filter((w) => keywordSet.has(w)).length;
    if (bScore !== aScore) return bScore - aScore;
    return b.length - a.length;
  });

  return {
    keywords: uniqueKeywords,
    phrases: dedupeTerms(phrases, USER_KEYWORD_CONTEXT.maxUserPhrases),
  };
}

/**
 * Split combined terms into user-origin vs library-suggested buckets.
 */
export function partitionUserAndLibraryTerms(
  taskText: string,
  allKeywords: string[],
  allPhrases: string[],
  libraryKeywords: string[] = [],
  libraryPhrases: string[] = [],
): Pick<UserKeywordContextResult, 'userKeywords' | 'libraryKeywords' | 'userPhrases' | 'libraryPhrases'> {
  const textLower = normalizeText(taskText).toLowerCase();
  const userAnalysis = identifyUserKeywords(taskText);
  const libraryKeywordSet = new Set(libraryKeywords.map((k) => k.toLowerCase()));
  const libraryPhraseSet = new Set(libraryPhrases.map((p) => p.toLowerCase()));

  const userKeywords = dedupeTerms(
    [
      ...userAnalysis.keywords,
      ...allKeywords.filter((kw) => appearsInText(kw, textLower)),
    ],
    USER_KEYWORD_CONTEXT.maxUserKeywords,
  );

  const userPhrases = dedupeTerms(
    [
      ...userAnalysis.phrases,
      ...allPhrases.filter((phrase) => appearsInText(phrase, textLower)),
    ],
    USER_KEYWORD_CONTEXT.maxUserPhrases,
  );

  const userKeywordSet = new Set(userKeywords.map((k) => k.toLowerCase()));
  const userPhraseSet = new Set(userPhrases.map((p) => p.toLowerCase()));

  const libraryOnlyKeywords = dedupeTerms(
    [
      ...allKeywords.filter((kw) => !userKeywordSet.has(kw.toLowerCase()) && libraryKeywordSet.has(kw.toLowerCase())),
      ...libraryKeywords.filter((kw) => !userKeywordSet.has(kw.toLowerCase())),
    ],
    USER_KEYWORD_CONTEXT.maxUserKeywords,
  );

  const libraryOnlyPhrases = dedupeTerms(
    [
      ...allPhrases.filter((p) => !userPhraseSet.has(p.toLowerCase()) && libraryPhraseSet.has(p.toLowerCase())),
      ...libraryPhrases.filter((p) => !userPhraseSet.has(p.toLowerCase())),
    ],
    USER_KEYWORD_CONTEXT.maxUserPhrases,
  );

  return {
    userKeywords,
    libraryKeywords: libraryOnlyKeywords,
    userPhrases,
    libraryPhrases: libraryOnlyPhrases,
  };
}

function pickPrimaryVerb(taskText: string, verbs: string[]): string | null {
  const textLower = normalizeText(taskText).toLowerCase();
  const actionWords = DESCRIPTION_GENERATION_CONFIG.actionWordList ?? [];
  const firstWord = textLower.split(/\s+/)[0];
  if (firstWord && actionWords.includes(firstWord)) return firstWord;
  const inTask = verbs.find((v) => textLower.includes(v.toLowerCase()));
  return inTask ?? verbs[0] ?? null;
}

function pickPrimaryNouns(taskText: string, nouns: string[], userKeywords: string[]): string[] {
  const textLower = normalizeText(taskText).toLowerCase();
  const stopWords = getStopWords();
  const fromTask = nouns.filter((n) => appearsInText(n, textLower));
  if (fromTask.length > 0) return fromTask.slice(0, 2);
  const keywordNouns = userKeywords.filter((k) => !stopWords.has(k.toLowerCase()) && k.split(/\s+/).length === 1);
  return keywordNouns.slice(0, 2);
}

function capitalizeSentence(sentence: string): string {
  const trimmed = sentence.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function ensurePeriod(sentence: string): string {
  const trimmed = sentence.trim();
  if (!trimmed) return '';
  return DESCRIPTION_GENERATION_CONFIG.sentenceEndPattern.test(trimmed)
    ? trimmed
    : `${trimmed}.`;
}

/**
 * Build one or more contextual summary sentences from user keywords and extracted terms.
 */
export function buildContextSentences(input: UserKeywordContextInput): string[] {
  const taskText = normalizeText(input.taskText);
  if (!taskText) return [];

  const external = input.externalSummary?.trim();
  if (external && external.length >= DESCRIPTION_GENERATION_CONFIG.minContextLength) {
    return [ensurePeriod(capitalizeSentence(external))].slice(0, USER_KEYWORD_CONTEXT.maxContextSentences);
  }

  const partitioned = partitionUserAndLibraryTerms(
    taskText,
    input.allKeywords ?? [],
    input.allPhrases ?? [],
    input.libraryKeywords ?? [],
    input.libraryPhrases ?? [],
  );

  const userKeywords = partitioned.userKeywords;
  const userPhrases = partitioned.userPhrases;
  const verbs = input.verbs ?? [];
  const nouns = pickPrimaryNouns(taskText, input.nouns ?? [], userKeywords);
  const primaryVerb = pickPrimaryVerb(taskText, verbs);
  const templates = DESCRIPTION_GENERATION_CONFIG.descriptionTemplates;
  const openers = USER_KEYWORD_CONTEXT.contextOpeners;
  const sentences: string[] = [];

  const primaryPhrase = userPhrases.sort((a, b) => b.length - a.length)[0];
  const keywordList = joinNaturalList(userKeywords, 3);
  const nounList = joinNaturalList(nouns, 2);
  const libraryHint = joinNaturalList(partitioned.libraryKeywords, 2);

  if (primaryVerb && nounList && keywordList) {
    const openerKey = openers[0] as keyof typeof templates;
    sentences.push(
      ensurePeriod(
        `${templates[openerKey]} ${primaryVerb} ${nounList} related to ${keywordList}.`,
      ),
    );
  } else if (primaryPhrase && keywordList) {
    sentences.push(
      ensurePeriod(`${templates.focuses} ${primaryPhrase}, with attention to ${keywordList}.`),
    );
  } else if (primaryPhrase) {
    sentences.push(ensurePeriod(`${templates.focuses} ${primaryPhrase}.`));
  } else if (primaryVerb && nounList) {
    sentences.push(ensurePeriod(`${templates.involves} ${primaryVerb} ${nounList}.`));
  } else if (keywordList) {
    sentences.push(ensurePeriod(`${templates.relates} ${keywordList}.`));
  } else if (taskText.split(/\s+/).length >= USER_KEYWORD_CONTEXT.minPhraseLength) {
    sentences.push(ensurePeriod(`${templates.involves} ${taskText.toLowerCase()}.`));
  }

  if (
    sentences.length < USER_KEYWORD_CONTEXT.maxContextSentences
    && libraryHint
    && partitioned.libraryPhrases.length > 0
  ) {
    const libraryPhrase = partitioned.libraryPhrases[0];
    sentences.push(
      ensurePeriod(`${templates.includes} ${libraryPhrase} in the context of ${libraryHint}.`),
    );
  }

  return sentences
    .slice(0, USER_KEYWORD_CONTEXT.maxContextSentences)
    .map((s) => capitalizeSentence(s));
}

/**
 * Full pipeline: identify user keywords, partition library terms, and produce context summary.
 */
export function buildUserKeywordContext(input: UserKeywordContextInput): UserKeywordContextResult {
  const partitioned = partitionUserAndLibraryTerms(
    input.taskText,
    input.allKeywords ?? [],
    input.allPhrases ?? [],
    input.libraryKeywords ?? [],
    input.libraryPhrases ?? [],
  );

  const contextSentences = buildContextSentences(input);
  const contextSummary = contextSentences
    .join(' ')
    .trim()
    .slice(0, USER_KEYWORD_CONTEXT.maxSummaryLength);

  return {
    ...partitioned,
    contextSentences,
    contextSummary,
  };
}
