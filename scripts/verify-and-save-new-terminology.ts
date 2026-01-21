/**
 * Script to verify and save the newly added keywords and phrases to the shared terminology database
 * This script extracts the new terms I added and saves them to the database
 * 
 * Run this script with: npx tsx scripts/verify-and-save-new-terminology.ts
 * 
 * Note: This requires DATABASE_URL environment variable to be set
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Extract the new terms that were added
const NEW_TERMS_TO_SAVE = {
  business: {
    keywords: [
      // Additional business action keywords I added
      'execute', 'executing', 'implement', 'implementing', 'deploy', 'deploying', 'launch', 'launching',
      'initiate', 'initiating', 'start', 'starting', 'begin', 'beginning', 'commence', 'commencing',
      'complete', 'completing', 'finish', 'finishing', 'finalize', 'finalizing', 'conclude', 'concluding',
      'submit', 'submitting', 'deliver', 'delivering', 'handoff', 'handing off', 'transfer', 'transferring',
      'approve', 'approving', 'authorize', 'authorizing', 'validate', 'validating', 'verify', 'verifying',
      'plan', 'planning', 'strategize', 'strategizing', 'design', 'designing', 'architect', 'architecting',
      'develop', 'developing', 'build', 'building', 'create', 'creating', 'construct', 'constructing',
      'integrate', 'integrating', 'connect', 'connecting', 'link', 'linking', 'merge', 'merging',
      'update', 'updating', 'upgrade', 'upgrading', 'modernize', 'modernizing', 'refresh', 'refreshing',
      'maintain', 'maintaining', 'support', 'supporting', 'sustain', 'sustaining', 'preserve', 'preserving',
      'monitor', 'monitoring', 'track', 'tracking', 'observe', 'observing', 'watch', 'watching',
      'measure', 'measuring', 'quantify', 'quantifying', 'calculate', 'calculating', 'compute', 'computing',
      'report', 'reporting', 'document', 'documenting', 'record', 'recording', 'log', 'logging',
      'communicate', 'communicating', 'share', 'sharing', 'inform', 'informing', 'notify', 'notifying',
      'train', 'training', 'educate', 'educating', 'teach', 'teaching', 'instruct', 'instructing',
      'mentor', 'mentoring', 'coach', 'coaching', 'guide', 'guiding', 'advise', 'advising',
      'negotiate', 'negotiating', 'discuss', 'discussing', 'meet', 'meeting', 'conference', 'conferencing',
      'present', 'presenting', 'demonstrate', 'demonstrating', 'showcase', 'showcasing', 'exhibit', 'exhibiting',
      'sell', 'selling', 'market', 'marketing', 'promote', 'promoting', 'advertise', 'advertising',
      'acquire', 'acquiring', 'obtain', 'obtaining', 'secure', 'securing', 'procure', 'procuring',
      'manage', 'managing', 'administer', 'administering', 'oversee', 'overseeing', 'supervise', 'supervising',
      'lead', 'leading', 'direct', 'directing', 'guide', 'guiding', 'steer', 'steering',
      'schedule', 'scheduling', 'arrange', 'arranging', 'coordinate', 'coordinating',
      'prioritize', 'prioritizing', 'rank', 'ranking', 'order', 'ordering', 'sequence', 'sequencing',
      'resolve', 'resolving', 'solve', 'solving', 'fix', 'fixing', 'repair', 'repairing',
      'troubleshoot', 'troubleshooting', 'debug', 'debugging', 'diagnose', 'diagnosing', 'investigate', 'investigating'
    ],
    phrases: [
      // Additional contextual business phrases I added
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
      'investigate business opportunities', 'research market conditions', 'explore new technologies'
    ],
    verbs: [
      // Additional business action verbs I added
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
      // Additional business nouns I added
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
    ]
  },
  home: {
    keywords: [],
    phrases: [
      // Additional home contextual phrases I added
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
      'ensure home cleanliness', 'maintain organized home', 'create functional spaces'
    ],
    verbs: [
      // Additional home action verbs I added
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
      // Additional home nouns I added
      'preparation', 'cooking', 'baking', 'roasting', 'grilling', 'frying', 'boiling', 'steaming',
      'sautéing', 'marinating', 'seasoning', 'mixing', 'stirring', 'chopping', 'slicing', 'dicing',
      'mincing', 'peeling', 'grating', 'whisking', 'beating', 'kneading', 'rolling', 'spreading',
      'garnishing', 'serving', 'plating', 'presenting', 'shopping', 'purchasing', 'buying', 'selecting',
      'comparing', 'evaluating', 'reviewing', 'researching', 'appraisal', 'inspection', 'viewing', 'touring',
      'listing', 'showing', 'negotiation', 'closing', 'signing', 'moving', 'packing', 'unpacking',
      'nurturing', 'caring', 'supporting', 'guiding', 'teaching', 'helping', 'assisting', 'supervising',
      'monitoring', 'encouraging', 'praising', 'disciplining', 'celebration', 'playing', 'learning',
      'studying', 'practicing', 'rehearsing', 'performance'
    ]
  },
  personal: {
    keywords: [],
    phrases: [
      // Additional personal contextual phrases I added
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
      'manage personal time', 'prioritize activities', 'balance personal commitments'
    ],
    verbs: [
      // Additional personal action verbs I added
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
      // Additional personal nouns I added
      'practice', 'training', 'exercise', 'meditation', 'reflection', 'journaling', 'socialization',
      'connection', 'celebration', 'volunteering', 'travel', 'exploration', 'creation', 'art', 'music',
      'performance', 'composition', 'exhibition', 'booking', 'reservation', 'packing', 'flying', 'driving',
      'navigation', 'touring', 'sightseeing', 'photography'
    ]
  },
  world: {
    keywords: [],
    phrases: [],
    verbs: [
      // Additional world action verbs I added
      'immerse', 'immersing', 'adapt', 'adapting', 'adjust', 'adjusting', 'acclimate', 'acclimating',
      'orient', 'orienting', 'locate', 'locating', 'translate', 'translating', 'interpret', 'interpreting',
      'synchronize', 'synchronizing', 'confirm', 'confirming', 'cancel', 'canceling', 'modify', 'modifying',
      'sail', 'sailing', 'check-in', 'checking-in', 'check-out', 'checking-out', 'board', 'boarding',
      'depart', 'departing', 'arrive', 'arriving', 'land', 'landing', 'takeoff', 'taking off'
    ],
    nouns: [
      // Additional world nouns I added
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
    ]
  }
};

/**
 * Save terms to shared terminology database via API
 */
