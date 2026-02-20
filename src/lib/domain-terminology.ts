/**
 * Domain-Specific Terminology Database
 * 
 * Provides comprehensive terminology maps for business, home, personal, and world scenarios
 * to enable context-aware task analysis and action plan generation.
 */

import {
  DOMAIN_DETECTION_THRESHOLDS,
  DOMAIN_SCORING_WEIGHTS,
  DOMAIN_EXCLUSION_TERMS,
  DESCRIPTION_GENERATION_CONFIG,
} from './ai-config';
import { MILLISECONDS_PER_HOUR } from './business-constants';
import { logger } from './logger';
import { getFromLocalStorage, saveToLocalStorage } from './utils';
import { DEFAULT_TASK_DOMAIN } from './task-constants';
import type { Domain } from './domain-types';

export type { Domain } from './domain-types';

/** Lazy api import to avoid circular dependency (domain-terminology -> api). */
async function getSharedTerminologyFromApi(domain: Domain) {
  const api = await import('./api');
  return api.getSharedTerminology(domain);
}
async function saveSharedTerminologyToApi(
  domain: Domain,
  keywords: string[],
  phrases: string[],
  verbs: string[],
  nouns: string[]
) {
  const api = await import('./api');
  return api.saveSharedTerminology(domain, keywords, phrases, verbs, nouns);
}

/**
 * Terminology configuration constants
 */
const TERMINOLOGY_CONFIG = {
  minKeywordLength: 2, // Minimum length for keywords
  minPhraseLength: 3, // Minimum length for phrases
  minVerbLength: 2, // Minimum length for verbs
  minNounLength: 2, // Minimum length for nouns
  sharedTerminologyCacheTTL: MILLISECONDS_PER_HOUR, // 1 hour cache TTL in milliseconds
  maxSharedTermsPerDomain: 1000, // Maximum number of shared terms to fetch per domain
} as const;

export interface DomainTerminology {
  keywords: string[];
  phrases: string[];
  verbs: string[];
  nouns: string[];
  pronouns: string[];
  context: Domain;
  effortMultiplier: number; // Adjust effort based on domain complexity
}

/**
 * Business Domain Terminology
 * Keywords, phrases, and verbs commonly used in business/professional contexts
 */
