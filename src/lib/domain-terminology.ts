/**
 * Domain-Specific Terminology Database
 * 
 * Provides comprehensive terminology maps for business, home, personal, and world scenarios
 * to enable context-aware task analysis and action plan generation.
 */

import {
  DOMAIN_DETECTION_THRESHOLDS,
  DOMAIN_SCORING_WEIGHTS,
} from './ai-config';
import { logger } from './logger';

export type Domain = 'business' | 'home' | 'personal' | 'world' | 'mixed';

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
    // Medical and health
    'medical', 'health', 'healthcare', 'doctor', 'physician', 'nurse', 'patient',
    'appointment', 'checkup', 'examination', 'diagnosis', 'treatment', 'therapy',
    'medication', 'prescription', 'pharmacy', 'hospital', 'clinic', 'emergency',
    'surgery', 'procedure', 'test', 'lab', 'laboratory', 'xray', 'mri', 'ct scan',
    'vaccination', 'immunization', 'wellness', 'fitness', 'exercise', 'workout',
    'diet', 'nutrition', 'vitamin', 'supplement', 'mental health', 'therapy',
    'insurance', 'health insurance', 'medical insurance', 'claim', 'coverage',
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
    // Automobiles
    'car', 'automobile', 'vehicle', 'truck', 'suv', 'sedan', 'coupe', 'convertible',
    'motorcycle', 'bike', 'bicycle', 'maintenance', 'service', 'oil change', 'tire',
    'brake', 'engine', 'transmission', 'battery', 'alternator', 'radiator',
    'repair', 'fix', 'diagnostic', 'inspection', 'registration', 'insurance',
    'dmv', 'license', 'registration', 'title', 'emissions', 'safety', 'inspection',
    'gas', 'fuel', 'electric', 'hybrid', 'charging', 'station', 'parking',
    'driving', 'road trip', 'commute', 'traffic', 'navigation', 'gps', 'map',
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
    'dust', 'dusting', 'wipe', 'wiping', 'sweep', 'sweeping', 'mop', 'mopping', 'vacuum', 'vacuuming'
  ],
  phrases: [
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
    'organize documents by category', 'create systematic document filing', 'maintain organized document structure'
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
    'file', 'filing', 'submit', 'submitting', 'approve', 'approving', 'process', 'processing'
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
    'clutter', 'mess', 'disorder', 'chaos', 'untidiness', 'disarray'
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
    // Automobiles (home/personal)
    'car', 'automobile', 'vehicle', 'truck', 'suv', 'sedan', 'motorcycle', 'bike',
    'maintenance', 'service', 'oil change', 'tire', 'brake', 'engine', 'battery',
    'repair', 'fix', 'inspection', 'registration', 'insurance', 'dmv', 'license',
    'gas', 'fuel', 'electric', 'hybrid', 'charging', 'parking', 'driving', 'road trip'
  ],
  phrases: [
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
    // Automobile contextual phrases (home/personal)
    'schedule vehicle maintenance', 'perform routine car service', 'coordinate vehicle repairs',
    'manage vehicle registration', 'renew vehicle insurance', 'complete vehicle inspection',
    'plan road trip', 'prepare vehicle for travel', 'ensure safe driving conditions',
    'maintain vehicle performance', 'optimize fuel efficiency', 'track vehicle maintenance history',
    // Additional contextual phrases for everyday home scenarios
    'complete home task efficiently', 'execute home task systematically', 'follow home task workflow',
    'ensure home task completion', 'verify home task requirements', 'validate home task outcomes',
    'coordinate home activities', 'manage home timeline', 'track home progress',
    'resolve home task issues', 'optimize home performance', 'improve home efficiency',
    'document home process', 'review home results', 'finalize home deliverables',
    'prioritize home activities', 'allocate home resources', 'manage home dependencies',
    'ensure home quality', 'maintain home standards', 'meet home objectives'
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
    'study', 'studying', 'practice', 'practicing', 'rehearse', 'rehearsing', 'perform', 'performing'
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
    'school', 'schools', 'education', 'homework', 'lesson', 'lessons', 'class', 'classes',
    'game', 'games', 'toy', 'toys', 'sport', 'sports', 'hobby', 'hobbies'
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
    'therapy', 'counseling', 'coaching', 'mentoring', 'volunteering', 'charity'
  ],
  phrases: [
    'workout routine', 'personal project', 'self-care', 'skill development',
    'fitness goal', 'health checkup', 'doctor appointment', 'dental cleaning',
    'therapy session', 'coaching session', 'learning course', 'online class',
    'book club', 'hobby project', 'creative project', 'art project', 'music practice',
    'exercise routine', 'meal planning', 'nutrition planning', 'meditation practice',
    'yoga session', 'running training', 'cycling training', 'swimming practice',
    'hiking trip', 'camping trip', 'road trip', 'vacation planning', 'travel planning',
    'family time', 'date night', 'social event', 'birthday party', 'anniversary celebration',
    'holiday celebration', 'volunteer work', 'community service', 'charity event',
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
    'standardize personal work processes', 'document personal best practices', 'create personal procedure templates'
  ],
  verbs: [
    'exercise', 'workout', 'train', 'practice', 'learn', 'study', 'read', 'write',
    'create', 'make', 'build', 'craft', 'paint', 'draw', 'sketch', 'design',
    'play', 'perform', 'practice', 'rehearse', 'cook', 'bake', 'prepare',
    'travel', 'explore', 'visit', 'discover', 'experience', 'enjoy', 'relax',
    'meditate', 'reflect', 'journal', 'plan', 'organize', 'schedule', 'coordinate',
    'socialize', 'connect', 'meet', 'celebrate', 'volunteer', 'help', 'support',
    'book', 'booking', 'reserve', 'reserving', 'plan', 'planning', 'pack', 'packing',
    'unpack', 'unpacking', 'fly', 'flying', 'drive', 'driving', 'navigate', 'navigating',
    'tour', 'touring', 'sightsee', 'sightseeing', 'photograph', 'photographing',
    'compose', 'composing', 'arrange', 'arranging', 'record', 'recording', 'mix', 'mixing',
    'master', 'mastering', 'produce', 'producing', 'release', 'releasing', 'publish', 'publishing',
    'exhibit', 'exhibiting', 'display', 'displaying', 'showcase', 'showcasing', 'curate', 'curating'
  ],
  nouns: [
    'exercise', 'workout', 'fitness', 'health', 'wellness', 'hobby', 'learning',
    'travel', 'family', 'friends', 'social', 'self-care', 'meditation', 'yoga',
    'reading', 'writing', 'creative', 'art', 'music', 'photography', 'cooking',
    'baking', 'crafting', 'sewing', 'knitting', 'gardening', 'sports', 'running',
    'cycling', 'swimming', 'hiking', 'camping', 'outdoor', 'adventure', 'exploration',
    'education', 'course', 'class', 'workshop', 'seminar', 'conference', 'event',
    'celebration', 'birthday', 'anniversary', 'holiday', 'vacation', 'trip',
    'therapy', 'counseling', 'coaching', 'mentoring', 'volunteering', 'charity',
    'music', 'song', 'songs', 'album', 'albums', 'track', 'tracks', 'playlist', 'playlists',
    'artist', 'artists', 'musician', 'musicians', 'band', 'bands', 'concert', 'concerts',
    'performance', 'performances', 'recital', 'recitals', 'symphony', 'orchestra', 'choir',
    'instrument', 'instruments', 'piano', 'guitar', 'violin', 'drums', 'voice', 'singing',
    'art', 'arts', 'painting', 'paintings', 'drawing', 'drawings', 'sculpture', 'sculptures',
    'gallery', 'galleries', 'museum', 'museums', 'exhibition', 'exhibitions', 'artwork',
    'painter', 'painters', 'sculptor', 'sculptors', 'designer', 'designers',
    'travel', 'trip', 'journey', 'voyage', 'excursion', 'adventure', 'expedition',
    'destination', 'itinerary', 'booking', 'reservation', 'flight', 'hotel', 'accommodation',
    'luggage', 'suitcase', 'passport', 'visa', 'ticket', 'boarding', 'departure', 'arrival'
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
    'follow travel regulations', 'complete required documentation', 'meet entry requirements'
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
    'photograph', 'photographing', 'sightsee', 'sightseeing', 'explore', 'exploring'
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
    'museum', 'museums', 'gallery', 'galleries', 'beach', 'beaches', 'mountain', 'mountains'
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
  business: ['work', 'office', 'professional', 'corporate', 'workplace', 'colleague', 'coworker', 'business', 'company', 'organization', 'enterprise', 'firm'],
  home: ['household', 'residential', 'domestic', 'homeowner', 'home', 'house', 'residence'],
  personal: ['self', 'individual', 'myself', 'personal', 'private', 'self-care', 'wellbeing'],
  world: ['international', 'global', 'overseas', 'abroad', 'foreign', 'cross-border'],
  mixed: [],
};