async function saveTermsToDatabase() {
  const API_BASE = process.env.VITE_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:54321/functions/v1';
  
  console.log('🚀 Starting to save new terminology to shared_terminology table...\n');
  console.log(`API Base URL: ${API_BASE}\n`);

  let totalSaved = 0;
  let totalSkipped = 0;

  for (const [domain, terms] of Object.entries(NEW_TERMS_TO_SAVE)) {
    const { keywords = [], phrases = [], verbs = [], nouns = [] } = terms;
    const totalTerms = keywords.length + phrases.length + verbs.length + nouns.length;
    
    if (totalTerms === 0) {
      console.log(`⏭️  Skipping ${domain} domain (no new terms)`);
      continue;
    }

    console.log(`\n📦 Processing ${domain} domain:`);
    console.log(`   Keywords: ${keywords.length}`);
    console.log(`   Phrases: ${phrases.length}`);
    console.log(`   Verbs: ${verbs.length}`);
    console.log(`   Nouns: ${nouns.length}`);
    console.log(`   Total: ${totalTerms} terms`);

    try {
      // Note: This requires authentication. In production, you'd need to authenticate first.
      // For now, this script demonstrates the structure. You'll need to:
      // 1. Get an auth token
      // 2. Include it in the headers
      
      const response = await fetch(`${API_BASE}/taskzm-database-function/shared-terminology`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // 'Authorization': `Bearer ${authToken}`, // Add auth token here
        },
        body: JSON.stringify({
          domain,
          keywords,
          phrases,
          verbs,
          nouns,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`❌ Failed to save ${domain} terms:`, error);
        totalSkipped += totalTerms;
        continue;
      }

      const result = await response.json();
      console.log(`✅ Saved ${result.saved} terms (${result.skipped} skipped)`);
      totalSaved += result.saved;
      totalSkipped += result.skipped;
    } catch (error) {
      console.error(`❌ Error saving ${domain} terms:`, error);
      totalSkipped += totalTerms;
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`   Total Saved: ${totalSaved}`);
  console.log(`   Total Skipped: ${totalSkipped}`);
  console.log(`\n✅ Process complete!`);
}

// Run the script
if (require.main === module) {
  saveTermsToDatabase().catch(console.error);
}

export { saveTermsToDatabase, NEW_TERMS_TO_SAVE };