export const BUSINESS_TERMINOLOGY: DomainTerminology = {
  keywords: [
    // Context-specific keywords (unique to business)
    'work', 'office', 'professional', 'corporate', 'workplace', 'colleague', 'coworker',
    'workplace', 'business', 'company', 'organization', 'enterprise', 'firm',
    'meeting', 'presentation', 'report', 'deadline', 'client', 'stakeholder', 'budget',
    'revenue', 'roi', 'kpi', 'quarterly', 'annual', 'project', 'milestone', 'deliverable',
    'strategy', 'analysis', 'forecast', 'proposal', 'contract', 'negotiation', 'deal',
    'sales', 'marketing', 'campaign', 'launch', 'product', 'service', 'customer',
    'team', 'collaboration', 'conference', 'workshop', 'training', 'onboarding',
    'review', 'audit', 'compliance', 'documentation', 'process', 'workflow',
    'efficiency', 'optimization', 'scalability', 'growth', 'expansion', 'merger',
    'acquisition', 'partnership', 'vendor', 'supplier', 'invoice', 'payment',
    'accounting', 'finance', 'investment', 'portfolio', 'risk', 'assessment',
    'banking', 'loan', 'credit', 'debit', 'transaction', 'account', 'balance',
    'deposit', 'withdraw', 'transfer', 'mortgage', 'interest', 'rate', 'apr',
    'equity', 'liquidity', 'asset', 'liability', 'revenue', 'expense', 'profit',
    'loss', 'tax', 'deduction', 'refund', 'audit', 'compliance', 'regulation',
    'trading', 'stock', 'bond', 'dividend', 'yield', 'broker', 'exchange',
    'currency', 'forex', 'crypto', 'bitcoin', 'blockchain', 'wallet', 'payment',
    'invoice', 'receipt', 'billing', 'subscription', 'recurring', 'payment',
    'test', 'testing', 'code', 'codebase', 'code base', 'software', 'application', 'app',
    'development', 'programming', 'coding', 'debug', 'debugging', 'bug', 'fix', 'bugfix',
    'feature', 'implementation', 'deployment', 'release', 'version', 'update', 'patch',
    'api', 'database', 'backend', 'frontend', 'ui', 'ux', 'interface', 'component',
    'dialog', 'box', 'section', 'module', 'function', 'method', 'class', 'file',
    'repository', 'repo', 'git', 'commit', 'branch', 'merge', 'pull request', 'pr',
    'technical', 'architecture', 'design', 'specification', 'requirement', 'spec',
    // SaaS and subscription terms
    'saas', 'software as a service', 'subscription', 'subscription model', 'billing cycle',
    'auto-renewal', 'proration', 'freemium', 'tiered pricing', 'usage-based pricing',
    'arr', 'annual recurring revenue', 'mrr', 'monthly recurring revenue', 'churn rate',
    'cac', 'customer acquisition cost', 'ltv', 'lifetime value', 'seat', 'user license',
    'sla', 'service level agreement', 'uptime', 'downtime', 'scalability', 'multi-tenancy',
    'sdk', 'software development kit', 'no-code', 'extensibility', 'privacy-by-design',
    'soc 2', 'compliance', 'data protection', 'security', 'encryption', 'authentication',
    'authorization', 'access control', 'audit log', 'backup', 'disaster recovery',
    // Modern productivity and collaboration terms (2024-2025)
    'async', 'asynchronous', 'async-first', 'async communication', 'sync', 'synchronous', 
    'remote', 'hybrid', 'hybrid work', 'work from home', 'wfh', 'return to office', 'rto',
    'distributed team', 'virtual meeting', 'video conference', 'screen share', 'zoom fatigue',
    'collaboration', 'real-time', 'live', 'streaming', 'webinar', 'workshop', 'training',
    'onboarding', 'offboarding', 'knowledge base', 'documentation', 'wiki', 'faq',
    'ticket', 'support ticket', 'help desk', 'customer support', 'customer success',
    'user feedback', 'feature request', 'roadmap', 'sprint', 'agile', 'scrum', 'kanban',
    'standup', 'retrospective', 'backlog', 'epic', 'story', 'task', 'subtask',
    // Modern workplace trends (2024-2025)
    'quiet quitting', 'great resignation', 'burnout', 'burnout prevention', 'employee wellness',
    'work-life balance', 'work-life integration', 'boundary setting', 'focus time', 'deep work',
    'time blocking', 'calendar blocking', 'meeting fatigue', 'meeting overload', 'async standup',
    'dei', 'diversity equity inclusion', 'belonging', 'inclusive workplace', 'psychological safety',
    'esg', 'environmental social governance', 'sustainability', 'carbon neutral', 'net zero',
    'corporate responsibility', 'social impact', 'b corp', 'triple bottom line',
    // Modern business tools and platforms
    'crm', 'customer relationship management', 'erp', 'enterprise resource planning',
    'project management', 'task management', 'time tracking', 'invoicing', 'accounting',
    'payroll', 'hr', 'human resources', 'recruiting', 'hiring', 'onboarding', 'performance review',
    'okr', 'objectives and key results', 'kpi', 'key performance indicator', 'metrics',
    'analytics', 'dashboard', 'reporting', 'insights', 'data visualization', 'bi', 'business intelligence',
    // Social media and online
    'social media', 'facebook', 'instagram', 'twitter', 'x', 'linkedin', 'tiktok', 'youtube',
    'snapchat', 'pinterest', 'reddit', 'discord', 'telegram', 'whatsapp', 'messenger',
    'post', 'posting', 'share', 'sharing', 'like', 'comment', 'follow', 'unfollow',
    'engagement', 'reach', 'impressions', 'analytics', 'metrics', 'campaign', 'content',
    'influencer', 'viral', 'trending', 'hashtag', 'story', 'reel', 'live', 'stream',
    'online', 'internet', 'web', 'website', 'webpage', 'domain', 'hosting', 'server',
    'cloud', 'saas', 'paas', 'iaas', 'aws', 'azure', 'gcp', 'digital', 'virtual',
    'ecommerce', 'online store', 'shopping cart', 'payment gateway', 'checkout',
    'email', 'newsletter', 'marketing automation', 'crm', 'seo', 'sem', 'ppc',
    // Hardware and mobile devices
    'hardware', 'computer', 'laptop', 'desktop', 'server', 'workstation', 'monitor',
    'keyboard', 'mouse', 'printer', 'scanner', 'router', 'switch', 'firewall',
    'mobile', 'smartphone', 'iphone', 'android', 'tablet', 'ipad', 'smartwatch',
    'wearable', 'device', 'gadget', 'peripheral', 'accessory', 'cable', 'charger',
    'battery', 'power supply', 'ups', 'backup', 'storage', 'hard drive', 'ssd',
    'network', 'wifi', 'bluetooth', 'ethernet', 'usb', 'hdmi', 'display', 'screen',
    'setup', 'install', 'configure', 'troubleshoot', 'repair', 'upgrade', 'replace',
    // Standard operating procedures
    'sop', 'standard operating procedure', 'process', 'workflow', 'procedure', 'protocol',
    'policy', 'guideline', 'checklist', 'template', 'documentation', 'manual', 'guide',
    'training', 'onboarding', 'compliance', 'audit', 'review', 'approval', 'sign-off',
    'quality control', 'qc', 'qa', 'quality assurance', 'testing', 'validation',
    'verification', 'certification', 'accreditation', 'standard', 'best practice',
    // Note: Medical/health terms removed - these belong in Personal domain to prevent miscategorization
    // Medical appointments and health checkups are personal, not business tasks
    // Industries
    'manufacturing', 'production', 'assembly', 'factory', 'warehouse', 'logistics',
    'supply chain', 'distribution', 'shipping', 'receiving', 'inventory', 'stock',
    'retail', 'wholesale', 'sales', 'customer service', 'support', 'help desk',
    'hospitality', 'hotel', 'restaurant', 'catering', 'event', 'conference',
    'education', 'school', 'university', 'college', 'training', 'course', 'class',
    'construction', 'building', 'contractor', 'renovation', 'project', 'site',
    'energy', 'utilities', 'power', 'electric', 'gas', 'water', 'solar', 'wind',
    'agriculture', 'farming', 'crop', 'livestock', 'harvest', 'irrigation',
    'transportation', 'logistics', 'shipping', 'freight', 'delivery', 'courier',
    // Automobiles - ENHANCED with research and purchase keywords
    'car', 'automobile', 'vehicle', 'truck', 'suv', 'sedan', 'coupe', 'convertible',
    'motorcycle', 'bike', 'bicycle', 'maintenance', 'service', 'oil change', 'tire',
    'brake', 'engine', 'transmission', 'battery', 'alternator', 'radiator',
    'repair', 'fix', 'diagnostic', 'inspection', 'registration', 'insurance',
    'dmv', 'license', 'registration', 'title', 'emissions', 'safety', 'inspection',
    'gas', 'fuel', 'electric', 'hybrid', 'charging', 'station', 'parking',
    'driving', 'road trip', 'commute', 'traffic', 'navigation', 'gps', 'map',
    // Research and purchase keywords - ENHANCED for business
    'research', 'researching', 'find', 'finding', 'search', 'searching', 'compare', 'comparing',
    'evaluate', 'evaluating', 'review', 'reviewing', 'analyze', 'analyzing', 'study', 'studying',
    'investigate', 'investigating', 'explore', 'exploring', 'examine', 'examining', 'assess', 'assessing',
    'purchase', 'buy', 'buying', 'shop', 'shopping', 'select', 'selecting', 'choose', 'choosing',
    'decide', 'deciding', 'determine', 'determining', 'pick', 'picking', 'opt', 'opting',
    'best', 'top', 'quality', 'price', 'budget', 'affordable', 'cost', 'value', 'worth', 'deal', 'discount', 'sale',
    'within', 'under', 'over', 'below', 'above', 'up to', 'less than', 'more than', 'range', 'between',
    '10k', '15k', '20k', '25k', '30k', '10k-15k', '15k-20k', '20k-25k', 'price range', 'budget range',
    'features', 'specifications', 'specs', 'options', 'models', 'brands', 'makes', 'manufacturers',
    'reliability', 'safety', 'performance', 'efficiency', 'comfort', 'space', 'cargo', 'seating',
    'test drive', 'inspection', 'history', 'report', 'vin', 'carfax', 'autocheck',
    // Additional business keywords for better matching
    'organize', 'organizing', 'organization', 'organize', 'organizing', 'organizational',
    'clean', 'cleaning', 'cleanup', 'clean up', 'tidy', 'tidying', 'neat', 'orderly',
    'office', 'workspace', 'work space', 'desk', 'desktop', 'workspace', 'cubicle',
    'space', 'area', 'room', 'environment', 'setup', 'arrange', 'arranging', 'arrangement',
    'systematize', 'systematizing', 'system', 'systematic', 'structure', 'structured',
    'streamline', 'streamlining', 'optimize', 'optimizing', 'efficient', 'efficiency',
    'improve', 'improving', 'improvement', 'enhance', 'enhancing', 'enhancement',
    'refine', 'refining', 'refinement', 'polish', 'polishing', 'perfect', 'perfecting',
    // Additional office/workspace keywords
    'up', 'update', 'updating', 'upgrade', 'upgrading', 'refresh', 'refreshing',
    'supplier', 'suppliers', 'vendor', 'vendors', 'provider', 'providers',
    'file', 'files', 'document', 'documents', 'paper', 'papers', 'folder', 'folders',
    'cabinet', 'cabinets', 'drawer', 'drawers', 'shelf', 'shelves', 'storage', 'storages',
    'equipment', 'equipments', 'tool', 'tools', 'supply', 'supplies', 'material', 'materials',
    'item', 'items', 'belonging', 'belongings', 'stuff', 'things', 'object', 'objects',
    'remove', 'removing', 'removal', 'discard', 'discarding', 'dispose', 'disposing',
    'sort', 'sorting', 'categorize', 'categorizing', 'group', 'grouping', 'classify', 'classifying',
    'label', 'labeling', 'tag', 'tagging', 'mark', 'marking', 'identify', 'identifying',
    'inventory', 'inventories', 'audit', 'audits', 'check', 'checking', 'review', 'reviewing',
    'maintain', 'maintaining', 'maintenance', 'preserve', 'preserving', 'preservation',
    'clear', 'clearing', 'empty', 'emptying', 'vacate', 'vacating', 'free', 'freeing',
    'reorganize', 'reorganizing', 'reorganization', 'restructure', 'restructuring',
    'refresh', 'refreshing', 'renew', 'renewing', 'revitalize', 'revitalizing',
    'sanitize', 'sanitizing', 'disinfect', 'disinfecting', 'sterilize', 'sterilizing',
    'dust', 'dusting', 'wipe', 'wiping', 'sweep', 'sweeping', 'mop', 'mopping', 'vacuum', 'vacuuming',
    // Additional business action keywords
    'execute', 'executing', 'implement', 'implementing', 'deploy', 'deploying', 'launch', 'launching',
    'initiate', 'initiating', 'start', 'starting', 'begin', 'beginning', 'commence', 'commencing',
    'complete', 'completing', 'finish', 'finishing', 'finalize', 'finalizing', 'conclude', 'concluding',
    'submit', 'submitting', 'deliver', 'delivering', 'handoff', 'handing off', 'transfer', 'transferring',
    'approve', 'approving', 'authorize', 'authorizing', 'validate', 'validating', 'verify', 'verifying',
    'review', 'reviewing', 'assess', 'assessing', 'evaluate', 'evaluating', 'analyze', 'analyzing',
    'plan', 'planning', 'strategize', 'strategizing', 'design', 'designing', 'architect', 'architecting',
    'develop', 'developing', 'build', 'building', 'create', 'creating', 'construct', 'constructing',
    'integrate', 'integrating', 'connect', 'connecting', 'link', 'linking', 'merge', 'merging',
    'optimize', 'optimizing', 'improve', 'improving', 'enhance', 'enhancing', 'refine', 'refining',
    'update', 'updating', 'upgrade', 'upgrading', 'modernize', 'modernizing', 'refresh', 'refreshing',
    'maintain', 'maintaining', 'support', 'supporting', 'sustain', 'sustaining', 'preserve', 'preserving',
    'monitor', 'monitoring', 'track', 'tracking', 'observe', 'observing', 'watch', 'watching',
    'measure', 'measuring', 'quantify', 'quantifying', 'calculate', 'calculating', 'compute', 'computing',
    'report', 'reporting', 'document', 'documenting', 'record', 'recording', 'log', 'logging',
    'communicate', 'communicating', 'share', 'sharing', 'inform', 'informing', 'notify', 'notifying',
    'collaborate', 'collaborating', 'cooperate', 'cooperating', 'coordinate', 'coordinating', 'sync', 'syncing',
    'train', 'training', 'educate', 'educating', 'teach', 'teaching', 'instruct', 'instructing',
    'mentor', 'mentoring', 'coach', 'coaching', 'guide', 'guiding', 'advise', 'advising',
    'negotiate', 'negotiating', 'discuss', 'discussing', 'meet', 'meeting', 'conference', 'conferencing',
    'present', 'presenting', 'demonstrate', 'demonstrating', 'showcase', 'showcasing', 'exhibit', 'exhibiting',
    'sell', 'selling', 'market', 'marketing', 'promote', 'promoting', 'advertise', 'advertising',
    'acquire', 'acquiring', 'obtain', 'obtaining', 'secure', 'securing', 'procure', 'procuring',
    'manage', 'managing', 'administer', 'administering', 'oversee', 'overseeing', 'supervise', 'supervising',
    'lead', 'leading', 'direct', 'directing', 'guide', 'guiding', 'steer', 'steering',
    'organize', 'organizing', 'arrange', 'arranging', 'structure', 'structuring', 'systematize', 'systematizing',
    'schedule', 'scheduling', 'plan', 'planning', 'arrange', 'arranging', 'coordinate', 'coordinating',
    'prioritize', 'prioritizing', 'rank', 'ranking', 'order', 'ordering', 'sequence', 'sequencing',
    'resolve', 'resolving', 'solve', 'solving', 'fix', 'fixing', 'repair', 'repairing',
    'troubleshoot', 'troubleshooting', 'debug', 'debugging', 'diagnose', 'diagnosing', 'investigate', 'investigating',
    // Vehicle and purchase intent
    'used car', 'used vehicle', 'pre-owned', 'secondhand', 'continue', 'continuing', 'resume', 'resuming'
  ],
  phrases: [
    'used car search', 'search for used car', 'car under budget', 'vehicle under budget',
    'continue search', 'continue car search', 'resume vehicle search', 'find used car',
    'quarterly review', 'client call', 'project milestone', 'stakeholder update',
    'team meeting', 'status update', 'progress report', 'budget review',
    'strategic planning', 'business development', 'market analysis', 'competitive analysis',
    'product launch', 'go-to-market', 'sales pipeline', 'customer acquisition',
    'performance review', 'one-on-one', 'stand-up meeting', 'sprint planning',
    'retrospective', 'code review', 'technical debt', 'system architecture',
    'data analysis', 'financial report', 'quarterly earnings', 'annual planning',
    'test code', 'code testing', 'unit test', 'integration test', 'test suite',
    'test case', 'test coverage', 'code base', 'codebase', 'source code',
    'dialog box', 'task dialog', 'user interface', 'ui component', 'ui element',
    'software development', 'application development', 'feature development',
    'bug fix', 'bug fixing', 'code fix', 'debug code', 'code debugging',
    'pull request', 'code merge', 'git commit', 'version control', 'code repository',
    'technical specification', 'system design', 'architecture design', 'api design',
    // SaaS and subscription phrases
    'subscription management', 'billing cycle', 'auto-renewal', 'subscription renewal',
    'customer retention', 'churn reduction', 'lifetime value', 'customer acquisition',
    'service level agreement', 'uptime guarantee', 'downtime notification', 'system maintenance',
    'data backup', 'disaster recovery', 'security audit', 'compliance check',
    'privacy policy', 'terms of service', 'user agreement', 'data protection',
    // Modern productivity phrases
    'remote collaboration', 'virtual meeting', 'video conference', 'screen sharing',
    'async communication', 'real-time collaboration', 'distributed team', 'hybrid work',
    'work from home', 'remote work', 'flexible schedule', 'work-life balance',
    'knowledge sharing', 'documentation review', 'onboarding process', 'training session',
    'user feedback', 'feature request', 'product roadmap', 'sprint planning',
    'agile methodology', 'scrum meeting', 'kanban board', 'task prioritization',
    // Business tools phrases
    'customer relationship management', 'sales pipeline', 'lead generation', 'conversion tracking',
    'project management', 'task assignment', 'time tracking', 'resource allocation',
    'performance metrics', 'analytics dashboard', 'data visualization', 'business intelligence',
    'financial reporting', 'budget planning', 'expense tracking', 'invoice processing',
    // Additional business phrases for better matching
    'organize workspace', 'organize office', 'organize work space', 'organize desk',
    'clean office', 'clean workspace', 'clean work space', 'clean desk', 'clean area',
    'office organization', 'workspace organization', 'desk organization', 'space organization',
    'office cleanup', 'workspace cleanup', 'desk cleanup', 'area cleanup',
    'organize files', 'organize documents', 'organize papers', 'organize materials',
    'office setup', 'workspace setup', 'desk setup', 'work area setup',
    'improve organization', 'enhance organization', 'streamline organization',
    'create organized space', 'maintain organized workspace', 'keep workspace organized',
    'systematic organization', 'structured workspace', 'efficient organization',
    'professional organization', 'workplace organization', 'office management',
    'workspace management', 'desk management', 'space management', 'area management',
    // Additional office/workspace phrases
    'clean up office', 'clean up workspace', 'clean up desk', 'clean up area',
    'organize and clean', 'clean and organize', 'tidy up office', 'tidy up workspace',
    'office space cleanup', 'workspace cleanup', 'desk cleanup', 'area cleanup',
    'update supplier', 'update suppliers', 'update vendor', 'update vendors',
    'supplier update', 'vendor update', 'provider update', 'contact update',
    'file organization', 'document organization', 'paper organization', 'folder organization',
    'sort files', 'sort documents', 'categorize items', 'group belongings',
    'remove clutter', 'clear space', 'empty drawers', 'organize storage',
    'desk organization', 'cabinet organization', 'drawer organization', 'shelf organization',
    'workspace refresh', 'office refresh', 'desk refresh', 'area refresh',
    'maintain workspace', 'preserve organization', 'keep organized', 'stay organized',
    'reorganize office', 'restructure workspace', 'refresh environment', 'renew space',
    'deep clean office', 'thorough cleanup', 'complete organization', 'full cleanup',
    'sanitize workspace', 'disinfect office', 'sterilize area', 'clean surfaces',
    'dust surfaces', 'wipe down', 'sweep floor', 'mop floor', 'vacuum carpet',
    'inventory items', 'audit supplies', 'check materials', 'review belongings',
    'label items', 'tag files', 'mark containers', 'identify objects',
    'remove old items', 'discard unused', 'dispose waste', 'clear out',
      'create storage', 'set up storage', 'organize storage', 'manage storage',
      'improve efficiency', 'enhance productivity', 'optimize workspace', 'streamline workflow',
    'financial report', 'quarterly earnings', 'annual report', 'balance sheet',
    'income statement', 'cash flow', 'budget analysis', 'financial planning',
    'investment strategy', 'portfolio management', 'risk assessment', 'credit check',
    'loan application', 'mortgage approval', 'tax filing', 'tax return',
    'bank statement', 'account reconciliation', 'payment processing', 'transaction history',
    // Contextual phrases that explain tasks
    'ensure quality and accuracy', 'maintain professional standards', 'follow best practices',
    'meet project requirements', 'deliver on schedule', 'achieve business objectives',
    'optimize performance', 'improve efficiency', 'enhance user experience',
    'resolve technical issues', 'implement solutions', 'coordinate with team members',
    'analyze data trends', 'evaluate outcomes', 'make informed decisions',
    'communicate effectively', 'document processes', 'track progress',
    'manage resources', 'allocate budget', 'prioritize tasks',
    'ensure compliance', 'maintain security', 'protect data',
    'collaborate with stakeholders', 'align with goals', 'drive results',
    // Additional contextual phrases for office/workspace tasks
    'organize workspace efficiently', 'maintain clean office environment', 'remove clutter from workspace',
    'create organized office space', 'ensure workspace cleanliness and order', 'systematically organize office area',
    'improve workspace organization', 'establish organized work environment', 'maintain tidy workspace',
    'create efficient workspace layout', 'optimize office space utilization', 'enhance workspace functionality',
    'ensure workspace is well organized', 'maintain professional workspace appearance', 'create productive work environment',
    'organize office for better productivity', 'maintain clean and organized workspace', 'ensure office space is functional',
    'create systematic workspace organization', 'maintain organized and efficient workspace', 'ensure workspace meets professional standards',
    // Contextual phrases for cleaning tasks
    'thoroughly clean workspace', 'ensure workspace cleanliness', 'maintain clean work environment',
    'create clean and organized space', 'ensure all areas are clean', 'maintain high cleanliness standards',
    'perform comprehensive cleaning', 'ensure thorough cleaning', 'maintain clean and sanitary workspace',
    // Contextual phrases for organization tasks
    'systematically organize items', 'create logical organization system', 'establish efficient organization structure',
    'organize items for easy access', 'create organized storage system', 'maintain organized structure',
    'ensure items are properly organized', 'create systematic organization', 'maintain consistent organization',
    // Contextual phrases for file/document tasks
    'organize files systematically', 'create logical file structure', 'ensure files are properly categorized',
    'maintain organized file system', 'create efficient document organization', 'ensure documents are easily accessible',
    'organize documents by category', 'create systematic document filing', 'maintain organized document structure',
    // Additional contextual business phrases
    'execute project deliverables', 'implement strategic initiatives', 'deploy system updates',
    'launch new product features', 'initiate business processes', 'start project phases',
    'complete task assignments', 'finish project milestones', 'finalize business reports',
    'submit proposals and documents', 'deliver client presentations', 'transfer knowledge and skills',
    'approve budget allocations', 'authorize project expenditures', 'validate data accuracy',
    'verify system compliance', 'review performance metrics', 'assess project outcomes',
    'evaluate business opportunities', 'analyze market trends', 'examine financial statements',
    'plan strategic initiatives', 'design system architecture', 'develop business solutions',
    'build customer relationships', 'create marketing campaigns', 'construct business models',
    'integrate system components', 'connect business processes', 'link data sources',
    'update business procedures', 'upgrade technology systems', 'modernize workflows',
    'maintain system performance', 'support team members', 'sustain business operations',
    'monitor key metrics', 'track project progress', 'observe market changes',
    'measure business outcomes', 'calculate financial projections', 'compute performance indicators',
    'report business results', 'document processes and procedures', 'record meeting minutes',
    'communicate with stakeholders', 'share information and updates', 'inform team members',
    'train new employees', 'educate staff members', 'teach best practices',
    'mentor junior colleagues', 'coach team members', 'guide project teams',
    'negotiate contracts and deals', 'discuss business strategies', 'meet with clients',
    'present business proposals', 'demonstrate product features', 'showcase company capabilities',
    'sell products and services', 'market business offerings', 'promote brand awareness',
    'acquire new customers', 'obtain necessary resources', 'secure business partnerships',
    'manage project timelines', 'administer business operations', 'oversee team activities',
    'lead cross-functional teams', 'direct business initiatives', 'steer strategic direction',
    'schedule meetings and appointments', 'arrange business events', 'coordinate team activities',
    'prioritize business objectives', 'rank project importance', 'sequence task execution',
    'resolve business conflicts', 'solve technical problems', 'fix system issues',
    'troubleshoot technical issues', 'debug application errors', 'diagnose performance problems',
    'investigate business opportunities', 'research market conditions', 'explore new technologies',
    'continue searching for vehicle', 'continue car search', 'search for used car under budget',
    'find vehicle within budget', 'research used car options', 'compare used car listings'
  ],
  verbs: [
    'present', 'negotiate', 'strategize', 'analyze', 'forecast', 'delegate', 'coordinate',
    'collaborate', 'communicate', 'pitch', 'propose', 'approve', 'reject', 'review',
    'audit', 'assess', 'evaluate', 'optimize', 'scale', 'expand', 'launch', 'release',
    'deliver', 'execute', 'implement', 'manage', 'lead', 'facilitate', 'moderate',
    'document', 'report', 'track', 'monitor', 'measure', 'benchmark', 'improve',
    'test', 'testing', 'debug', 'debugging', 'fix', 'fixing', 'develop', 'developing',
    'code', 'coding', 'program', 'programming', 'build', 'building', 'compile',
    'deploy', 'deploying', 'integrate', 'integrating', 'refactor', 'refactoring',
    'optimize', 'optimizing', 'validate', 'validating', 'verify', 'verifying',
    'conduct', 'conducting', 'perform', 'performing', 'run', 'running', 'execute', 'executing',
    // SaaS and subscription verbs
    'subscribe', 'subscribing', 'renew', 'renewing', 'cancel', 'canceling', 'upgrade', 'upgrading',
    'downgrade', 'downgrading', 'billing', 'charging', 'invoice', 'invoicing', 'process', 'processing',
    'track', 'tracking', 'monitor', 'monitoring', 'analyze', 'analyzing', 'measure', 'measuring',
    'scale', 'scaling', 'expand', 'expanding', 'grow', 'growing', 'retain', 'retaining',
    'acquire', 'acquiring', 'onboard', 'onboarding', 'offboard', 'offboarding',
    // Modern productivity verbs
    'collaborate', 'collaborating', 'sync', 'syncing', 'share', 'sharing', 'stream', 'streaming',
    'broadcast', 'broadcasting', 'webinar', 'hosting', 'present', 'presenting', 'demo', 'demonstrating',
    'train', 'training', 'educate', 'educating', 'mentor', 'mentoring', 'coach', 'coaching',
    'feedback', 'reviewing', 'approve', 'approving', 'reject', 'rejecting', 'prioritize', 'prioritizing',
    'schedule', 'scheduling', 'plan', 'planning', 'organize', 'organizing', 'coordinate', 'coordinating',
    // Additional business verbs for better matching
    'organize', 'organizing', 'arrange', 'arranging', 'systematize', 'systematizing',
    'clean', 'cleaning', 'cleanup', 'tidy', 'tidying', 'neaten', 'neatening',
    'setup', 'setting up', 'set up', 'configure', 'configuring', 'arrange', 'arranging',
    'streamline', 'streamlining', 'optimize', 'optimizing', 'improve', 'improving',
    'enhance', 'enhancing', 'refine', 'refining', 'polish', 'polishing', 'perfect', 'perfecting',
    'structure', 'structuring', 'systematize', 'systematizing', 'order', 'ordering',
    'manage', 'managing', 'maintain', 'maintaining', 'keep', 'keeping', 'preserve', 'preserving',
    // Additional office/workspace verbs
    'update', 'updating', 'upgrade', 'upgrading', 'refresh', 'refreshing', 'renew', 'renewing',
    'remove', 'removing', 'discard', 'discarding', 'dispose', 'disposing', 'clear', 'clearing',
    'empty', 'emptying', 'vacate', 'vacating', 'free', 'freeing', 'release', 'releasing',
    'sort', 'sorting', 'categorize', 'categorizing', 'group', 'grouping', 'classify', 'classifying',
    'label', 'labeling', 'tag', 'tagging', 'mark', 'marking', 'identify', 'identifying',
    'inventory', 'inventorizing', 'audit', 'auditing', 'check', 'checking', 'review', 'reviewing',
    'reorganize', 'reorganizing', 'restructure', 'restructuring', 'revitalize', 'revitalizing',
    'sanitize', 'sanitizing', 'disinfect', 'disinfecting', 'sterilize', 'sterilizing',
      'dust', 'dusting', 'wipe', 'wiping', 'sweep', 'sweeping', 'mop', 'mopping', 'vacuum', 'vacuuming',
      'inspect', 'inspecting', 'examine', 'examining', 'evaluate', 'evaluating', 'assess', 'assessing',
    'invest', 'investing', 'deposit', 'depositing', 'withdraw', 'withdrawing',
    'transfer', 'transferring', 'calculate', 'calculating', 'analyze', 'analyzing',
    'budget', 'budgeting', 'forecast', 'forecasting', 'reconcile', 'reconciling',
    'file', 'filing', 'submit', 'submitting', 'approve', 'approving', 'process', 'processing',
    // Additional business action verbs
    'execute', 'executing', 'implement', 'implementing', 'deploy', 'deploying', 'launch', 'launching',
    'initiate', 'initiating', 'commence', 'commencing', 'finalize', 'finalizing', 'conclude', 'concluding',
    'deliver', 'delivering', 'handoff', 'handing off', 'authorize', 'authorizing', 'validate', 'validating',
    'strategize', 'strategizing', 'architect', 'architecting', 'construct', 'constructing',
    'integrate', 'integrating', 'merge', 'merging', 'modernize', 'modernizing',
    'sustain', 'sustaining', 'preserve', 'preserving', 'observe', 'observing',
    'quantify', 'quantifying', 'compute', 'computing', 'document', 'documenting',
    'informing', 'notify', 'notifying', 'instruct', 'instructing', 'advise', 'advising',
    'conferencing', 'showcasing', 'exhibiting', 'advertising', 'obtaining', 'securing', 'procuring',
    'administering', 'overseeing', 'supervising', 'directing', 'steering',
    'sequencing', 'solving', 'repairing', 'diagnosing', 'investigating'
  ],
  nouns: [
    'meeting', 'presentation', 'report', 'deadline', 'client', 'stakeholder', 'budget',
    'revenue', 'roi', 'kpi', 'quarter', 'project', 'milestone', 'deliverable',
    'strategy', 'analysis', 'forecast', 'proposal', 'contract', 'negotiation', 'deal',
    'sales', 'marketing', 'campaign', 'product', 'service', 'customer', 'team',
    'conference', 'workshop', 'training', 'review', 'audit', 'compliance', 'documentation',
    'process', 'workflow', 'efficiency', 'optimization', 'growth', 'expansion', 'merger',
    'acquisition', 'partnership', 'vendor', 'supplier', 'invoice', 'payment', 'finance',
    'test', 'testing', 'code', 'codebase', 'code base', 'software', 'application', 'app',
    'development', 'programming', 'coding', 'bug', 'fix', 'bugfix', 'feature',
    'implementation', 'deployment', 'release', 'version', 'update', 'patch',
    'api', 'database', 'backend', 'frontend', 'ui', 'ux', 'interface', 'component',
    'dialog', 'box', 'section', 'module', 'function', 'method', 'class', 'file',
    'repository', 'repo', 'git', 'commit', 'branch', 'merge', 'pull request', 'pr',
    'technical', 'architecture', 'design', 'specification', 'requirement', 'spec',
    // Additional business nouns for better matching
    'organization', 'organizing', 'arrangement', 'arranging', 'systematization',
    'cleanup', 'cleaning', 'tidying', 'neatness', 'order', 'orderliness',
    'workspace', 'work space', 'office', 'desk', 'desktop', 'area', 'space', 'room',
    'environment', 'setup', 'configuration', 'arrangement', 'structure', 'system',
    'files', 'documents', 'papers', 'materials', 'items', 'belongings', 'supplies',
    'efficiency', 'organization', 'structure', 'system', 'order', 'neatness', 'tidiness',
    // Additional office/workspace nouns
    'update', 'updates', 'upgrade', 'upgrades', 'refresh', 'refreshes', 'renewal', 'renewals',
    'supplier', 'suppliers', 'vendor', 'vendors', 'provider', 'providers', 'contact', 'contacts',
    'file', 'files', 'document', 'documents', 'paper', 'papers', 'folder', 'folders',
    'cabinet', 'cabinets', 'drawer', 'drawers', 'shelf', 'shelves', 'storage', 'storages',
    'equipment', 'equipments', 'tool', 'tools', 'supply', 'supplies', 'material', 'materials',
    'item', 'items', 'belonging', 'belongings', 'stuff', 'things', 'object', 'objects',
    'removal', 'removals', 'discard', 'discards', 'disposal', 'disposals', 'clearance', 'clearances',
    'sorting', 'categorization', 'grouping', 'classification', 'labeling', 'tagging', 'marking',
    'inventory', 'inventories', 'audit', 'audits', 'check', 'checks', 'review', 'reviews',
    'maintenance', 'preservation', 'sanitization', 'disinfection', 'sterilization',
    'dusting', 'wiping', 'sweeping', 'mopping', 'vacuuming', 'cleaning', 'tidying',
    'inspection', 'inspections', 'examination', 'examinations', 'evaluation', 'evaluations', 'assessment', 'assessments',
    'reorganization', 'restructuring', 'revitalization', 'refreshment', 'renewal',
    'clutter', 'mess', 'disorder', 'chaos', 'untidiness', 'disarray',
    // Additional business nouns
    'execution', 'implementation', 'deployment', 'launch', 'initiation', 'commencement',
    'completion', 'finalization', 'conclusion', 'delivery', 'handoff', 'transfer',
    'authorization', 'validation', 'verification', 'review', 'assessment', 'evaluation',
    'analysis', 'examination', 'planning', 'strategy', 'design', 'architecture',
    'development', 'construction', 'creation', 'integration', 'connection', 'linkage',
    'update', 'upgrade', 'modernization', 'refresh', 'maintenance', 'support',
    'sustainability', 'preservation', 'monitoring', 'tracking', 'observation',
    'measurement', 'quantification', 'calculation', 'computation', 'reporting',
    'documentation', 'recording', 'logging', 'communication', 'sharing', 'information',
    'notification', 'training', 'education', 'instruction', 'mentoring', 'coaching',
    'guidance', 'advice', 'negotiation', 'discussion', 'meeting', 'conference',
    'presentation', 'demonstration', 'showcase', 'exhibition', 'sale', 'marketing',
    'promotion', 'advertisement', 'acquisition', 'obtainment', 'security', 'procurement',
    'management', 'administration', 'oversight', 'supervision', 'leadership', 'direction',
    'guidance', 'scheduling', 'arrangement', 'coordination', 'prioritization', 'ranking',
    'ordering', 'sequencing', 'resolution', 'solution', 'repair', 'troubleshooting',
    'debugging', 'diagnosis', 'investigation', 'research', 'exploration'
  ],
  pronouns: [
    'we', 'us', 'our', 'ours', 'ourselves', 'they', 'them', 'their', 'theirs', 'themselves',
    'you', 'your', 'yours', 'yourself', 'yourselves', 'it', 'its', 'itself'
  ],
  context: 'business',
  effortMultiplier: 1.0, // Base multiplier for business tasks
};