/**
 * Negative keywords that exclude certain domains when present
 */
const NEGATIVE_KEYWORDS: Record<Domain, string[]> = {
  business: ['family dinner', 'home cooking', 'personal time', 'vacation', 'holiday'],
  home: ['work meeting', 'office', 'business', 'professional', 'corporate'],
  personal: ['work', 'office', 'business', 'corporate', 'professional'],
  world: [],
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
 * Detect domain from text by matching keywords, phrases, and verbs
 * Returns the domain with highest confidence score
 * IMPROVED: Now includes context-aware scoring, negative keywords, and comprehensive logging
 */
export function detectDomain(
  title: string,
  description: string
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
  
  logger.debug(`🔍 Domain Detection: Analyzing text="${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`, {
    titleLength: title.length,
    descriptionLength: description.length,
    totalLength: text.length,
  });
  
  if (!text || text.length === 0) {
    logger.debug('⚠️ Domain Detection: Empty text, defaulting to personal');
    return {
      domain: 'personal',
      confidence: 0,
      keywords: [],
      matchedTerms: { business: 0, home: 0, personal: 0, world: 0 },
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
  };

  // Check each domain
  for (const [domainKey, terminology] of Object.entries(DOMAIN_TERMINOLOGIES)) {
    if (domainKey === 'mixed') continue;

    const domain = domainKey as Exclude<Domain, 'mixed'>;
    
    // Check for negative keywords first (exclude domain if negative keyword found)
    const negativeKeywords = NEGATIVE_KEYWORDS[domain];
    let hasNegativeKeyword = false;
    for (const negativeKw of negativeKeywords) {
      const regex = new RegExp(negativeKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (regex.test(text)) {
        logger.debug(`🚫 Domain Detection: Negative keyword "${negativeKw}" found for ${domain}, excluding domain`);
        hasNegativeKeyword = true;
        break;
      }
    }
    if (hasNegativeKeyword) continue;

    // Check context-specific keywords (higher weight)
    const contextKws = CONTEXT_KEYWORDS[domain];
    for (const keyword of contextKws) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(text)) {
        const weight = DOMAIN_SCORING_WEIGHTS.CONTEXT_KEYWORD;
        matchedTerms[domain] += weight;
        contextKeywords[domain].push(keyword);
        if (!foundKeywords.includes(keyword)) {
          foundKeywords.push(keyword);
        }
        logger.debug(`✅ Domain Detection: Context keyword "${keyword}" matched for ${domain} (+${weight} points)`);
      }
    }

    // Check regular keywords (weight: 1 point each)
    for (const keyword of terminology.keywords) {
      // Skip if already matched as context keyword
      if (contextKeywords[domain].includes(keyword)) continue;
      
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(text)) {
        matchedTerms[domain] += DOMAIN_SCORING_WEIGHTS.KEYWORD;
        if (!foundKeywords.includes(keyword)) {
          foundKeywords.push(keyword);
        }
      }
    }

    // Check phrases (weight: 2 points each - more specific)
    // Context-specific phrases get higher weight
    for (const phrase of terminology.phrases) {
      const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      if (regex.test(text)) {
        // Check if phrase contains context keywords
        const hasContextKeyword = contextKeywords[domain].some(ck => phrase.toLowerCase().includes(ck.toLowerCase()));
        const weight = hasContextKeyword ? DOMAIN_SCORING_WEIGHTS.CONTEXT_PHRASE : DOMAIN_SCORING_WEIGHTS.PHRASE;
        matchedTerms[domain] += weight;
        if (!foundKeywords.includes(phrase)) {
          foundKeywords.push(phrase);
        }
        logger.debug(`✅ Domain Detection: Phrase "${phrase}" matched for ${domain} (+${weight} points${hasContextKeyword ? ', context-enhanced' : ''})`);
      }
    }

    // Check verbs (weight: 1.5 points each - action-oriented)
    for (const verb of terminology.verbs) {
      const regex = new RegExp(`\\b${verb}\\w*\\b`, 'i');
      if (regex.test(text)) {
        matchedTerms[domain] += DOMAIN_SCORING_WEIGHTS.VERB;
        if (!foundKeywords.includes(verb)) {
          foundKeywords.push(verb);
        }
      }
    }
    
    // Apply context bonus for keywords that appear near each other
    if (contextKeywords[domain].length > 1) {
      const contextBonus = calculateContextBonus(text, contextKeywords[domain]);
      if (contextBonus > 0) {
        matchedTerms[domain] += contextBonus;
        logger.debug(`🎯 Domain Detection: Context bonus for ${domain}: +${contextBonus.toFixed(2)} (keywords appear near each other)`);
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

  // If no matches or very low scores, default to personal
  if (maxScore === 0 || totalScore < 1) {
    logger.debug(`⚠️ Domain Detection: No matches found (maxScore=${maxScore}, totalScore=${totalScore}), defaulting to personal`);
    return {
      domain: 'personal',
      confidence: DOMAIN_DETECTION_THRESHOLDS.MIN_CONFIDENCE,
      keywords: foundKeywords,
      matchedTerms,
    };
  }

  // Find the winning domain
  const winningDomain = scores.find(([, score]) => score === maxScore)?.[0] || 'personal';

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
 * Get domain-specific terminology
 */
export function getDomainTerminology(domain: Domain): DomainTerminology {
  return DOMAIN_TERMINOLOGIES[domain] || DOMAIN_TERMINOLOGIES.personal;
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

