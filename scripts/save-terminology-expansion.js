/**
 * Script to save expanded terminology to the shared terminology database
 * 
 * Usage:
 * 1. Set your Supabase URL and anon key in the environment variables below
 * 2. Run: node scripts/save-terminology-expansion.js
 * 
 * Or run in browser console after logging in:
 * - Copy the script content
 * - Replace API_BASE and accessToken with your values
 * - Run in browser console
 */

// Configuration - Update these with your Supabase values
const API_BASE = process.env.VITE_SUPABASE_URL 
  ? `${process.env.VITE_SUPABASE_URL}/functions/v1/taskzm-database-function`
  : 'https://your-project.supabase.co/functions/v1/taskzm-database-function';

const accessToken = process.env.VITE_SUPABASE_ANON_KEY || '';

// New terms extracted from expansions
const NEW_TERMS = {
  business: {
    keywords: [
      'saas', 'software as a service', 'subscription', 'subscription model', 'billing cycle',
      'auto-renewal', 'proration', 'freemium', 'tiered pricing', 'usage-based pricing',
      'arr', 'annual recurring revenue', 'mrr', 'monthly recurring revenue', 'churn rate',
      'cac', 'customer acquisition cost', 'ltv', 'lifetime value', 'seat', 'user license',
      'sla', 'service level agreement', 'uptime', 'downtime', 'scalability', 'multi-tenancy',
      'sdk', 'software development kit', 'no-code', 'extensibility', 'privacy-by-design',
      'soc 2', 'compliance', 'data protection', 'security', 'encryption', 'authentication',
      'authorization', 'access control', 'audit log', 'backup', 'disaster recovery',
      'async', 'asynchronous', 'sync', 'synchronous', 'remote', 'hybrid', 'work from home',
      'wfh', 'distributed team', 'virtual meeting', 'video conference', 'screen share',
      'collaboration', 'real-time', 'live', 'streaming', 'webinar', 'workshop', 'training',
      'onboarding', 'offboarding', 'knowledge base', 'documentation', 'wiki', 'faq',
      'ticket', 'support ticket', 'help desk', 'customer support', 'customer success',
      'user feedback', 'feature request', 'roadmap', 'sprint', 'agile', 'scrum', 'kanban',
      'standup', 'retrospective', 'backlog', 'epic', 'story', 'task', 'subtask',
      'crm', 'customer relationship management', 'erp', 'enterprise resource planning',
      'project management', 'task management', 'time tracking', 'invoicing', 'accounting',
      'payroll', 'hr', 'human resources', 'recruiting', 'hiring', 'onboarding', 'performance review',
      'okr', 'objectives and key results', 'kpi', 'key performance indicator', 'metrics',
      'analytics', 'dashboard', 'reporting', 'insights', 'data visualization', 'bi', 'business intelligence',
    ],
    phrases: [
      'subscription management', 'billing cycle', 'auto-renewal', 'subscription renewal',
      'customer retention', 'churn reduction', 'lifetime value', 'customer acquisition',
      'service level agreement', 'uptime guarantee', 'downtime notification', 'system maintenance',
      'data backup', 'disaster recovery', 'security audit', 'compliance check',
      'privacy policy', 'terms of service', 'user agreement', 'data protection',
      'remote collaboration', 'virtual meeting', 'video conference', 'screen sharing',
      'async communication', 'real-time collaboration', 'distributed team', 'hybrid work',
      'work from home', 'remote work', 'flexible schedule', 'work-life balance',
      'knowledge sharing', 'documentation review', 'onboarding process', 'training session',
      'user feedback', 'feature request', 'product roadmap', 'sprint planning',
      'agile methodology', 'scrum meeting', 'kanban board', 'task prioritization',
      'customer relationship management', 'sales pipeline', 'lead generation', 'conversion tracking',
      'project management', 'task assignment', 'time tracking', 'resource allocation',
      'performance metrics', 'analytics dashboard', 'data visualization', 'business intelligence',
      'financial reporting', 'budget planning', 'expense tracking', 'invoice processing',
    ],
    verbs: [
      'subscribe', 'subscribing', 'renew', 'renewing', 'cancel', 'canceling', 'upgrade', 'upgrading',
      'downgrade', 'downgrading', 'billing', 'charging', 'invoice', 'invoicing', 'process', 'processing',
      'track', 'tracking', 'monitor', 'monitoring', 'analyze', 'analyzing', 'measure', 'measuring',
      'scale', 'scaling', 'expand', 'expanding', 'grow', 'growing', 'retain', 'retaining',
      'acquire', 'acquiring', 'onboard', 'onboarding', 'offboard', 'offboarding',
      'collaborate', 'collaborating', 'sync', 'syncing', 'share', 'sharing', 'stream', 'streaming',
      'broadcast', 'broadcasting', 'webinar', 'hosting', 'present', 'presenting', 'demo', 'demonstrating',
      'train', 'training', 'educate', 'educating', 'mentor', 'mentoring', 'coach', 'coaching',
      'feedback', 'reviewing', 'approve', 'approving', 'reject', 'rejecting', 'prioritize', 'prioritizing',
      'schedule', 'scheduling', 'plan', 'planning', 'organize', 'organizing', 'coordinate', 'coordinating',
    ],
    nouns: [
      'subscription', 'subscriptions', 'billing', 'invoice', 'invoices', 'payment', 'payments',
      'renewal', 'renewals', 'churn', 'retention', 'acquisition', 'conversion', 'conversions',
      'customer', 'customers', 'user', 'users', 'license', 'licenses', 'seat', 'seats',
      'tier', 'tiers', 'plan', 'plans', 'pricing', 'revenue', 'arr', 'mrr', 'ltv', 'cac',
      'sla', 'service level agreement', 'uptime', 'downtime', 'maintenance', 'backup', 'backups',
      'security', 'compliance', 'audit', 'audits', 'encryption', 'authentication', 'authorization',
      'collaboration', 'remote work', 'hybrid work', 'virtual meeting', 'video conference',
      'screen share', 'webinar', 'workshop', 'training', 'onboarding', 'offboarding',
      'knowledge base', 'documentation', 'wiki', 'faq', 'ticket', 'tickets', 'support',
      'feedback', 'feature request', 'roadmap', 'sprint', 'sprints', 'backlog', 'epic', 'epics',
      'story', 'stories', 'task', 'tasks', 'subtask', 'subtasks', 'agile', 'scrum', 'kanban',
      'crm', 'customer relationship management', 'erp', 'enterprise resource planning',
      'project management', 'task management', 'time tracking', 'invoicing', 'accounting',
      'payroll', 'hr', 'human resources', 'recruiting', 'hiring', 'performance review',
      'okr', 'objectives and key results', 'kpi', 'key performance indicator', 'metrics',
      'analytics', 'dashboard', 'dashboards', 'reporting', 'insights', 'data visualization', 'bi', 'business intelligence',
    ],
  },
  home: {
    keywords: [
      'smart home', 'home automation', 'iot', 'internet of things', 'smart device', 'smart devices',
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
    ],
    phrases: [
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
    ],
    verbs: [
      'automate', 'automating', 'configure', 'configuring', 'install', 'installing', 'setup', 'setting up',
      'optimize', 'optimizing', 'upgrade', 'upgrading', 'maintain', 'maintaining', 'monitor', 'monitoring',
      'secure', 'securing', 'protect', 'protecting', 'manage', 'managing', 'organize', 'organizing',
      'declutter', 'decluttering', 'minimize', 'minimizing', 'recycle', 'recycling', 'compost', 'composting',
      'renovate', 'renovating', 'remodel', 'remodeling', 'decorate', 'decorating', 'stage', 'staging',
      'refinance', 'refinancing', 'insure', 'insuring', 'warrant', 'warranting', 'lease', 'leasing',
      'rent', 'renting', 'manage property', 'managing property', 'maintain property', 'maintaining property',
    ],
    nouns: [
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
      'grocery delivery', 'online shopping', 'subscription box', 'home services',
    ],
  },
  personal: {
    keywords: [
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
    ],
    phrases: [
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
    ],
    verbs: [
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
    ],
    nouns: [
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
      'mentorship', 'community', 'volunteer work', 'charity', 'philanthropy',
    ],
  },
  world: {
    keywords: [
      'globalization', 'international relations', 'cultural diversity', 'multiculturalism',
      'sustainability', 'climate change', 'global warming', 'environmental', 'carbon neutral',
      'renewable energy', 'solar power', 'wind power', 'green energy', 'eco-friendly',
      'human rights', 'social justice', 'equality', 'diversity', 'inclusion',
      'geopolitics', 'international law', 'diplomacy', 'treaty', 'agreement',
      'world economy', 'global market', 'international trade', 'export', 'import',
      'global health', 'pandemic', 'epidemic', 'vaccination', 'public health',
      'world news', 'current events', 'breaking news', 'international news', 'global events',
      'travel advisory', 'travel warning', 'visa requirement', 'entry requirement',
      'international flight', 'global shipping', 'cross-border', 'international payment',
      'currency exchange', 'foreign exchange', 'exchange rate', 'international transfer',
      'time zone', 'timezone', 'world clock', 'international time', 'global time',
      'cultural exchange', 'language barrier', 'translation service', 'interpreter',
      'international conference', 'global summit', 'world forum', 'international event',
      'global citizenship', 'world peace', 'international cooperation', 'global partnership',
    ],
    phrases: [
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
      'climate summit', 'environmental conference', 'global initiative', 'worldwide campaign',
    ],
    verbs: [
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
    ],
    nouns: [
      'globalization', 'international relations', 'cultural diversity', 'multiculturalism',
      'sustainability', 'climate change', 'global warming', 'environmental', 'carbon neutral',
      'renewable energy', 'solar power', 'wind power', 'green energy', 'eco-friendly',
      'human rights', 'social justice', 'equality', 'diversity', 'inclusion',
      'geopolitics', 'international law', 'diplomacy', 'treaty', 'agreement',
      'world economy', 'global market', 'international trade', 'export', 'import',
      'global health', 'pandemic', 'epidemic', 'vaccination', 'public health',
      'world news', 'current events', 'breaking news', 'international news', 'global events',
      'travel advisory', 'travel warning', 'visa requirement', 'entry requirement',
      'international flight', 'global shipping', 'cross-border', 'international payment',
      'currency exchange', 'foreign exchange', 'exchange rate', 'international transfer',
      'time zone', 'timezone', 'world clock', 'international time', 'global time',
      'cultural exchange', 'language barrier', 'translation service', 'interpreter',
      'international conference', 'global summit', 'world forum', 'international event',
      'global citizenship', 'world peace', 'international cooperation', 'global partnership',
      'sustainable development', 'global goals', 'international aid', 'humanitarian effort',
      'climate summit', 'environmental conference', 'global initiative', 'worldwide campaign',
    ],
  },
};