/**
 * Home Domain Terminology
 * Keywords, phrases, and verbs commonly used in home/maintenance contexts
 */
export const HOME_TERMINOLOGY: DomainTerminology = {
  keywords: [
    // Context-specific keywords (unique to home)
    'household', 'residential', 'domestic', 'homeowner', 'home', 'house', 'residence',
    'groceries', 'cleaning', 'maintenance', 'repair', 'cooking', 'laundry', 'organizing',
    'decluttering', 'yard', 'garden', 'landscaping', 'plumbing', 'electrical', 'appliance',
    'furniture', 'decoration', 'renovation', 'remodeling', 'painting', 'flooring',
    'roofing', 'siding', 'windows', 'doors', 'heating', 'cooling', 'hvac',
    'insurance', 'mortgage', 'utilities', 'bills', 'taxes', 'homeowner', 'property',
    'supplies', 'shopping', 'meal prep', 'meal planning', 'deep clean', 'spring cleaning',
    'holiday prep', 'seasonal', 'maintenance schedule', 'home improvement', 'diy',
    'pet', 'pets', 'cat', 'cats', 'dog', 'dogs', 'animal', 'animals', 'litter', 'litter box',
    'auto', 'automatic', 'automated', 'pet care', 'pet supplies', 'pet food', 'pet accessories',
    'find', 'finding', 'search', 'searching', 'research', 'researching', 'compare', 'comparing',
    'purchase', 'buy', 'buying', 'shop', 'shopping', 'select', 'selecting', 'choose', 'choosing',
    'cooking', 'baking', 'recipe', 'ingredient', 'meal', 'dinner', 'lunch', 'breakfast',
    'snack', 'dessert', 'appetizer', 'entree', 'beverage', 'drink', 'beverages',
    'grocery', 'groceries', 'supermarket', 'store', 'market', 'restaurant', 'cafe',
    'kitchen', 'stove', 'oven', 'microwave', 'refrigerator', 'freezer', 'pantry',
    'spice', 'spices', 'herb', 'herbs', 'seasoning', 'sauce', 'marinade', 'dressing',
    'real estate', 'property', 'house', 'home', 'apartment', 'condo', 'condominium',
    'townhouse', 'mansion', 'villa', 'cottage', 'cabin', 'duplex', 'triplex',
    'buying', 'selling', 'renting', 'leasing', 'mortgage', 'down payment', 'closing',
    'inspection', 'appraisal', 'title', 'deed', 'escrow', 'agent', 'realtor', 'broker',
    'listing', 'offer', 'counteroffer', 'negotiation', 'contract', 'closing costs',
    'family', 'kids', 'children', 'child', 'parent', 'parents', 'sibling', 'siblings',
    'grandparent', 'grandparents', 'aunt', 'uncle', 'cousin', 'cousins', 'nephew', 'niece',
    'birthday', 'anniversary', 'holiday', 'vacation', 'trip', 'celebration', 'party',
    'themed', 'royal', 'banquet', 'venue', 'catering', 'caterer', 'decorations', 'decor',
    'entertainment', 'guest list', 'invitations', 'rsvp', 'photography', 'photographer',
    'videography', 'timeline', 'agenda', 'wedding', 'reception', 'bridal shower',
    'baby shower', 'gender reveal', 'graduation party', 'retirement party',
    'corporate event', 'gala', 'fundraiser', 'formal dinner', 'black tie',
    'cocktail party', 'ceremony', 'event planning', 'party planning',
    'school', 'education', 'homework', 'study', 'learning', 'tutoring', 'lesson',
    'activity', 'activities', 'play', 'playing', 'game', 'games', 'toy', 'toys',
    'sport', 'sports', 'practice', 'rehearsal', 'performance', 'recital', 'concert',
    // Social media and online (home/personal)
    'social media', 'facebook', 'instagram', 'twitter', 'x', 'linkedin', 'tiktok', 'youtube',
    'snapchat', 'pinterest', 'reddit', 'discord', 'telegram', 'whatsapp', 'messenger',
    'post', 'posting', 'share', 'sharing', 'like', 'comment', 'follow', 'unfollow',
    'online', 'internet', 'web', 'website', 'webpage', 'email', 'newsletter',
    'mobile', 'smartphone', 'iphone', 'android', 'tablet', 'ipad', 'smartwatch',
    'device', 'gadget', 'setup', 'install', 'configure', 'troubleshoot', 'repair',
    // Medical and health (home/personal)
    'medical', 'health', 'healthcare', 'doctor', 'physician', 'nurse', 'patient',
    'appointment', 'checkup', 'examination', 'diagnosis', 'treatment', 'therapy',
    'medication', 'prescription', 'pharmacy', 'hospital', 'clinic', 'emergency',
    'wellness', 'fitness', 'exercise', 'workout', 'diet', 'nutrition', 'vitamin',
    'supplement', 'mental health', 'insurance', 'health insurance', 'medical insurance',
    // Automobiles (home/personal) - ENHANCED with research and purchase keywords
    'car', 'automobile', 'vehicle', 'truck', 'suv', 'sedan', 'coupe', 'convertible', 'motorcycle', 'bike', 'bicycle',
    'maintenance', 'service', 'oil change', 'tire', 'brake', 'engine', 'battery', 'transmission', 'alternator', 'radiator',
    'repair', 'fix', 'inspection', 'registration', 'insurance', 'dmv', 'license', 'title', 'emissions', 'safety',
    'gas', 'fuel', 'electric', 'hybrid', 'charging', 'station', 'parking', 'driving', 'road trip', 'commute', 'traffic',
    'navigation', 'gps', 'map', 'mileage', 'mpg', 'fuel economy', 'warranty', 'dealer', 'dealership', 'private seller',
    // Research and purchase keywords - ENHANCED
    'research', 'researching', 'find', 'finding', 'search', 'searching', 'compare', 'comparing', 'evaluate', 'evaluating',
    'review', 'reviewing', 'analyze', 'analyzing', 'study', 'studying', 'investigate', 'investigating', 'explore', 'exploring',
    'examine', 'examining', 'assess', 'assessing', 'purchase', 'buy', 'buying', 'shop', 'shopping', 'select', 'selecting',
    'choose', 'choosing', 'decide', 'deciding', 'pick', 'picking', 'opt', 'opting', 'determine', 'determining',
    'best', 'top', 'quality', 'price', 'budget', 'affordable', 'cost', 'value', 'worth', 'deal', 'discount', 'sale',
    'within', 'under', 'over', 'below', 'above', 'up to', 'less than', 'more than', 'range', 'between',
    '10k', '15k', '20k', '25k', '30k', '10k-15k', '15k-20k', '20k-25k', 'price range', 'budget range',
    'features', 'specifications', 'specs', 'options', 'models', 'brands', 'makes', 'manufacturers',
    'reliability', 'safety', 'performance', 'efficiency', 'comfort', 'space', 'cargo', 'seating',
    'test drive', 'inspection', 'history', 'report', 'vin', 'carfax', 'autocheck',
    // Modern home management keywords
        'smart home', 'home automation', 'iot', 'internet of things', 'smart device', 'smart devices',
        'matter protocol', 'thread protocol', 'homekit', 'google home', 'alexa', 'siri',
        'smart appliance', 'smart tv', 'smart doorbell', 'smart garage', 'smart irrigation',
    'smart thermostat', 'smart lighting', 'smart lock', 'smart security', 'home assistant',
    'alexa', 'google home', 'siri', 'voice control', 'automation', 'automated',
    'energy efficiency', 'solar panel', 'solar panels', 'renewable energy', 'sustainability',
    'eco-friendly', 'green living', 'carbon footprint', 'recycling', 'composting',
    'minimalism', 'decluttering', 'konmari', 'organization system', 'storage solution',
    'home security', 'security system', 'camera', 'cameras', 'alarm', 'surveillance',
    'interior design', 'home decor', 'furniture shopping', 'home staging', 'renovation planning',
    'diy', 'do it yourself', 'home improvement project', 'maintenance schedule', 'home warranty',
    'home insurance', 'property management', 'rental property', 'landlord', 'tenant',
    'home equity', 'refinance', 'home loan', 'property tax', 'homeowners association', 'hoa',
    'smart appliance', 'smart appliances', 'connected home', 'home network', 'wifi setup',
    'home office', 'remote workspace', 'ergonomic', 'standing desk', 'home gym',
    'meal delivery', 'grocery delivery', 'online shopping', 'subscription box', 'home services',
    // Vehicle and purchase (home/household)
    'used car', 'used vehicle', 'pre-owned', 'secondhand', 'continue', 'continuing', 'resume', 'resuming',
    'household vehicle', 'family car', 'budget car', 'affordable car', 'car shopping'
  ],
  phrases: [
    'used car search', 'search for used car', 'car under budget', 'vehicle under budget',
    'continue search', 'continue car search', 'resume vehicle search', 'find used car',
    'used car under 15k', 'used car under 20k', 'find used car under budget',
    'home improvement', 'deep clean', 'meal prep', 'yard work', 'garden maintenance',
    'spring cleaning', 'holiday preparation', 'home maintenance', 'appliance repair',
    'room organization', 'closet organization', 'garage cleanup', 'attic organization',
    'basement cleanup', 'exterior maintenance', 'interior decoration', 'furniture assembly',
    'light fixture installation', 'plumbing repair', 'electrical work', 'painting project',
    'flooring installation', 'window replacement', 'door repair', 'roof inspection',
    'gutter cleaning', 'driveway repair', 'fence maintenance', 'shed organization',
    'pet litter', 'auto pet litter', 'automatic pet litter', 'pet litter box',
    'automatic litter box', 'self cleaning litter box', 'pet care products',
    'pet supplies shopping', 'find pet products', 'research pet products',
    'compare pet products', 'pet accessories', 'pet food', 'pet toys',
    // Additional home phrases for better matching
    'organize space', 'organize area', 'organize room', 'organize home', 'organize house',
    'clean space', 'clean area', 'clean room', 'clean home', 'clean house',
    'home organization', 'house organization', 'space organization', 'area organization',
    'home cleanup', 'house cleanup', 'space cleanup', 'area cleanup',
    'organize belongings', 'organize items', 'organize supplies', 'organize materials',
    'home setup', 'house setup', 'space setup', 'area setup', 'room setup',
    'improve organization', 'enhance organization', 'streamline organization',
    'create organized space', 'maintain organized home', 'keep home organized',
    'systematic organization', 'structured space', 'efficient organization',
    'home management', 'house management', 'space management', 'area management',
    'home maintenance', 'house maintenance', 'space maintenance', 'area maintenance',
    'cooking dinner', 'meal preparation', 'meal planning', 'recipe search',
    'grocery shopping', 'food shopping', 'restaurant reservation', 'dinner party',
    'baking project', 'cooking class', 'meal prep', 'food prep', 'kitchen organization',
    'property search', 'house hunting', 'home buying', 'home selling', 'real estate search',
    'property viewing', 'open house', 'home inspection', 'property appraisal',
    'mortgage application', 'loan pre-approval', 'closing process', 'home closing',
    'family time', 'family dinner', 'family gathering', 'family vacation', 'family trip',
    'kids activities', 'children activities', 'play date', 'birthday party', 'school event',
    'themed party', 'royal banquet', 'event planning', 'party planning', 'venue selection',
    'catering service', 'event decorations', 'party decorations', 'entertainment booking',
    'guest list management', 'invitation design', 'rsvp tracking', 'photography booking',
    'event timeline', 'party agenda', 'wedding planning', 'reception planning',
    'bridal shower planning', 'baby shower planning', 'graduation party planning',
    'retirement party planning', 'corporate event planning', 'gala planning',
    'fundraiser planning', 'formal dinner planning', 'black tie event',
    'cocktail party planning', 'ceremony planning',
    'parent teacher conference', 'homework help', 'study session', 'tutoring session',
    'sports practice', 'music lesson', 'art class', 'dance class', 'swimming lesson',
    // Contextual phrases that explain tasks
    'create comfortable living space', 'maintain home value', 'ensure safety and functionality',
    'organize belongings', 'create efficient storage', 'improve home aesthetics',
    'prepare nutritious meals', 'plan balanced diet', 'ensure food safety',
    'care for family needs', 'support children development', 'create family memories',
    'maintain property condition', 'protect investment', 'ensure home security',
    'research best options', 'compare quality and price', 'make informed purchase',
    'follow proper procedures', 'use correct techniques', 'achieve desired results',
    'save time and effort', 'improve efficiency', 'enhance daily living',
    // Additional contextual phrases for home organization tasks
    'organize home efficiently', 'maintain clean home environment', 'remove clutter from home',
    'create organized home space', 'ensure home cleanliness and order', 'systematically organize home area',
    'improve home organization', 'establish organized home environment', 'maintain tidy home',
    'create efficient home layout', 'optimize home space utilization', 'enhance home functionality',
    'ensure home is well organized', 'maintain clean home appearance', 'create productive home environment',
    'organize home for better living', 'maintain clean and organized home', 'ensure home space is functional',
    'create systematic home organization', 'maintain organized and efficient home', 'ensure home meets cleanliness standards',
    // Contextual phrases for home cleaning tasks
    'thoroughly clean home', 'ensure home cleanliness', 'maintain clean living environment',
    'create clean and organized home', 'ensure all home areas are clean', 'maintain high home cleanliness standards',
    'perform comprehensive home cleaning', 'ensure thorough home cleaning', 'maintain clean and sanitary home',
    // Contextual phrases for home organization tasks
    'systematically organize home items', 'create logical home organization system', 'establish efficient home organization structure',
    'organize home items for easy access', 'create organized home storage system', 'maintain organized home structure',
    'ensure home items are properly organized', 'create systematic home organization', 'maintain consistent home organization',
    // Contextual phrases for cooking/meal tasks
    'prepare meals efficiently', 'create nutritious meal plan', 'ensure meal quality and safety',
    'organize kitchen for cooking', 'maintain clean cooking environment', 'create efficient meal preparation',
    'ensure ingredients are fresh', 'follow recipe instructions carefully', 'create delicious and healthy meals',
    // Social media and online contextual phrases (home/personal)
    'manage social media accounts', 'create engaging online content', 'schedule social media posts',
    'engage with online community', 'monitor online activity', 'maintain online privacy',
    'backup online data', 'secure online accounts', 'optimize online presence',
    // Mobile device contextual phrases (home/personal)
    'setup mobile device', 'configure device settings', 'troubleshoot device issues',
    'backup mobile data', 'sync devices', 'optimize device performance',
    'secure mobile device', 'manage device storage', 'update device software',
    // Medical and health contextual phrases (home/personal)
    'schedule medical appointment', 'prepare for health checkup', 'manage medication schedule',
    'track health metrics', 'maintain wellness routine', 'coordinate healthcare services',
    'follow treatment plan', 'maintain health records', 'ensure medication compliance',
    // Automobile contextual phrases (home/personal) - ENHANCED with research and purchase
    'schedule vehicle maintenance', 'perform routine car service', 'coordinate vehicle repairs',
    'manage vehicle registration', 'renew vehicle insurance', 'complete vehicle inspection',
    'plan road trip', 'prepare vehicle for travel', 'ensure safe driving conditions',
    'maintain vehicle performance', 'optimize fuel efficiency', 'track vehicle maintenance history',
    // Research and purchase contextual phrases - ENHANCED
    'research best options', 'compare quality and price', 'make informed purchase decision',
    'evaluate different options', 'analyze features and specifications', 'review customer feedback',
    'compare prices and deals', 'find best value', 'research within budget range',
    'explore available options', 'investigate product quality', 'assess value and worth',
    'study product reviews', 'examine specifications', 'compare features and benefits',
    'research best SUV', 'research best car', 'find best vehicle', 'compare vehicle options',
    'research vehicles within price range', 'compare SUV and car options', 'evaluate vehicle features',
    'research best options for purchase', 'compare quality and price for vehicles', 'make informed vehicle purchase',
    'research best SUV or car', 'find best vehicle within budget', 'compare vehicle models and prices',
    'evaluate vehicle reliability and safety', 'analyze vehicle performance and efficiency',
    'research vehicle features and specifications', 'compare vehicle options and deals',
    'find best vehicle for needs', 'research vehicle within price range', 'compare vehicle quality and value',
    'make informed vehicle purchase decision', 'research and compare vehicle options', 'evaluate vehicle purchase options',
    // Vehicle-specific research phrases
    'conduct research on vehicles', 'research best SUV or car options', 'find best vehicle within budget range',
    'compare SUV and car features', 'evaluate vehicle specifications', 'analyze vehicle options',
    'research vehicle reliability', 'compare vehicle safety ratings', 'evaluate vehicle performance',
    'research vehicle fuel economy', 'compare vehicle warranties', 'analyze vehicle resale value',
    'research vehicle maintenance costs', 'compare vehicle insurance rates', 'evaluate vehicle total cost of ownership',
    'find best vehicle deals', 'research vehicle discounts', 'compare vehicle financing options',
    'research vehicle test drives', 'evaluate vehicle history reports', 'analyze vehicle inspection results',
    // Additional contextual phrases for everyday home scenarios
    'complete home task efficiently', 'execute home task systematically', 'follow home task workflow',
    'ensure home task completion', 'verify home task requirements', 'validate home task outcomes',
    'coordinate home activities', 'manage home timeline', 'track home progress',
    'resolve home task issues', 'optimize home performance', 'improve home efficiency',
    'document home process', 'review home results', 'finalize home deliverables',
    'prioritize home activities', 'allocate home resources', 'manage home dependencies',
    'ensure home quality', 'maintain home standards', 'meet home objectives',
    // Additional home contextual phrases
    'prepare meals for family', 'cook nutritious dinners', 'bake fresh desserts',
    'plan weekly meal schedule', 'organize grocery shopping list', 'manage food inventory',
    'maintain clean kitchen', 'organize pantry items', 'ensure food safety',
    'care for family members', 'support children activities', 'help with homework',
    'supervise kids playtime', 'encourage learning activities', 'celebrate achievements',
    'plan family events', 'organize birthday parties', 'coordinate holiday celebrations',
    'manage household budget', 'track home expenses', 'plan home improvements',
    'maintain property value', 'ensure home safety', 'protect family security',
    'research home products', 'compare appliance options', 'evaluate home services',
    'schedule home maintenance', 'coordinate repairs', 'manage home contractors',
    'organize home documents', 'manage home records', 'maintain home files',
    'plan home renovations', 'design home improvements', 'execute home projects',
    'decorate living spaces', 'arrange furniture', 'create comfortable environment',
    'maintain yard and garden', 'care for plants', 'manage landscaping',
    'organize storage areas', 'manage home inventory', 'declutter living spaces',
    'ensure home cleanliness', 'maintain organized home', 'create functional spaces',
    'continue search for used car', 'continue looking for vehicle', 'search for used car under 15k',
    'find used car for household', 'research used car within budget'
  ],
  verbs: [
    'clean', 'cleaning', 'organize', 'organizing', 'repair', 'maintain', 'cook', 'shop', 'decorate', 'renovate',
    'remodel', 'paint', 'install', 'assemble', 'disassemble', 'fix', 'replace',
    'upgrade', 'refurbish', 'restore', 'refinish', 'polish', 'wax', 'seal',
    'caulk', 'grout', 'tile', 'sand', 'stain', 'varnish', 'prune', 'trim',
    'mow', 'weed', 'plant', 'harvest', 'water', 'fertilize', 'mulch', 'rake',
    'find', 'finding', 'search', 'searching', 'research', 'researching', 'compare',
    'comparing', 'purchase', 'buy', 'buying', 'select', 'selecting', 'choose',
    'choosing', 'evaluate', 'evaluating', 'review', 'reviewing', 'decide', 'deciding',
    'decorate', 'decorating', 'cater', 'catering', 'entertain', 'entertaining',
    'coordinate', 'coordinating', 'book venue', 'booking venue', 'select venue', 'selecting venue',
    'plan event', 'planning event', 'organize event', 'organizing event',
    // Additional home verbs for better matching
    'arrange', 'arranging', 'systematize', 'systematizing', 'setup', 'setting up', 'set up',
    'tidy', 'tidying', 'neaten', 'neatening', 'order', 'ordering', 'structure', 'structuring',
    'streamline', 'streamlining', 'optimize', 'optimizing', 'improve', 'improving',
    'enhance', 'enhancing', 'refine', 'refining', 'polish', 'polishing', 'perfect', 'perfecting',
    'manage', 'managing', 'maintain', 'maintaining', 'keep', 'keeping', 'preserve', 'preserving',
    'handle', 'handling', 'care', 'caring', 'tend', 'tending', 'look after', 'looking after',
    'cook', 'cooking', 'bake', 'baking', 'roast', 'roasting', 'grill', 'grilling',
    'fry', 'frying', 'boil', 'boiling', 'steam', 'steaming', 'sauté', 'sautéing',
    'marinate', 'marinating', 'season', 'seasoning', 'mix', 'mixing', 'stir', 'stirring',
    'chop', 'chopping', 'slice', 'slicing', 'dice', 'dicing', 'mince', 'mincing',
    'peel', 'peeling', 'grate', 'grating', 'whisk', 'whisking', 'beat', 'beating',
    'knead', 'kneading', 'roll', 'rolling', 'spread', 'spreading', 'garnish', 'garnishing',
    'appraise', 'appraising', 'inspect', 'inspecting', 'view', 'viewing', 'tour', 'touring',
    'list', 'listing', 'show', 'showing', 'negotiate', 'negotiating', 'close', 'closing',
    'sign', 'signing', 'move', 'moving', 'pack', 'packing', 'unpack', 'unpacking',
    'nurture', 'nurturing', 'care', 'caring', 'support', 'supporting', 'guide', 'guiding',
    'teach', 'teaching', 'help', 'helping', 'assist', 'assisting', 'supervise', 'supervising',
    'monitor', 'monitoring', 'encourage', 'encouraging', 'praise', 'praising', 'discipline',
    'disciplining', 'celebrate', 'celebrating', 'play', 'playing', 'learn', 'learning',
    'study', 'studying', 'practice', 'practicing', 'rehearse', 'rehearsing', 'perform', 'performing',
    // Modern home management verbs
    'automate', 'automating', 'configure', 'configuring', 'install', 'installing', 'setup', 'setting up',
    'optimize', 'optimizing', 'upgrade', 'upgrading', 'maintain', 'maintaining', 'monitor', 'monitoring',
    'secure', 'securing', 'protect', 'protecting', 'manage', 'managing', 'organize', 'organizing',
    'declutter', 'decluttering', 'minimize', 'minimizing', 'recycle', 'recycling', 'compost', 'composting',
    'renovate', 'renovating', 'remodel', 'remodeling', 'decorate', 'decorating', 'stage', 'staging',
    'refinance', 'refinancing', 'insure', 'insuring', 'warrant', 'warranting', 'lease', 'leasing',
    'rent', 'renting', 'manage property', 'managing property', 'maintain property', 'maintaining property',
    // Additional home action verbs
    'prepare', 'preparing', 'cook', 'cooking', 'bake', 'baking', 'roast', 'roasting',
    'grill', 'grilling', 'fry', 'frying', 'boil', 'boiling', 'steam', 'steaming',
    'sauté', 'sautéing', 'marinate', 'marinating', 'season', 'seasoning', 'mix', 'mixing',
    'stir', 'stirring', 'chop', 'chopping', 'slice', 'slicing', 'dice', 'dicing',
    'mince', 'mincing', 'peel', 'peeling', 'grate', 'grating', 'whisk', 'whisking',
    'beat', 'beating', 'knead', 'kneading', 'roll', 'rolling', 'spread', 'spreading',
    'garnish', 'garnishing', 'serve', 'serving', 'plate', 'plating', 'present', 'presenting',
    'shop', 'shopping', 'purchase', 'purchasing', 'buy', 'buying', 'select', 'selecting',
    'compare', 'comparing', 'evaluate', 'evaluating', 'review', 'reviewing', 'research', 'researching',
    'appraise', 'appraising', 'inspect', 'inspecting', 'view', 'viewing', 'tour', 'touring',
    'list', 'listing', 'show', 'showing', 'negotiate', 'negotiating', 'close', 'closing',
    'sign', 'signing', 'move', 'moving', 'pack', 'packing', 'unpack', 'unpacking',
    'nurture', 'nurturing', 'care', 'caring', 'support', 'supporting', 'guide', 'guiding',
    'teach', 'teaching', 'help', 'helping', 'assist', 'assisting', 'supervise', 'supervising',
    'monitor', 'monitoring', 'encourage', 'encouraging', 'praise', 'praising', 'discipline', 'disciplining',
    'celebrate', 'celebrating', 'play', 'playing', 'learn', 'learning', 'study', 'studying',
    'practice', 'practicing', 'rehearse', 'rehearsing', 'perform', 'performing'
  ],
  nouns: [
    'groceries', 'cleaning', 'maintenance', 'repair', 'cooking', 'laundry', 'organization',
    'yard', 'garden', 'landscaping', 'plumbing', 'electrical', 'appliance', 'furniture',
    'decoration', 'renovation', 'remodeling', 'painting', 'flooring', 'roofing', 'siding',
    'windows', 'doors', 'heating', 'cooling', 'hvac', 'insurance', 'mortgage', 'utilities',
    'bills', 'taxes', 'homeowner', 'property', 'supplies', 'shopping', 'meal', 'prep',
    'room', 'closet', 'garage', 'attic', 'basement', 'exterior', 'interior', 'fixture',
    'pet', 'pets', 'cat', 'cats', 'dog', 'dogs', 'animal', 'animals', 'litter', 'litter box',
    'auto', 'automatic', 'pet care', 'pet supplies', 'pet food', 'pet accessories',
    'product', 'products', 'item', 'items', 'option', 'options', 'choice', 'choices',
    'dish', 'dishes', 'cuisine', 'food', 'beverage', 'beverages', 'drink', 'drinks',
    'ingredient', 'ingredients', 'spice', 'spices', 'herb', 'herbs', 'seasoning', 'seasonings',
    'property', 'properties', 'house', 'houses', 'home', 'homes', 'apartment', 'apartments',
    'condo', 'condos', 'condominium', 'condominiums', 'townhouse', 'townhouses',
    'listing', 'listings', 'offer', 'offers', 'contract', 'contracts', 'deed', 'deeds',
    'mortgage', 'mortgages', 'loan', 'loans', 'payment', 'payments', 'deposit', 'deposits',
    'family', 'families', 'kid', 'kids', 'child', 'children', 'parent', 'parents',
    'sibling', 'siblings', 'relative', 'relatives', 'event', 'events', 'activity', 'activities',
    'themed', 'royal', 'banquet', 'banquets', 'venue', 'venues', 'catering', 'caterer', 'caterers',
    'decorations', 'decor', 'entertainment', 'guest list', 'invitations', 'invitation', 'rsvp',
    'photography', 'photographer', 'photographers', 'videography', 'videographer', 'timeline',
    'agenda', 'wedding', 'weddings', 'reception', 'receptions', 'bridal shower', 'bridal showers',
    'baby shower', 'baby showers', 'gender reveal', 'graduation party', 'graduation parties',
    'retirement party', 'retirement parties', 'corporate event', 'corporate events', 'gala', 'galas',
    'fundraiser', 'fundraisers', 'formal dinner', 'formal dinners', 'black tie', 'cocktail party',
    'cocktail parties', 'ceremony', 'ceremonies', 'event planning', 'party planning',
    'school', 'schools', 'education', 'homework', 'lesson', 'lessons', 'class', 'classes',
    'game', 'games', 'toy', 'toys', 'sport', 'sports', 'hobby', 'hobbies',
    // Modern home management nouns
    'smart home', 'home automation', 'iot', 'smart device', 'smart thermostat', 'smart lighting',
    'smart lock', 'smart security', 'home assistant', 'voice control', 'automation',
    'energy efficiency', 'solar panel', 'renewable energy', 'sustainability', 'eco-friendly',
    'green living', 'carbon footprint', 'recycling', 'composting', 'minimalism',
    'decluttering', 'organization system', 'storage solution', 'home security', 'security system',
    'camera', 'alarm', 'surveillance', 'interior design', 'home decor', 'furniture',
    'home staging', 'renovation', 'diy project', 'home improvement', 'maintenance schedule',
    'home warranty', 'home insurance', 'property management', 'rental property', 'landlord',
    'tenant', 'home equity', 'refinance', 'home loan', 'property tax', 'hoa',
    'smart appliance', 'connected home', 'home network', 'wifi', 'home office',
    'remote workspace', 'ergonomic', 'standing desk', 'home gym', 'meal delivery',
    'grocery delivery', 'online shopping', 'subscription box', 'home services'
  ],
  pronouns: [
    'i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our', 'ours', 'ourselves',
    'you', 'your', 'yours', 'yourself', 'yourselves', 'it', 'its', 'itself'
  ],
  context: 'home',
  effortMultiplier: 0.9, // Slightly lower effort for home tasks (often more straightforward)
};

