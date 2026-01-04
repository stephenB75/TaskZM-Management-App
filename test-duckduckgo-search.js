/**
 * Test script to check DuckDuckGo search results
 * Run with: node test-duckduckgo-search.js
 */

// You'll need to set these environment variables or replace with actual values
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''; // Optional, for authenticated requests

const testQueries = [
  'Find a Auto Pet Litter for our home',
  'Find a Auto Pet Litter for our home. groceries',
  'clean Find a Auto Pet Litter for our home.',
  'Find a Auto Pet Litter for our home. home improvement'
];

async function testDuckDuckGoSearch(query) {
  const searchQuery = encodeURIComponent(query);
  const proxyUrl = `${SUPABASE_URL}/functions/v1/taskzm-database-function/duckduckgo/search?q=${searchQuery}`;
  
  console.log(`\n🔍 Testing query: "${query}"`);
  console.log(`📡 URL: ${proxyUrl}`);
  
  try {
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        ...(ACCESS_TOKEN ? { 'Authorization': `Bearer ${ACCESS_TOKEN}` } : {}),
      },
    });
    
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Success: ${data.success}`);
      console.log(`📦 Results count: ${data.count || 0}`);
      console.log(`📝 Results:`, data.results || []);
      
      if (data.results && data.results.length > 0) {
        console.log(`\n📄 Result previews:`);
        data.results.forEach((result, index) => {
          console.log(`  ${index + 1}. ${result.substring(0, 150)}${result.length > 150 ? '...' : ''}`);
        });
      } else {
        console.log(`⚠️  No results returned`);
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.log(`❌ Error:`, errorData);
    }
  } catch (error) {
    console.log(`❌ Exception:`, error.message);
  }
}

async function runTests() {
  console.log('🚀 Starting DuckDuckGo Search Tests\n');
  console.log('='.repeat(60));
  
  for (const query of testQueries) {
    await testDuckDuckGoSearch(query);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between requests
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Tests completed');
}

// Run tests
runTests().catch(console.error);