async function saveTermsToDatabase() {
  if (!accessToken) {
    console.error('❌ VITE_SUPABASE_ANON_KEY not set. Please set it as an environment variable or update the script.');
    console.log('\nTo run this script:');
    console.log('1. Set environment variables:');
    console.log('   export VITE_SUPABASE_URL="https://your-project.supabase.co"');
    console.log('   export VITE_SUPABASE_ANON_KEY="your-anon-key"');
    console.log('2. Run: node scripts/save-terminology-expansion.js');
    console.log('\nOr update the API_BASE and accessToken constants in the script directly.');
    process.exit(1);
  }

  console.log('🚀 Starting terminology expansion save...\n');
  console.log(`📡 API Base: ${API_BASE}\n`);

  const domains = ['business', 'home', 'personal', 'world'];

  for (const domain of domains) {
    const terms = NEW_TERMS[domain];
    console.log(`📝 Processing ${domain} domain...`);
    console.log(`   Keywords: ${terms.keywords.length}`);
    console.log(`   Phrases: ${terms.phrases.length}`);
    console.log(`   Verbs: ${terms.verbs.length}`);
    console.log(`   Nouns: ${terms.nouns.length}`);

    try {
      const response = await fetch(`${API_BASE}/shared-terminology`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          domain,
          keywords: terms.keywords,
          phrases: terms.phrases,
          verbs: terms.verbs,
          nouns: terms.nouns,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`   ❌ Error saving ${domain}:`, error);
        continue;
      }

      const result = await response.json();
      console.log(`   ✅ Saved ${result.saved} terms (${result.skipped} skipped)\n`);
    } catch (error) {
      console.error(`   ❌ Error saving ${domain}:`, error.message);
    }
  }

  console.log('✨ Terminology expansion complete!');
}

// Run the script
if (typeof require !== 'undefined' && require.main === module) {
  // Node.js environment
  saveTermsToDatabase().catch(console.error);
} else {
  // Browser environment - export for use
  if (typeof window !== 'undefined') {
    window.saveTerminologyExpansion = saveTermsToDatabase;
  }
}