/**
 * Personal Domain Terminology
 * Keywords, phrases, and verbs commonly used in personal/self-care contexts
 */
export const PERSONAL_TERMINOLOGY: DomainTerminology = {
  keywords: [
    // Context-specific keywords (unique to personal)
    'self', 'individual', 'myself', 'personal', 'private', 'self-care', 'wellbeing',
    'exercise', 'workout', 'fitness', 'health', 'wellness', 'hobby', 'learning',
    'travel', 'family', 'friends', 'social', 'self-care', 'meditation', 'yoga',
    'reading', 'writing', 'creative', 'art', 'music', 'photography', 'cooking',
    'baking', 'crafting', 'sewing', 'knitting', 'gardening', 'sports', 'running',
    'cycling', 'swimming', 'hiking', 'camping', 'outdoor', 'adventure', 'exploration',
    'education', 'course', 'class', 'workshop', 'seminar', 'conference', 'event',
    'celebration', 'birthday', 'anniversary', 'holiday', 'vacation', 'trip',
    'therapy', 'counseling', 'coaching', 'mentoring', 'volunteering', 'charity',
    // Medical and health keywords (HIGH PRIORITY - moved from business to prevent miscategorization)
    'medical', 'health', 'healthcare', 'doctor', 'physician', 'nurse', 'patient',
    'appointment', 'appt', 'checkup', 'examination', 'diagnosis', 'treatment', 'therapy',
    'medication', 'prescription', 'pharmacy', 'hospital', 'clinic', 'emergency',
    'surgery', 'procedure', 'test', 'lab', 'laboratory', 'xray', 'mri', 'ct scan',
    'vaccination', 'immunization', 'diet', 'nutrition', 'vitamin', 'supplement',
    'mental health', 'insurance', 'health insurance', 'medical insurance', 'claim', 'coverage',
    // Medical conditions and body parts (for better matching)
    'thyroid', 'diabetes', 'blood pressure', 'cholesterol', 'heart', 'lung', 'liver',
    'kidney', 'stomach', 'intestine', 'bone', 'muscle', 'joint', 'skin', 'eye', 'ear',
    'nose', 'throat', 'dental', 'oral', 'vision', 'hearing', 'allergy', 'asthma',
    'arthritis', 'migraine', 'headache', 'pain', 'injury', 'wound', 'infection',
    // Vehicle and purchase (personal)
    'used car', 'used vehicle', 'pre-owned', 'secondhand', 'continue', 'continuing', 'resume', 'resuming',
    'personal vehicle', 'budget car', 'affordable car', 'car shopping', 'vehicle hunt'
  ],
  phrases: [
    'used car search', 'search for used car', 'car under budget', 'vehicle under budget',
    'continue search', 'continue car search', 'resume vehicle search', 'find used car',
    'continue search for used car', 'continue looking for vehicle', 'used car under 15k',
    'find used car under budget', 'research used car options', 'compare used car listings',
    'workout routine', 'personal project', 'self-care', 'skill development',
    'fitness goal', 'health checkup', 'doctor appointment', 'medical appointment',
    'appointment with doctor', 'appointment with physician', 'make appointment',
    'schedule appointment', 'book appointment', 'health examination', 'medical examination',
    'thyroid check', 'thyroid examination', 'thyroid test', 'medical checkup',
    'dental cleaning', 'dental appointment', 'dental checkup', 'eye exam', 'vision test',
    'hearing test', 'lab test', 'medical test', 'blood test', 'health screening',
    'therapy session', 'coaching session', 'learning course', 'online class',
    'book club', 'hobby project', 'creative project', 'art project', 'music practice',
    'exercise routine', 'meal planning', 'nutrition planning', 'meditation practice',
    'yoga session', 'running training', 'cycling training', 'swimming practice',
    'hiking trip', 'camping trip', 'road trip', 'vacation planning', 'travel planning',
    'family time', 'date night', 'social event', 'birthday party', 'anniversary celebration',
    'holiday celebration', 'volunteer work', 'community service', 'charity event',
    'themed party', 'royal banquet', 'event planning', 'party planning', 'venue selection',
    'catering service', 'event decorations', 'party decorations', 'entertainment booking',
    'guest list management', 'invitation design', 'rsvp tracking', 'photography booking',
    'event timeline', 'party agenda', 'wedding planning', 'reception planning',
    'bridal shower planning', 'baby shower planning', 'graduation party planning',
    'retirement party planning', 'corporate event planning', 'gala planning',
    'fundraiser planning', 'formal dinner planning', 'black tie event',
    'cocktail party planning', 'ceremony planning',
    'flight booking', 'hotel reservation', 'travel itinerary', 'vacation planning',
    'trip planning', 'travel arrangements', 'packing list', 'travel documents',
    'music composition', 'song writing', 'music production', 'recording session',
    'music rehearsal', 'band practice', 'concert performance', 'music lesson',
    'art exhibition', 'gallery opening', 'art studio', 'painting session', 'drawing class',
    'sculpture workshop', 'art creation', 'artwork display', 'art collection',
    // Contextual phrases that explain tasks
    'improve physical health', 'maintain wellness', 'achieve fitness goals',
    'enhance mental wellbeing', 'reduce stress', 'increase energy levels',
    'develop new skills', 'expand knowledge', 'pursue interests',
    'express creativity', 'create meaningful work', 'share artistic vision',
    'build relationships', 'strengthen connections', 'create lasting memories',
    'explore new places', 'experience different cultures', 'broaden horizons',
    'give back to community', 'make positive impact', 'help others',
    'practice self-care', 'prioritize wellbeing', 'maintain work-life balance',
    'follow proper form', 'prevent injury', 'maximize benefits',
    'plan ahead', 'stay organized', 'enjoy the experience',
    // Modern personal development phrases
    'mindfulness practice', 'meditation session', 'yoga class', 'pilates workout',
    'strength training', 'cardio workout', 'endurance training', 'flexibility training',
    'nutrition planning', 'meal prep', 'healthy meal planning', 'diet tracking',
    'calorie counting', 'macro tracking', 'intermittent fasting', 'nutrition coaching',
    'supplement routine', 'vitamin intake', 'protein intake', 'fitness tracking',
    'sleep optimization', 'sleep hygiene', 'stress reduction', 'anxiety management',
    'mental health support', 'therapy session', 'counseling appointment', 'self-care routine',
    'wellness practice', 'personal growth', 'self-improvement', 'goal achievement',
    'habit formation', 'routine building', 'productivity system', 'time management',
    'focus training', 'concentration practice', 'mindfulness meditation', 'journaling practice',
    'gratitude practice', 'affirmation practice', 'visualization exercise', 'manifestation practice',
    'life coaching', 'career development', 'financial planning', 'budget management',
    'savings plan', 'investment strategy', 'retirement planning', 'estate planning',
    'insurance review', 'tax planning', 'online learning', 'skill development',
    'certification program', 'professional development', 'networking event', 'mentorship program',
    'community service', 'volunteer work', 'charity event', 'philanthropy',
    // Social media and online contextual phrases (personal)
    'create engaging social media content', 'increase social media engagement', 'build personal online presence',
    'manage personal social media accounts', 'schedule social media posts', 'analyze social media performance',
    'grow social media following', 'improve online visibility', 'optimize personal social media strategy',
    'engage with online audience', 'respond to social media comments', 'monitor personal online reputation',
    'create viral content', 'leverage social media trends', 'build personal brand awareness online',
    'manage online community', 'create personal digital content', 'optimize personal website performance',
    'improve search engine ranking', 'increase website traffic', 'enhance online user experience',
    'manage personal email', 'automate personal online processes', 'secure personal online transactions',
    'backup personal online data', 'migrate personal data to cloud', 'optimize personal cloud storage',
    // Mobile device contextual phrases (personal)
    'setup personal mobile device', 'configure personal device settings', 'troubleshoot personal device issues',
    'backup personal mobile data', 'sync personal devices', 'optimize personal device performance',
    'secure personal mobile device', 'manage personal device storage', 'update personal device software',
    'organize mobile apps', 'manage device notifications', 'optimize device battery life',
    // Modern home management phrases
    'smart home setup', 'home automation system', 'smart device installation', 'iot configuration',
    'energy efficient home', 'solar panel installation', 'renewable energy setup', 'sustainable living',
    'eco-friendly home', 'green home improvement', 'carbon footprint reduction', 'recycling program',
    'composting setup', 'minimalist lifestyle', 'decluttering method', 'organization system',
    'storage solution', 'home security system', 'security camera installation', 'alarm system setup',
    'interior design project', 'home decor update', 'furniture shopping', 'home staging',
    'renovation planning', 'diy project', 'home improvement', 'maintenance schedule',
    'home warranty', 'property management', 'rental property maintenance', 'landlord tasks',
    'home equity loan', 'refinance mortgage', 'property tax payment', 'hoa meeting',
    'smart appliance setup', 'connected home network', 'wifi configuration', 'home office setup',
    'remote workspace', 'ergonomic setup', 'standing desk installation', 'home gym setup',
    'meal delivery service', 'grocery delivery', 'online shopping', 'subscription box',
    // Medical and health contextual phrases (personal)
    'schedule personal medical appointment', 'prepare for personal health checkup', 'manage personal medication schedule',
    'track personal health metrics', 'maintain personal wellness routine', 'coordinate personal healthcare services',
    'follow personal treatment plan', 'maintain personal health records', 'ensure personal medication compliance',
    'maintain fitness routine', 'follow personal nutrition plan', 'ensure proper medication dosage',
    'schedule personal health checkup', 'review personal medical test results', 'coordinate with personal healthcare providers',
    'manage personal health insurance', 'submit personal insurance claims', 'track personal medical expenses',
    // Automobile contextual phrases (personal)
    'schedule personal vehicle maintenance', 'perform routine personal car service', 'coordinate personal vehicle repairs',
    'manage personal vehicle registration', 'renew personal vehicle insurance', 'complete personal vehicle inspection',
    'plan personal road trip', 'prepare personal vehicle for travel', 'ensure safe personal driving conditions',
    'maintain personal vehicle performance', 'optimize personal fuel efficiency', 'track personal vehicle maintenance history',
    // Additional contextual phrases for everyday personal scenarios
    'complete personal task efficiently', 'execute personal task systematically', 'follow personal task workflow',
    'ensure personal task completion', 'verify personal task requirements', 'validate personal task outcomes',
    'coordinate personal activities', 'manage personal timeline', 'track personal progress',
    'resolve personal task issues', 'optimize personal performance', 'improve personal efficiency',
    'document personal process', 'review personal results', 'finalize personal deliverables',
    'prioritize personal activities', 'allocate personal resources', 'manage personal dependencies',
    'ensure personal quality', 'maintain personal standards', 'meet personal objectives',
    // Standard operating procedures contextual phrases (personal)
    'follow personal standard procedures', 'document personal process workflow', 'create personal procedure checklist',
    'review personal standard procedures', 'update personal operating guidelines', 'train on personal new procedures',
    'ensure personal procedure compliance', 'audit personal procedure adherence', 'improve personal process efficiency',
    'standardize personal work processes', 'document personal best practices', 'create personal procedure templates',
    // Additional personal contextual phrases
    'improve physical fitness', 'achieve health goals', 'maintain wellness routine',
    'develop personal skills', 'expand knowledge base', 'pursue personal interests',
    'express creative vision', 'create meaningful art', 'share artistic work',
    'build meaningful relationships', 'strengthen social connections', 'create lasting memories',
    'explore new destinations', 'experience different cultures', 'broaden personal horizons',
    'contribute to community', 'make positive impact', 'help others in need',
    'prioritize self-care', 'maintain work-life balance', 'reduce personal stress',
    'follow exercise routine', 'prevent health issues', 'maximize fitness benefits',
    'plan personal activities', 'stay personally organized', 'enjoy life experiences',
    'practice mindfulness daily', 'maintain meditation routine', 'achieve inner peace',
    'track nutrition goals', 'maintain healthy diet', 'ensure proper hydration',
    'monitor sleep patterns', 'improve sleep quality', 'establish sleep routine',
    'manage personal finances', 'plan for retirement', 'build savings account',
    'invest in future', 'plan estate distribution', 'manage insurance coverage',
    'develop career skills', 'pursue professional growth', 'achieve career goals',
    'learn new technologies', 'master new tools', 'expand skill set',
    'network with professionals', 'build industry connections', 'advance career opportunities',
    'volunteer for causes', 'support charitable organizations', 'give back to community',
    'plan personal travel', 'organize vacation itinerary', 'prepare for trips',
    'create personal art', 'develop creative projects', 'share artistic creations',
    'practice musical instruments', 'compose original music', 'perform musical pieces',
    'maintain personal health', 'schedule medical checkups', 'manage medication schedule',
    'coordinate healthcare services', 'track health metrics', 'follow treatment plans',
    'research personal purchases', 'compare product options', 'make informed decisions',
    'maintain personal vehicle', 'schedule car service', 'manage vehicle registration',
    'organize personal space', 'declutter belongings', 'create organized environment',
    'manage personal time', 'prioritize activities', 'balance personal commitments',
    'continue searching for used car', 'continue car search', 'search for used car under budget',
    'find used car within budget', 'research used car within price range'
  ],
  verbs: [
    'exercise', 'workout', 'train', 'practice', 'learn', 'study', 'read', 'write',
    'create', 'make', 'build', 'craft', 'paint', 'draw', 'sketch', 'design',
    'play', 'perform', 'practice', 'rehearse', 'cook', 'bake', 'prepare',
    'travel', 'explore', 'visit', 'discover', 'experience', 'enjoy', 'relax',
    'meditate', 'reflect', 'journal', 'plan', 'organize', 'schedule', 'coordinate',
    'socialize', 'connect', 'meet', 'celebrate', 'volunteer', 'help', 'support',
    'decorate', 'decorating', 'cater', 'catering', 'entertain', 'entertaining',
    'book venue', 'booking venue', 'select venue', 'selecting venue',
    'plan event', 'planning event', 'organize event', 'organizing event',
    'book', 'booking', 'reserve', 'reserving', 'plan', 'planning', 'pack', 'packing',
    'unpack', 'unpacking', 'fly', 'flying', 'drive', 'driving', 'navigate', 'navigating',
    'tour', 'touring', 'sightsee', 'sightseeing', 'photograph', 'photographing',
    'compose', 'composing', 'arrange', 'arranging', 'record', 'recording', 'mix', 'mixing',
    'master', 'mastering', 'produce', 'producing', 'release', 'releasing', 'publish', 'publishing',
    'exhibit', 'exhibiting', 'display', 'displaying', 'showcase', 'showcasing', 'curate', 'curating',
    // Modern personal development verbs
    'meditate', 'meditating', 'practice mindfulness', 'practicing mindfulness', 'yoga', 'pilates',
    'stretch', 'stretching', 'strengthen', 'strengthening', 'cardio', 'endurance training',
    'track nutrition', 'tracking nutrition', 'meal prep', 'meal prepping', 'count calories', 'counting calories',
    'track macros', 'tracking macros', 'fast', 'fasting', 'supplement', 'supplementing',
    'track fitness', 'tracking fitness', 'monitor sleep', 'monitoring sleep', 'manage stress', 'managing stress',
    'journal', 'journaling', 'practice gratitude', 'practicing gratitude', 'affirm', 'affirming',
    'visualize', 'visualizing', 'manifest', 'manifesting', 'coach', 'coaching',
    'plan finances', 'planning finances', 'budget', 'budgeting', 'save', 'saving', 'invest', 'investing',
    'learn online', 'learning online', 'develop skills', 'developing skills', 'certify', 'certifying',
    'network', 'networking', 'mentor', 'mentoring', 'volunteer', 'volunteering', 'donate', 'donating',
    // Additional personal action verbs
    'practice', 'practicing', 'train', 'training', 'exercise', 'exercising', 'workout', 'working out',
    'meditate', 'meditating', 'reflect', 'reflecting', 'journal', 'journaling', 'plan', 'planning',
    'organize', 'organizing', 'schedule', 'scheduling', 'coordinate', 'coordinating',
    'socialize', 'socializing', 'connect', 'connecting', 'meet', 'meeting', 'celebrate', 'celebrating',
    'volunteer', 'volunteering', 'help', 'helping', 'support', 'supporting',
    'travel', 'traveling', 'explore', 'exploring', 'visit', 'visiting', 'discover', 'discovering',
    'experience', 'experiencing', 'enjoy', 'enjoying', 'relax', 'relaxing',
    'create', 'creating', 'make', 'making', 'build', 'building', 'craft', 'crafting',
    'paint', 'painting', 'draw', 'drawing', 'sketch', 'sketching', 'design', 'designing',
    'play', 'playing', 'perform', 'performing', 'rehearse', 'rehearsing',
    'compose', 'composing', 'arrange', 'arranging', 'record', 'recording', 'mix', 'mixing',
    'master', 'mastering', 'produce', 'producing', 'release', 'releasing', 'publish', 'publishing',
    'exhibit', 'exhibiting', 'display', 'displaying', 'showcase', 'showcasing', 'curate', 'curating',
    'book', 'booking', 'reserve', 'reserving', 'pack', 'packing', 'unpack', 'unpacking',
    'fly', 'flying', 'drive', 'driving', 'navigate', 'navigating', 'tour', 'touring',
    'sightsee', 'sightseeing', 'photograph', 'photographing'
  ],
  nouns: [
    'exercise', 'workout', 'fitness', 'health', 'wellness', 'hobby', 'learning',
    'travel', 'family', 'friends', 'social', 'self-care', 'meditation', 'yoga',
    'reading', 'writing', 'creative', 'art', 'music', 'photography', 'cooking',
    'baking', 'crafting', 'sewing', 'knitting', 'gardening', 'sports', 'running',
    'cycling', 'swimming', 'hiking', 'camping', 'outdoor', 'adventure', 'exploration',
    'education', 'course', 'class', 'workshop', 'seminar', 'conference', 'event',
    'celebration', 'birthday', 'anniversary', 'holiday', 'vacation', 'trip',
    'themed', 'royal', 'banquet', 'banquets', 'venue', 'venues', 'catering', 'caterer', 'caterers',
    'decorations', 'decor', 'entertainment', 'guest list', 'invitations', 'invitation', 'rsvp',
    'photography', 'photographer', 'photographers', 'videography', 'videographer', 'timeline',
    'agenda', 'wedding', 'weddings', 'reception', 'receptions', 'bridal shower', 'bridal showers',
    'baby shower', 'baby showers', 'gender reveal', 'graduation party', 'graduation parties',
    'retirement party', 'retirement parties', 'corporate event', 'corporate events', 'gala', 'galas',
    'fundraiser', 'fundraisers', 'formal dinner', 'formal dinners', 'black tie', 'cocktail party',
    'cocktail parties', 'ceremony', 'ceremonies', 'event planning', 'party planning',
    'therapy', 'counseling', 'coaching', 'mentoring', 'volunteering', 'charity',
    // Modern personal development keywords
    'mindfulness', 'meditation', 'yoga', 'pilates', 'stretching', 'flexibility',
    'strength training', 'cardio', 'cardiovascular', 'endurance', 'stamina',
    'nutrition', 'meal prep', 'healthy eating', 'diet plan', 'calorie tracking',
    'macro tracking', 'intermittent fasting', 'keto', 'paleo', 'vegan', 'vegetarian',
    'supplement', 'vitamin', 'protein', 'fitness tracker', 'wearable', 'health app',
    'sleep tracking', 'sleep hygiene', 'stress management', 'anxiety', 'depression',
    'mental health', 'therapy', 'counseling', 'self-care', 'wellness', 'wellbeing',
    'personal growth', 'self-improvement', 'goal setting', 'habits', 'routine',
    'productivity', 'time management', 'focus', 'concentration', 'mindfulness practice',
    'journaling', 'gratitude', 'affirmation', 'visualization', 'manifestation',
    'life coaching', 'career coaching', 'financial planning', 'budgeting', 'saving',
    'investment', 'retirement planning', 'estate planning', 'insurance', 'tax planning',
    'online course', 'e-learning', 'skill development', 'certification', 'professional development',
    'networking', 'mentorship', 'community', 'volunteer work', 'charity', 'philanthropy',
    // Research and purchase keywords - ENHANCED for personal
    'research', 'researching', 'find', 'finding', 'search', 'searching', 'compare', 'comparing',
    'evaluate', 'evaluating', 'review', 'reviewing', 'analyze', 'analyzing', 'study', 'studying',
    'investigate', 'investigating', 'explore', 'exploring', 'examine', 'examining', 'assess', 'assessing',
    'purchase', 'buy', 'buying', 'shop', 'shopping', 'select', 'selecting', 'choose', 'choosing',
    'decide', 'deciding', 'determine', 'determining', 'pick', 'picking', 'opt', 'opting',
    'best', 'top', 'quality', 'price', 'budget', 'affordable', 'cost', 'value', 'worth', 'deal', 'discount', 'sale',
    'within', 'under', 'over', 'below', 'above', 'up to', 'less than', 'more than', 'range', 'between',
    '10k', '15k', '20k', '25k', '30k', '10k-15k', '15k-20k', '20k-25k', 'price range', 'budget range',
    'features', 'specifications', 'specs', 'options', 'models', 'brands', 'makes', 'manufacturers',
    'reliability', 'safety', 'performance', 'efficiency', 'comfort', 'space', 'cargo', 'seating',
    'test drive', 'inspection', 'history', 'report', 'vin', 'carfax', 'autocheck',
    // Vehicle/automobile keywords for personal
    'car', 'automobile', 'vehicle', 'truck', 'suv', 'sedan', 'coupe', 'convertible', 'motorcycle', 'bike', 'bicycle',
    'maintenance', 'service', 'oil change', 'tire', 'brake', 'engine', 'battery', 'transmission', 'alternator', 'radiator',
    'repair', 'fix', 'inspection', 'registration', 'insurance', 'dmv', 'license', 'title', 'emissions', 'safety',
    'gas', 'fuel', 'electric', 'hybrid', 'charging', 'station', 'parking', 'driving', 'road trip', 'commute', 'traffic',
    'navigation', 'gps', 'map', 'mileage', 'mpg', 'fuel economy', 'warranty', 'dealer', 'dealership', 'private seller',
    'music', 'song', 'songs', 'album', 'albums', 'track', 'tracks', 'playlist', 'playlists',
    'artist', 'artists', 'musician', 'musicians', 'band', 'bands', 'concert', 'concerts',
    'performance', 'performances', 'recital', 'recitals', 'symphony', 'orchestra', 'choir',
    'instrument', 'instruments', 'piano', 'guitar', 'violin', 'drums', 'voice', 'singing',
    'art', 'arts', 'painting', 'paintings', 'drawing', 'drawings', 'sculpture', 'sculptures',
    'gallery', 'galleries', 'museum', 'museums', 'exhibition', 'exhibitions', 'artwork',
    'painter', 'painters', 'sculptor', 'sculptors', 'designer', 'designers',
    'travel', 'trip', 'journey', 'voyage', 'excursion', 'adventure', 'expedition',
    'destination', 'itinerary', 'booking', 'reservation', 'flight', 'hotel', 'accommodation',
    'luggage', 'suitcase', 'passport', 'visa', 'ticket', 'boarding', 'departure', 'arrival',
    // Modern personal development nouns
    'mindfulness', 'meditation', 'yoga', 'pilates', 'stretching', 'flexibility',
    'strength training', 'cardio', 'endurance', 'stamina', 'nutrition', 'meal prep',
    'healthy eating', 'diet plan', 'calorie tracking', 'macro tracking', 'intermittent fasting',
    'keto', 'paleo', 'vegan', 'vegetarian', 'supplement', 'vitamin', 'protein',
    'fitness tracker', 'wearable', 'health app', 'sleep tracking', 'sleep hygiene',
    'stress management', 'anxiety', 'depression', 'mental health', 'therapy',
    'counseling', 'self-care', 'wellness', 'wellbeing', 'personal growth',
    'self-improvement', 'goal setting', 'habits', 'routine', 'productivity',
    'time management', 'focus', 'concentration', 'journaling', 'gratitude',
    'affirmation', 'visualization', 'manifestation', 'life coaching', 'career coaching',
    'financial planning', 'budgeting', 'saving', 'investment', 'retirement planning',
    'estate planning', 'insurance', 'tax planning', 'online course', 'e-learning',
    'skill development', 'certification', 'professional development', 'networking',
    'mentorship', 'community', 'volunteer work', 'charity', 'philanthropy'
  ],
  pronouns: [
    'i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our', 'ours', 'ourselves',
    'you', 'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself',
    'she', 'her', 'hers', 'herself', 'they', 'them', 'their', 'theirs', 'themselves'
  ],
  context: 'personal',
  effortMultiplier: 0.85, // Personal tasks often have more flexibility
};

/**
 * World/Global Domain Terminology
 * Keywords, phrases, and verbs commonly used in global/international contexts
 */
export const WORLD_TERMINOLOGY: DomainTerminology = {
  keywords: [
    // Context-specific keywords (unique to world)
    'international', 'global', 'overseas', 'abroad', 'foreign', 'cross-border',
    'travel', 'trip', 'journey', 'voyage', 'expedition', 'culture', 'cultural',
    'language', 'translation', 'international', 'global', 'worldwide', 'overseas',
    'abroad', 'foreign', 'immigration', 'visa', 'passport', 'customs', 'border',
    'timezone', 'time zone', 'currency', 'exchange', 'conversion', 'exchange rate',
    'international call', 'video call', 'conference call', 'remote meeting',
    'cross-cultural', 'multicultural', 'diversity', 'inclusion', 'globalization',
    'international business', 'global market', 'world news', 'current events',
    'geography', 'country', 'nation', 'continent', 'region', 'climate', 'weather',
    'time difference', 'jet lag', 'accommodation', 'hotel', 'reservation', 'booking',
    'flight', 'airline', 'airport', 'departure', 'arrival', 'boarding', 'luggage', 'suitcase',
    'passport', 'visa', 'customs', 'immigration', 'border', 'security', 'check-in', 'check-out',
    'itinerary', 'destination', 'sightseeing', 'tour', 'touring', 'excursion', 'adventure',
    'vacation', 'holiday', 'trip', 'journey', 'voyage', 'expedition', 'cruise', 'cruising',
    'airline', 'airlines', 'airport', 'airports', 'terminal', 'terminals', 'gate', 'gates',
    'boarding pass', 'ticket', 'tickets', 'seat', 'seats', 'cabin', 'cabins',
    'hotel', 'hotels', 'resort', 'resorts', 'hostel', 'hostels', 'airbnb', 'lodging',
    'restaurant', 'restaurants', 'cafe', 'cafes', 'cuisine', 'cuisines', 'local food',
    'attraction', 'attractions', 'landmark', 'landmarks', 'monument', 'monuments',
    'museum', 'museums', 'gallery', 'galleries', 'beach', 'beaches', 'mountain', 'mountains'
  ],
  phrases: [
    'search for accommodation', 'research destinations', 'compare travel options',
    'find best flight', 'continue travel planning', 'resume trip planning',
    'travel planning', 'cultural event', 'international call', 'time zone conversion',
    'passport renewal', 'visa application', 'travel insurance', 'flight booking',
    'hotel reservation', 'car rental', 'travel itinerary', 'sightseeing', 'tour',
    'cultural exchange', 'language learning', 'translation work', 'international project',
    'global team', 'remote collaboration', 'cross-border', 'international shipping',
    'currency exchange', 'foreign exchange', 'exchange rate', 'international payment',
    'world news', 'current events', 'global trends', 'international relations',
    'climate change', 'environmental', 'sustainability', 'global warming',
    'flight booking', 'hotel reservation', 'travel planning', 'vacation planning',
    'trip planning', 'travel arrangements', 'packing list', 'travel documents',
    'airport check-in', 'boarding pass', 'luggage check', 'customs clearance',
    'sightseeing tour', 'city tour', 'guided tour', 'adventure tour', 'cruise vacation',
    'beach vacation', 'mountain trip', 'cultural tour', 'food tour', 'wine tour',
    // Contextual phrases that explain tasks
    'navigate different time zones', 'coordinate across borders', 'bridge cultural differences',
    'ensure travel compliance', 'prepare for international travel', 'adapt to local customs',
    'manage currency conversion', 'handle international logistics', 'coordinate global schedules',
    'respect cultural norms', 'communicate effectively', 'overcome language barriers',
    'ensure travel safety', 'protect personal information', 'maintain security',
    'plan for contingencies', 'stay flexible', 'enjoy cultural immersion',
    'make informed decisions', 'research destinations', 'compare options',
    'follow travel regulations', 'complete required documentation', 'meet entry requirements',
    // Modern world/global phrases
    'globalization impact', 'international relations', 'cultural diversity', 'multicultural exchange',
    'sustainability initiative', 'climate action', 'global warming', 'environmental protection',
    'carbon neutral goal', 'renewable energy transition', 'green energy', 'eco-friendly practices',
    'human rights advocacy', 'social justice', 'equality movement', 'diversity inclusion',
    'geopolitical analysis', 'international law', 'diplomatic relations', 'treaty negotiation',
    'world economy', 'global market', 'international trade', 'export import',
    'global health initiative', 'pandemic response', 'vaccination program', 'public health',
    'world news update', 'current events', 'breaking news', 'international news',
    'travel advisory check', 'visa application', 'entry requirement', 'travel documentation',
    'international flight booking', 'global shipping', 'cross-border transaction',
    'international payment', 'currency exchange', 'foreign exchange', 'exchange rate',
    'time zone conversion', 'world clock', 'international time', 'global time',
    'cultural exchange program', 'language barrier', 'translation service', 'interpreter service',
    'international conference', 'global summit', 'world forum', 'international event',
    'global citizenship', 'world peace', 'international cooperation', 'global partnership',
    'sustainable development', 'global goals', 'international aid', 'humanitarian effort',
    'climate summit', 'environmental conference', 'global initiative', 'worldwide campaign'
  ],
  verbs: [
    'travel', 'explore', 'discover', 'visit', 'tour', 'sightsee', 'experience',
    'immerse', 'adapt', 'adjust', 'acclimate', 'navigate', 'orient', 'locate',
    'translate', 'interpret', 'communicate', 'connect', 'network', 'collaborate',
    'coordinate', 'synchronize', 'schedule', 'plan', 'book', 'reserve', 'confirm',
    'cancel', 'modify', 'update', 'track', 'monitor', 'manage', 'organize',
    'fly', 'flying', 'drive', 'driving', 'sail', 'sailing', 'cruise', 'cruising',
    'pack', 'packing', 'unpack', 'unpacking', 'check-in', 'check-out', 'board', 'boarding',
    'depart', 'departing', 'arrive', 'arriving', 'land', 'landing', 'takeoff', 'taking off',
    'photograph', 'photographing', 'sightsee', 'sightseeing', 'explore', 'exploring',
    // Modern world/global verbs
    'globalize', 'globalizing', 'internationalize', 'internationalizing', 'diversify', 'diversifying',
    'sustain', 'sustaining', 'protect environment', 'protecting environment', 'reduce carbon', 'reducing carbon',
    'advocate', 'advocating', 'promote equality', 'promoting equality', 'foster diversity', 'fostering diversity',
    'analyze geopolitics', 'analyzing geopolitics', 'negotiate treaty', 'negotiating treaty', 'diplomacy', 'diplomacy',
    'trade internationally', 'trading internationally', 'export', 'exporting', 'import', 'importing',
    'respond to pandemic', 'responding to pandemic', 'vaccinate', 'vaccinating', 'protect public health', 'protecting public health',
    'report world news', 'reporting world news', 'cover current events', 'covering current events',
    'check travel advisory', 'checking travel advisory', 'apply for visa', 'applying for visa',
    'book international flight', 'booking international flight', 'ship globally', 'shipping globally',
    'process international payment', 'processing international payment', 'exchange currency', 'exchanging currency',
    'convert time zone', 'converting time zone', 'translate', 'translating', 'interpret', 'interpreting',
    'attend international conference', 'attending international conference', 'participate globally', 'participating globally',
    'cooperate internationally', 'cooperating internationally', 'partner globally', 'partnering globally',
    // Additional world action verbs
    'immerse', 'immersing', 'adapt', 'adapting', 'adjust', 'adjusting', 'acclimate', 'acclimating',
    'orient', 'orienting', 'locate', 'locating', 'translate', 'translating', 'interpret', 'interpreting',
    'synchronize', 'synchronizing', 'confirm', 'confirming', 'cancel', 'canceling', 'modify', 'modifying',
    'sail', 'sailing', 'check-in', 'checking-in', 'check-out', 'checking-out', 'board', 'boarding',
    'depart', 'departing', 'arrive', 'arriving', 'land', 'landing', 'takeoff', 'taking off'
  ],
  nouns: [
    'travel', 'trip', 'journey', 'voyage', 'expedition', 'culture', 'language',
    'translation', 'international', 'global', 'worldwide', 'overseas', 'abroad',
    'foreign', 'immigration', 'visa', 'passport', 'customs', 'border', 'timezone',
    'time zone', 'currency', 'exchange', 'conversion', 'exchange rate', 'call',
    'video call', 'conference call', 'remote meeting', 'cross-cultural', 'multicultural',
    'diversity', 'inclusion', 'globalization', 'international business', 'global market',
    'world news', 'current events', 'geography', 'country', 'nation', 'continent',
    'region', 'climate', 'weather', 'time difference', 'jet lag', 'accommodation',
    'hotel', 'reservation', 'booking', 'flight', 'itinerary', 'sightseeing', 'tour',
    'airline', 'airlines', 'airport', 'airports', 'terminal', 'terminals', 'gate', 'gates',
    'boarding pass', 'ticket', 'tickets', 'seat', 'seats', 'cabin', 'cabins',
    'hotel', 'hotels', 'resort', 'resorts', 'hostel', 'hostels', 'airbnb', 'lodging',
    'restaurant', 'restaurants', 'cafe', 'cafes', 'cuisine', 'cuisines', 'local food',
    'attraction', 'attractions', 'landmark', 'landmarks', 'monument', 'monuments',
    'museum', 'museums', 'gallery', 'galleries', 'beach', 'beaches', 'mountain', 'mountains',
    // Additional world nouns
    'immersion', 'adaptation', 'adjustment', 'acclimation', 'orientation', 'location',
    'translation', 'interpretation', 'synchronization', 'confirmation', 'cancellation', 'modification',
    'sailing', 'check-in', 'check-out', 'boarding', 'departure', 'arrival', 'landing', 'takeoff',
    'globalization', 'internationalization', 'diversification', 'sustainability', 'environmental protection',
    'carbon reduction', 'equality advocacy', 'diversity promotion', 'geopolitical analysis', 'treaty negotiation',
    'diplomacy', 'international trade', 'export', 'import', 'pandemic response', 'vaccination',
    'public health', 'world news', 'current events', 'breaking news', 'international news',
    'travel advisory', 'visa application', 'entry requirement', 'travel documentation',
    'international flight', 'global shipping', 'cross-border transaction', 'international payment',
    'currency exchange', 'foreign exchange', 'exchange rate', 'time zone conversion',
    'world clock', 'international time', 'global time', 'cultural exchange', 'language barrier',
    'translation service', 'interpreter service', 'international conference', 'global summit',
    'world forum', 'international event', 'global citizenship', 'world peace',
    'international cooperation', 'global partnership', 'sustainable development', 'global goals',
    'international aid', 'humanitarian effort', 'climate summit', 'environmental conference',
    'global initiative', 'worldwide campaign'
  ],
  pronouns: [
    'i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our', 'ours', 'ourselves',
    'you', 'your', 'yours', 'yourself', 'yourselves', 'they', 'them', 'their',
    'theirs', 'themselves', 'it', 'its', 'itself'
  ],
  context: 'world',
  effortMultiplier: 1.1, // Slightly higher effort for global tasks (complexity, time zones, etc.)
};

/**
 * All domain terminologies
 */
export const DOMAIN_TERMINOLOGIES: Record<Domain, DomainTerminology> = {
  business: BUSINESS_TERMINOLOGY,
  home: HOME_TERMINOLOGY,
  personal: PERSONAL_TERMINOLOGY,
  world: WORLD_TERMINOLOGY,
  mixed: {
    keywords: [],
    phrases: [],
    verbs: [],
    nouns: [],
    pronouns: [],
    context: 'mixed',
    effortMultiplier: 1.0,
  },
};

/**
 * Context-specific keywords that are unique to each domain (higher priority)
 */
const CONTEXT_KEYWORDS: Record<Domain, string[]> = {
  business: [
    'work', 'office', 'professional', 'corporate', 'workplace', 'colleague', 'coworker', 
    'business', 'company', 'organization', 'enterprise', 'firm',
    // Technical/programming keywords (HIGH PRIORITY for business domain - INCREASED coverage)
    'test', 'testing', 'tests', 'conduct test', 'test code', 'code test', 'codebase', 'code base', 
    'software', 'application', 'app', 'development', 'programming', 'coding', 
    'debug', 'debugging', 'bug', 'fix', 'bugfix', 'feature', 'implementation', 
    'deployment', 'release', 'version', 'update', 'patch', 'api', 'database', 
    'backend', 'frontend', 'ui', 'ux', 'interface', 'component', 'dialog', 'box', 
    'section', 'module', 'function', 'method', 'class', 'file', 'repository', 
    'repo', 'git', 'commit', 'branch', 'merge', 'pull request', 'pr', 'technical', 
    'architecture', 'design', 'specification', 'requirement', 'spec', 'task dialog',
    'dialog box', 'task code', 'code base', 'base for', 'for the task',
    // Presentation / content keywords
    'slide', 'deck', 'slides', 'presentation deck', 'slide deck',
    // Product/Project Management keywords
    'prd', 'product requirements document', 'product requirement', 'requirements document',
    're-occurring', 'recurring', 'recurring issue', 'recurring task', 'recurring problem',
    'recurrence', 'recurrence issue', 'recurrence problem', 'recurring bug',
    'issue', 'issues', 'problem', 'problems', 'bug', 'bugs', 'error', 'errors',
    'fix issue', 'fix problem', 'resolve issue', 'resolve problem', 'troubleshoot issue'
  ],
  home: ['household', 'residential', 'domestic', 'homeowner', 'home', 'house', 'residence'],
  personal: [
    'self', 'individual', 'myself', 'personal', 'private', 'self-care', 'wellbeing',
    // Medical/health context keywords (HIGH PRIORITY)
    'doctor', 'physician', 'medical', 'health', 'appointment', 'appt', 'checkup', 'healthcare'
  ],
  world: ['international', 'global', 'overseas', 'abroad', 'foreign', 'cross-border'],
  mixed: [],
};

/**
 * Negative keywords that exclude certain domains when present
 */
const NEGATIVE_KEYWORDS: Record<Domain, string[]> = {
  business: [
    'family dinner', 'home cooking', 'personal time', 'vacation', 'holiday',
    // Medical/health terms - these should NOT be categorized as business
    'doctor appointment', 'medical appointment', 'health checkup', 'thyroid check',
    'doctor visit', 'physician appointment', 'medical checkup', 'health examination',
    'medical test', 'health test', 'lab test', 'medical procedure', 'surgery',
    'prescription', 'medication', 'pharmacy', 'hospital visit', 'clinic visit',
    'dental appointment', 'dental checkup', 'eye exam', 'vision test', 'hearing test'
  ],
  home: [
    'work meeting', 'office', 'business', 'professional', 'corporate',
    // Technical/programming terms - these should NOT be categorized as home
    'test', 'testing', 'code', 'codebase', 'code base', 'software', 'application', 'app',
    'development', 'programming', 'coding', 'debug', 'debugging', 'bug', 'fix', 'bugfix',
    'feature', 'implementation', 'deployment', 'release', 'version', 'update', 'patch',
    'api', 'database', 'backend', 'frontend', 'ui', 'ux', 'interface', 'component',
    'dialog', 'box', 'section', 'module', 'function', 'method', 'class', 'file',
    'repository', 'repo', 'git', 'commit', 'branch', 'merge', 'pull request', 'pr',
    'technical', 'architecture', 'design', 'specification', 'requirement', 'spec'
  ],
  personal: ['work', 'office', 'business', 'corporate', 'professional'],
  world: [
    // Technical/programming terms - these should NOT be categorized as world
    'test', 'testing', 'code', 'codebase', 'code base', 'software', 'application', 'app',
    'development', 'programming', 'coding', 'debug', 'debugging', 'bug', 'fix', 'bugfix',
    'feature', 'implementation', 'deployment', 'release', 'version', 'update', 'patch',
    'api', 'database', 'backend', 'frontend', 'ui', 'ux', 'interface', 'component',
    'dialog', 'box', 'section', 'module', 'function', 'method', 'class', 'file',
    'repository', 'repo', 'git', 'commit', 'branch', 'merge', 'pull request', 'pr',
    'technical', 'architecture', 'design', 'specification', 'requirement', 'spec',
    // Workout/fitness terms - these should NOT be categorized as world
    'workout', 'fitness', 'exercise', 'gym', 'training', 'cardio', 'strength'
  ],
  mixed: [],
};

/**
 * Calculate context bonus for keywords that appear near each other
 */
function calculateContextBonus(
  text: string,
  words: string[],
  proximity: number = DOMAIN_DETECTION_THRESHOLDS.CONTEXT_PROXIMITY
): number {
  const textWords = text.toLowerCase().split(/\s+/);
  let bonus = 0;
  
  for (let i = 0; i < words.length; i++) {
    const word1 = words[i].toLowerCase();
    const index1 = textWords.findIndex(w => w.includes(word1) || word1.includes(w));
    
    if (index1 === -1) continue;
    
    for (let j = i + 1; j < words.length; j++) {
      const word2 = words[j].toLowerCase();
      const index2 = textWords.findIndex(w => w.includes(word2) || word2.includes(w));
      
      if (index2 === -1) continue;
      
      const distance = Math.abs(index1 - index2);
      if (distance <= proximity) {
        bonus += DOMAIN_DETECTION_THRESHOLDS.CONTEXT_BONUS;
      }
    }
  }
  
  return bonus;
}

/**
 * Helper function for fuzzy word matching in domain detection
 * Uses similarity scoring to match words even with variations
 */
function calculateWordSimilarity(word1: string, word2: string): number {
  const w1 = word1.toLowerCase();
  const w2 = word2.toLowerCase();
  if (w1 === w2) return DESCRIPTION_GENERATION_CONFIG.wordSimilarity.exactMatch;
  if (w1.includes(w2) || w2.includes(w1)) return DESCRIPTION_GENERATION_CONFIG.wordSimilarity.substringMatch;
  
  // Check for common prefixes/suffixes
  const minLen = Math.min(w1.length, w2.length);
  let commonChars = 0;
  for (let i = 0; i < minLen; i++) {
    if (w1[i] === w2[i]) commonChars++;
  }
  const prefixSimilarity = commonChars / Math.max(w1.length, w2.length);
  
  // Check for stem similarity (remove common suffixes)
  const stem1 = w1.replace(/(ing|ed|s|es|er|est|ly)$/, '');
  const stem2 = w2.replace(/(ing|ed|s|es|er|est|ly)$/, '');
  const stemMatch = stem1 === stem2 
    ? DESCRIPTION_GENERATION_CONFIG.wordSimilarity.exactStemMatch 
    : (stem1.includes(stem2) || stem2.includes(stem1) 
      ? DESCRIPTION_GENERATION_CONFIG.wordSimilarity.partialStemMatch 
      : 0);
  
  return Math.max(prefixSimilarity, stemMatch);
}

/**
 * Helper function to check if words are semantically related
 */
function areWordsRelated(word1: string, word2: string): boolean {
  const similarity = calculateWordSimilarity(word1, word2);
  return similarity >= DESCRIPTION_GENERATION_CONFIG.wordSimilarity.wordRelationshipThreshold;
}

/**
 * Improved phrase matching with fuzzy word-level matching
 * Matches phrases even if words are slightly different or in different order
 */
function matchesPhraseFuzzy(text: string, phrase: string): boolean {
  const textLower = text.toLowerCase();
  const phraseLower = phrase.toLowerCase();
  
  // Exact match
  if (textLower.includes(phraseLower)) return true;
  
  // Split into words
  const textWords = textLower.split(/\s+/).filter(w => w.length >= 2);
  const phraseWords = phraseLower.split(/\s+/).filter(w => w.length >= 2);
  
  // If phrase has only one word, use word matching
  if (phraseWords.length === 1) {
    return textWords.some(tw => areWordsRelated(tw, phraseWords[0]));
  }
  
  // For multi-word phrases, check if all phrase words have matches in text
  // Allow for word order flexibility
  const matchedWords = new Set<number>();
  for (const phraseWord of phraseWords) {
    let found = false;
    for (let i = 0; i < textWords.length; i++) {
      if (matchedWords.has(i)) continue;
      if (areWordsRelated(textWords[i], phraseWord)) {
        matchedWords.add(i);
        found = true;
        break;
      }
    }
    if (!found) {
      // If a phrase word doesn't match, check if it's a very common word (like "the", "a")
      // If so, we can be more lenient
      const isCommonWord = phraseWord.length <= 2 || ['the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for'].includes(phraseWord);
      if (!isCommonWord) {
        return false; // Critical word not found
      }
    }
  }
  
  // Check if matched words are reasonably close together (within phrase length * 2)
  const matchedIndices = Array.from(matchedWords).sort((a, b) => a - b);
  if (matchedIndices.length < phraseWords.length * DESCRIPTION_GENERATION_CONFIG.wordSimilarity.phraseMatchThreshold) {
    return false; // Need at least threshold percentage of words
  }
  
  const maxDistance = phraseWords.length * 2;
  const distance = matchedIndices[matchedIndices.length - 1] - matchedIndices[0];
  return distance <= maxDistance;
}

/**
 * Detect domain from text by matching keywords, phrases, and verbs
 * Returns the domain with highest confidence score
 * IMPROVED: Now includes fuzzy matching, better phrase detection, and Browser AI integration
 * @param title - Task title
 * @param description - Task description
 * @param terminologyByDomain - Optional merged (base + shared + user) terminology per domain; when provided, domain detection uses it so local and shared terminology are included
 */
export function detectDomain(
  title: string,
  description: string,
  terminologyByDomain?: Record<Domain, DomainTerminology>
): {
  domain: Domain;
  confidence: number;
  keywords: string[];
  matchedTerms: {
    business: number;
    home: number;
    personal: number;
    world: number;
  };
} {
  const text = `${title} ${description}`.toLowerCase().trim();
  const terminologies = terminologyByDomain ?? DOMAIN_TERMINOLOGIES;
  // Normalize common abbreviations so we recognize context (e.g. "appt" → "appointment")
  const normalizedTextForMatching = text
    .replace(/\bappt\.?\b/gi, 'appointment')
    .replace(/\bdr\.?\b/gi, 'doctor')
    .replace(/\bphys\.?\b/gi, 'physician');
  const textWords = text.split(/\s+/).filter(w => w.length >= 2);
  const normalizedTextWords = normalizedTextForMatching.split(/\s+/).filter(w => w.length >= 2);

  logger.debug(`🔍 Domain Detection: Analyzing text="${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`, {
    titleLength: title.length,
    descriptionLength: description.length,
    totalLength: text.length,
    usingMergedTerminology: !!terminologyByDomain,
  });

  if (!text || text.length === 0) {
    logger.debug('⚠️ Domain Detection: Empty text, defaulting to default domain');
    return {
      domain: DEFAULT_TASK_DOMAIN,
      confidence: DOMAIN_DETECTION_THRESHOLDS.DEFAULT_CONFIDENCE,
      keywords: [],
      matchedTerms: DOMAIN_DETECTION_THRESHOLDS.DEFAULT_MATCHED_TERMS,
    };
  }

  const matchedTerms = {
    business: 0,
    home: 0,
    personal: 0,
    world: 0,
  };

  const foundKeywords: string[] = [];
  const contextKeywords: Record<Domain, string[]> = {
    business: [],
    home: [],
    personal: [],
    world: [],
    mixed: [],
  };

  // Check each domain (use merged terminology when provided so shared terms are included)
  for (const [domainKey, terminology] of Object.entries(terminologies)) {
    if (domainKey === 'mixed' || !terminology) continue;

    const domain = domainKey as Exclude<Domain, 'mixed'>;

    // IMPROVED: Check for negative keywords with fuzzy matching and abbreviation handling
    const negativeKeywords = NEGATIVE_KEYWORDS[domain];
    let hasNegativeKeyword = false;
    for (const negativeKw of negativeKeywords) {
      // Normalize text for better matching (handle abbreviations)
      const normalizedText = text
        .replace(/\bappt\b/gi, 'appointment')
        .replace(/\bdr\./gi, 'doctor')
        .replace(/\bphys\./gi, 'physician');
      
      // Try exact match first
      const exactRegex = new RegExp(negativeKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (exactRegex.test(normalizedText)) {
        logger.debug(`🚫 Domain Detection: Negative keyword "${negativeKw}" found for ${domain}, excluding domain`);
        hasNegativeKeyword = true;
        break;
      }
      // Try fuzzy phrase matching for multi-word negative keywords
      if (negativeKw.split(/\s+/).length > 1) {
        if (matchesPhraseFuzzy(normalizedText, negativeKw)) {
          logger.debug(`🚫 Domain Detection: Negative phrase "${negativeKw}" found (fuzzy) for ${domain}, excluding domain`);
          hasNegativeKeyword = true;
          break;
        }
      }
      // Also check individual words from negative keyword phrase
      const negativeWords = negativeKw.split(/\s+/);
      if (negativeWords.length > 1) {
        // Check if all significant words from negative phrase appear in text
        const significantWords = negativeWords.filter(w => w.length > 2);
        const allWordsFound = significantWords.every(word => {
          const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
          return wordRegex.test(normalizedText) || textWords.some(tw => areWordsRelated(tw, word));
        });
        if (allWordsFound && significantWords.length >= 2) {
          logger.debug(`🚫 Domain Detection: Negative phrase words "${negativeKw}" found for ${domain}, excluding domain`);
          hasNegativeKeyword = true;
          break;
        }
      }
    }
    if (hasNegativeKeyword) continue;

    // IMPROVED: Check context-specific keywords with fuzzy matching (use normalized text so "appt" matches "appointment")
    const contextKws = CONTEXT_KEYWORDS[domain];
    for (const keyword of contextKws) {
      const exactRegex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (exactRegex.test(normalizedTextForMatching)) {
        const weight = DOMAIN_SCORING_WEIGHTS.CONTEXT_KEYWORD;
        matchedTerms[domain] += weight;
        contextKeywords[domain].push(keyword);
        if (!foundKeywords.includes(keyword)) {
          foundKeywords.push(keyword);
        }
        logger.debug(`✅ Domain Detection: Context keyword "${keyword}" matched for ${domain} (+${weight} points)`);
      } else {
        const fuzzyMatch = normalizedTextWords.some(tw => areWordsRelated(tw, keyword));
        if (fuzzyMatch) {
          const weight = DOMAIN_SCORING_WEIGHTS.CONTEXT_KEYWORD * DOMAIN_SCORING_WEIGHTS.FUZZY_CONTEXT_KEYWORD_MULTIPLIER;
          matchedTerms[domain] += weight;
          contextKeywords[domain].push(keyword);
          if (!foundKeywords.includes(keyword)) {
            foundKeywords.push(keyword);
          }
          logger.debug(`✅ Domain Detection: Context keyword "${keyword}" matched (fuzzy) for ${domain} (+${weight.toFixed(1)} points)`);
        }
      }
    }

    // IMPROVED: Check regular keywords with fuzzy matching (use normalized text for context recognition)
    for (const keyword of terminology.keywords) {
      if (contextKeywords[domain].includes(keyword)) continue;
      const kwEscaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const exactRegex = new RegExp(keyword.split(/\s+/).length > 1 ? kwEscaped : `\\b${kwEscaped}\\b`, 'i');
      if (exactRegex.test(normalizedTextForMatching)) {
        matchedTerms[domain] += DOMAIN_SCORING_WEIGHTS.KEYWORD;
        if (!foundKeywords.includes(keyword)) {
          foundKeywords.push(keyword);
        }
      } else {
        if (keyword.split(/\s+/).length > 1) {
          if (matchesPhraseFuzzy(normalizedTextForMatching, keyword)) {
            matchedTerms[domain] += DOMAIN_SCORING_WEIGHTS.KEYWORD * DOMAIN_SCORING_WEIGHTS.FUZZY_PHRASE_MULTIPLIER;
            if (!foundKeywords.includes(keyword)) {
              foundKeywords.push(keyword);
            }
          }
        } else {
          const fuzzyMatch = normalizedTextWords.some(tw => areWordsRelated(tw, keyword));
          if (fuzzyMatch) {
            matchedTerms[domain] += DOMAIN_SCORING_WEIGHTS.KEYWORD * DOMAIN_SCORING_WEIGHTS.FUZZY_KEYWORD_MULTIPLIER;
            if (!foundKeywords.includes(keyword)) {
              foundKeywords.push(keyword);
            }
          }
        }
      }
    }

    // IMPROVED: Check phrases with fuzzy matching (use normalized text so "cancel appt" matches "cancel appointment")
    for (const phrase of terminology.phrases) {
      const exactRegex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (exactRegex.test(normalizedTextForMatching)) {
        // Check if phrase contains context keywords
        const hasContextKeyword = contextKeywords[domain].some(ck => phrase.toLowerCase().includes(ck.toLowerCase()));
        const weight = hasContextKeyword ? DOMAIN_SCORING_WEIGHTS.CONTEXT_PHRASE : DOMAIN_SCORING_WEIGHTS.PHRASE;
        matchedTerms[domain] += weight;
        if (!foundKeywords.includes(phrase)) {
          foundKeywords.push(phrase);
        }
        logger.debug(`✅ Domain Detection: Phrase "${phrase}" matched for ${domain} (+${weight} points${hasContextKeyword ? ', context-enhanced' : ''})`);
      } else {
        // Try fuzzy phrase matching
        if (matchesPhraseFuzzy(text, phrase)) {
          const hasContextKeyword = contextKeywords[domain].some(ck => phrase.toLowerCase().includes(ck.toLowerCase()));
          const weight = hasContextKeyword 
            ? DOMAIN_SCORING_WEIGHTS.CONTEXT_PHRASE * DOMAIN_SCORING_WEIGHTS.FUZZY_PHRASE_MULTIPLIER
            : DOMAIN_SCORING_WEIGHTS.PHRASE * DOMAIN_SCORING_WEIGHTS.FUZZY_PHRASE_MULTIPLIER;
          matchedTerms[domain] += weight;
          if (!foundKeywords.includes(phrase)) {
            foundKeywords.push(phrase);
          }
          logger.debug(`✅ Domain Detection: Phrase "${phrase}" matched (fuzzy) for ${domain} (+${weight.toFixed(1)} points${hasContextKeyword ? ', context-enhanced' : ''})`);
        }
      }
    }

    // IMPROVED: Check verbs with fuzzy matching and stem variations (use normalized text)
    for (const verb of terminology.verbs) {
      const exactRegex = new RegExp(`\\b${verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\w*\\b`, 'i');
      if (exactRegex.test(normalizedTextForMatching)) {
        matchedTerms[domain] += DOMAIN_SCORING_WEIGHTS.VERB;
        if (!foundKeywords.includes(verb)) {
          foundKeywords.push(verb);
        }
      } else {
        const verbBase = verb.replace(/(ing|ed|s|es|er|est|ly)$/, '');
        const fuzzyMatch = normalizedTextWords.some(tw => {
          const twBase = tw.replace(/(ing|ed|s|es|er|est|ly)$/, '');
          return areWordsRelated(tw, verb) || areWordsRelated(twBase, verbBase);
        });
        if (fuzzyMatch) {
          matchedTerms[domain] += DOMAIN_SCORING_WEIGHTS.VERB * DOMAIN_SCORING_WEIGHTS.FUZZY_VERB_MULTIPLIER;
          if (!foundKeywords.includes(verb)) {
            foundKeywords.push(verb);
          }
        }
      }
    }
    
    // Apply context bonus for keywords that appear near each other (use normalized text)
    if (contextKeywords[domain].length > 1) {
      const contextBonus = calculateContextBonus(normalizedTextForMatching, contextKeywords[domain]);
      if (contextBonus > 0) {
        matchedTerms[domain] += contextBonus;
        logger.debug(`🎯 Domain Detection: Context bonus for ${domain}: +${contextBonus.toFixed(2)} (keywords appear near each other)`);
      }
    }
    
    // CRITICAL: Additional boost for technical keywords in business domain
    // If multiple technical keywords are detected, significantly boost business domain score
    if (domain === 'business' && contextKeywords[domain].length >= DOMAIN_DETECTION_THRESHOLDS.MIN_TECHNICAL_KEYWORDS_FOR_BOOST) {
      const technicalCount = contextKeywords[domain].filter(ck => 
        DOMAIN_EXCLUSION_TERMS.TECHNICAL_KEYWORDS.some(tk => 
          ck.toLowerCase().includes(tk) || tk.includes(ck.toLowerCase())
        )
      ).length;
      if (technicalCount >= DOMAIN_DETECTION_THRESHOLDS.MIN_TECHNICAL_KEYWORDS_FOR_BOOST) {
        const technicalBoost = DOMAIN_DETECTION_THRESHOLDS.TECHNICAL_KEYWORD_BOOST * technicalCount;
        matchedTerms[domain] += technicalBoost;
        logger.debug(`🚀 Domain Detection: Technical keyword boost for business: +${technicalBoost.toFixed(2)} (${technicalCount} technical keywords detected)`);
      }
    }
  }

  // Find domain with highest score
  const scores = Object.entries(matchedTerms) as Array<[Domain, number]>;
  const maxScore = Math.max(...scores.map(([, score]) => score));
  const totalScore = scores.reduce((sum, [, score]) => sum + score, 0);

  logger.debug(`📊 Domain Detection: Scores - Business: ${matchedTerms.business}, Home: ${matchedTerms.home}, Personal: ${matchedTerms.personal}, World: ${matchedTerms.world}`, {
    scores: matchedTerms,
    maxScore,
    totalScore,
    contextKeywords,
  });

  // If no matches or very low scores, use default domain from constants
  if (maxScore === 0 || totalScore < 1) {
    logger.debug(`⚠️ Domain Detection: No matches found (maxScore=${maxScore}, totalScore=${totalScore}), defaulting to ${DEFAULT_TASK_DOMAIN}`);
    return {
      domain: DEFAULT_TASK_DOMAIN,
      confidence: DOMAIN_DETECTION_THRESHOLDS.MIN_CONFIDENCE,
      keywords: foundKeywords,
      matchedTerms,
    };
  }

  // Find the winning domain
  // CRITICAL: Ensure we always return a valid domain
  const winningDomainEntry = scores.find(([, score]) => score === maxScore);
  // Use DEFAULT_TASK_DOMAIN constant instead of hardcoded 'personal'
  const winningDomain = (winningDomainEntry?.[0] && 
    (winningDomainEntry[0] === 'business' || winningDomainEntry[0] === 'home' || 
     winningDomainEntry[0] === 'personal' || winningDomainEntry[0] === 'world' || 
     winningDomainEntry[0] === 'mixed'))
    ? winningDomainEntry[0]
    : DEFAULT_TASK_DOMAIN;

  // Calculate confidence (0-1 scale)
  // Higher confidence if one domain clearly dominates
  const confidence = totalScore > 0 ? maxScore / totalScore : DOMAIN_DETECTION_THRESHOLDS.MIN_CONFIDENCE;

  // If confidence is low (<0.5) and multiple domains have similar scores, mark as mixed
  const secondHighest = scores
    .filter(([domain]) => domain !== winningDomain)
    .sort(([, a], [, b]) => b - a)[0]?.[1] || 0;

  const finalDomain: Domain =
    confidence < DOMAIN_DETECTION_THRESHOLDS.MIXED_THRESHOLD &&
    secondHighest > maxScore * DOMAIN_DETECTION_THRESHOLDS.MIXED_SIMILARITY
      ? 'mixed'
      : (winningDomain as Domain);

  logger.debug(`🏆 Domain Detection: Final result - Domain: ${finalDomain}, Confidence: ${(confidence * 100).toFixed(1)}%`, {
    winningDomain,
    finalDomain,
    confidence,
    secondHighest,
    maxScore,
    isMixed: finalDomain === 'mixed',
    matchedKeywords: foundKeywords.slice(0, 10), // Log first 10 keywords
  });

  return {
    domain: finalDomain,
    confidence: Math.min(1.0, confidence),
    keywords: foundKeywords,
    matchedTerms,
  };
}

/**
 * Storage key for user-learned terminology
 */
const USER_TERMINOLOGY_STORAGE_KEY = 'taskzm_user_terminology';

/**
 * Interface for user-learned terminology (stored in localStorage)
 */
interface UserLearnedTerminology {
  [domain: string]: {
    keywords: string[];
    phrases: string[];
    verbs: string[];
    nouns: string[];
  };
}

/**
 * Load user-learned terminology from localStorage
 */
function loadUserTerminology(): UserLearnedTerminology {
  try {
    return getFromLocalStorage<UserLearnedTerminology>(USER_TERMINOLOGY_STORAGE_KEY, {});
  } catch (error) {
    logger.warn('Failed to load user terminology from localStorage:', error);
    return {};
  }
}

/**
 * Save user-learned terminology to localStorage
 */
function saveUserTerminology(userTerminology: UserLearnedTerminology): void {
  try {
    saveToLocalStorage(USER_TERMINOLOGY_STORAGE_KEY, userTerminology);
    logger.debug('Saved user-learned terminology to localStorage', {
      domains: Object.keys(userTerminology),
      totalKeywords: Object.values(userTerminology).reduce((sum, domain) => sum + domain.keywords.length, 0),
      totalPhrases: Object.values(userTerminology).reduce((sum, domain) => sum + domain.phrases.length, 0),
    });
  } catch (error) {
    logger.error('Failed to save user terminology to localStorage:', error);
  }
}

/**
 * Saves new keywords, phrases, verbs, and nouns to both libraries so users can access them:
 * - Local library: user terminology in localStorage (user-specific)
 * - Shared library: shared_terminology table via API (for all users)
 * @param domain - The domain to add terms to
 * @param newKeywords - New keywords to add (if not already in library)
 * @param newPhrases - New phrases to add (if not already in library)
 * @param newVerbs - New verbs to add (if not already in library)
 * @param newNouns - New nouns to add (if not already in library)
 */
export function saveNewTerminologyToLibrary(
  domain: Domain,
  newKeywords: string[] = [],
  newPhrases: string[] = [],
  newVerbs: string[] = [],
  newNouns: string[] = []
): void {
  if (domain === 'mixed') {
    // Don't save to mixed domain
    return;
  }

  // Load existing user terminology
  const userTerminology = loadUserTerminology();
  
  // Get base terminology to check against
  const baseTerminology = DOMAIN_TERMINOLOGIES[domain];
  if (!baseTerminology) {
    logger.warn(`Cannot save terminology for unknown domain: ${domain}`);
    return;
  }

  // Initialize domain if it doesn't exist
  if (!userTerminology[domain]) {
    userTerminology[domain] = {
      keywords: [],
      phrases: [],
      verbs: [],
      nouns: [],
    };
  }

  const domainTerminology = userTerminology[domain];
  let addedCount = 0;
  const addedKeywords: string[] = [];
  const addedPhrases: string[] = [];
  const addedVerbs: string[] = [];
  const addedNouns: string[] = [];

  // Add new keywords (case-insensitive check)
  newKeywords.forEach(keyword => {
    const keywordLower = keyword.toLowerCase().trim();
    if (keywordLower.length < TERMINOLOGY_CONFIG.minKeywordLength) return;
    
    // Check if keyword already exists in base terminology
    const existsInBase = baseTerminology.keywords.some(kw => kw.toLowerCase() === keywordLower);
    // Check if keyword already exists in user terminology
    const existsInUser = domainTerminology.keywords.some(kw => kw.toLowerCase() === keywordLower);
    
    if (!existsInBase && !existsInUser) {
      const trimmed = keyword.trim();
      domainTerminology.keywords.push(trimmed);
      addedKeywords.push(trimmed);
      addedCount++;
      logger.debug(`Added new keyword to ${domain} terminology: "${keyword}"`);
    }
  });

  // Add new phrases (case-insensitive check)
  newPhrases.forEach(phrase => {
    const phraseLower = phrase.toLowerCase().trim();
    if (phraseLower.length < TERMINOLOGY_CONFIG.minPhraseLength) return;
    
    // Check if phrase already exists in base terminology
    const existsInBase = baseTerminology.phrases.some(p => p.toLowerCase() === phraseLower);
    // Check if phrase already exists in user terminology
    const existsInUser = domainTerminology.phrases.some(p => p.toLowerCase() === phraseLower);
    
    if (!existsInBase && !existsInUser) {
      const trimmed = phrase.trim();
      domainTerminology.phrases.push(trimmed);
      addedPhrases.push(trimmed);
      addedCount++;
      logger.debug(`Added new phrase to ${domain} terminology: "${phrase}"`);
    }
  });

  // Add new verbs (case-insensitive check)
  newVerbs.forEach(verb => {
    const verbLower = verb.toLowerCase().trim();
    if (verbLower.length < TERMINOLOGY_CONFIG.minVerbLength) return;
    
    const existsInBase = baseTerminology.verbs.some(v => v.toLowerCase() === verbLower);
    const existsInUser = domainTerminology.verbs.some(v => v.toLowerCase() === verbLower);
    
    if (!existsInBase && !existsInUser) {
      const trimmed = verb.trim();
      domainTerminology.verbs.push(trimmed);
      addedVerbs.push(trimmed);
      addedCount++;
      logger.debug(`Added new verb to ${domain} terminology: "${verb}"`);
    }
  });

  // Add new nouns (case-insensitive check)
  newNouns.forEach(noun => {
    const nounLower = noun.toLowerCase().trim();
    if (nounLower.length < TERMINOLOGY_CONFIG.minNounLength) return;
    
    const existsInBase = baseTerminology.nouns.some(n => n.toLowerCase() === nounLower);
    const existsInUser = domainTerminology.nouns.some(n => n.toLowerCase() === nounLower);
    
    if (!existsInBase && !existsInUser) {
      const trimmed = noun.trim();
      domainTerminology.nouns.push(trimmed);
      addedNouns.push(trimmed);
      addedCount++;
      logger.debug(`Added new noun to ${domain} terminology: "${noun}"`);
    }
  });

  // Save to both libraries when any new terms were added
  if (addedCount > 0) {
    // 1. Local library: user terminology (localStorage, user-specific)
    saveUserTerminology(userTerminology);
    
    // 2. Shared library: shared_terminology table (for all users). Send only the terms we just added so both libraries stay in sync.
    saveSharedTerminologyToApi(domain, addedKeywords, addedPhrases, addedVerbs, addedNouns)
      .then(result => {
        if (result.success) {
          logger.info(`✅ Saved ${result.saved} new terms to shared ${domain} terminology (${result.skipped} skipped)`, {
            domain,
            saved: result.saved,
            skipped: result.skipped,
          });
          
          // Invalidate cache for this domain to force refresh on next fetch
          sharedTerminologyCache.delete(domain);
        } else {
          logger.warn(`⚠️ Failed to save some terms to shared terminology: ${result.skipped} skipped`);
        }
      })
      .catch(error => {
        logger.warn('Error saving to shared terminology (non-blocking):', error);
        // Non-blocking: continue even if shared save fails
      });
    
    logger.info(`✅ Saved ${addedCount} new terms to ${domain} terminology library`, {
      domain,
      keywords: newKeywords.length,
      phrases: newPhrases.length,
      verbs: newVerbs.length,
      nouns: newNouns.length,
      addedCount,
    });
  }
}


/**
 * Cache for shared terminology fetched from the database
 * Stores { terminology: { keywords, phrases, verbs, nouns }, timestamp: number }
 * Note: Shared terminology only includes keywords, phrases, verbs, nouns (not pronouns, context, effortMultiplier)
 */
const sharedTerminologyCache = new Map<Domain, { 
  terminology: { keywords: string[]; phrases: string[]; verbs: string[]; nouns: string[]; }; 
  timestamp: number 
}>();

/**
 * Get domain-specific terminology (synchronous version, uses cached shared terms)
 * Merges base terminology with user-learned terminology from localStorage and cached shared terms.
 */
export function getDomainTerminology(domain: Domain): DomainTerminology {
  const baseTerminology = DOMAIN_TERMINOLOGIES[domain] || DOMAIN_TERMINOLOGIES.personal;
  const userTerminology = loadUserTerminology();
  const userDomainTerms = userTerminology[domain];
  const cachedShared = sharedTerminologyCache.get(domain);

  // Merge base, cached shared (if available), and user-learned
  return {
    keywords: [...baseTerminology.keywords, ...(cachedShared?.terminology.keywords || []), ...(userDomainTerms?.keywords || [])],
    phrases: [...baseTerminology.phrases, ...(cachedShared?.terminology.phrases || []), ...(userDomainTerms?.phrases || [])],
    verbs: [...baseTerminology.verbs, ...(cachedShared?.terminology.verbs || []), ...(userDomainTerms?.verbs || [])],
    nouns: [...baseTerminology.nouns, ...(cachedShared?.terminology.nouns || []), ...(userDomainTerms?.nouns || [])],
    pronouns: baseTerminology.pronouns,
    context: baseTerminology.context,
    effortMultiplier: baseTerminology.effortMultiplier,
  };
}

/**
 * Get domain-specific terminology asynchronously, merging base, shared, and user-learned terms.
 * Uses caching for shared terms.
 */
export async function getDomainTerminologyAsync(domain: Domain): Promise<DomainTerminology> {
  const baseTerminology = DOMAIN_TERMINOLOGIES[domain] || DOMAIN_TERMINOLOGIES.personal;
  const userTerminology = loadUserTerminology();
  const userDomainTerms = userTerminology[domain];

  // Check cache for shared terminology
  const cached = sharedTerminologyCache.get(domain);
  if (cached && Date.now() - cached.timestamp < TERMINOLOGY_CONFIG.sharedTerminologyCacheTTL) {
    logger.debug(`Using cached shared terminology for domain: ${domain}`);
    // Merge base, cached shared, and user-learned
    return {
      keywords: [...baseTerminology.keywords, ...cached.terminology.keywords, ...(userDomainTerms?.keywords || [])],
      phrases: [...baseTerminology.phrases, ...cached.terminology.phrases, ...(userDomainTerms?.phrases || [])],
      verbs: [...baseTerminology.verbs, ...cached.terminology.verbs, ...(userDomainTerms?.verbs || [])],
      nouns: [...baseTerminology.nouns, ...cached.terminology.nouns, ...(userDomainTerms?.nouns || [])],
      pronouns: baseTerminology.pronouns,
      context: baseTerminology.context,
      effortMultiplier: baseTerminology.effortMultiplier,
    };
  }

  // Fetch shared terminology from API
  let sharedTerms: { keywords: string[]; phrases: string[]; verbs: string[]; nouns: string[]; } = {
    keywords: [], phrases: [], verbs: [], nouns: []
  };
  try {
    const response = await getSharedTerminologyFromApi(domain);
    if (response && (response.keywords.length > 0 || response.phrases.length > 0 || response.verbs.length > 0 || response.nouns.length > 0)) {
      sharedTerms = {
        keywords: response.keywords || [],
        phrases: response.phrases || [],
        verbs: response.verbs || [],
        nouns: response.nouns || []
      };
      // Update cache
      sharedTerminologyCache.set(domain, { terminology: sharedTerms, timestamp: Date.now() });
      logger.debug(`Fetched and cached shared terminology for domain: ${domain}`);
    }
  } catch (error) {
    logger.warn(`Failed to fetch shared terminology for domain ${domain}, using only local:`, error);
  }

  // Merge base, fetched shared, and user-learned
  return {
    keywords: [...baseTerminology.keywords, ...sharedTerms.keywords, ...(userDomainTerms?.keywords || [])],
    phrases: [...baseTerminology.phrases, ...sharedTerms.phrases, ...(userDomainTerms?.phrases || [])],
    verbs: [...baseTerminology.verbs, ...sharedTerms.verbs, ...(userDomainTerms?.verbs || [])],
    nouns: [...baseTerminology.nouns, ...sharedTerms.nouns, ...(userDomainTerms?.nouns || [])],
    pronouns: baseTerminology.pronouns,
    context: baseTerminology.context,
    effortMultiplier: baseTerminology.effortMultiplier,
  };
}

/**
 * Check if a word/phrase matches any domain terminology
 */
export function matchesDomainTerminology(
  text: string,
  domain: Domain
): boolean {
  const terminology = getDomainTerminology(domain);
  const lowerText = text.toLowerCase();

  // Check keywords
  if (terminology.keywords.some(kw => lowerText.includes(kw.toLowerCase()))) {
    return true;
  }

  // Check phrases
  if (terminology.phrases.some(phrase => lowerText.includes(phrase.toLowerCase()))) {
    return true;
  }

  // Check verbs
  if (terminology.verbs.some(verb => {
    const regex = new RegExp(`\\b${verb}\\w*\\b`, 'i');
    return regex.test(lowerText);
  })) {
    return true;
  }

  return false;
}

