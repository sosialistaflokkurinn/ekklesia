require('dotenv').config();
const axios = require('axios');

// TODO: This script requires pages_manage_events permission which we don't have yet
// Currently configured for test page (Guðröður), not Sósíalistaflokkurinn (ID: 1284030001655471)
// See: tmp/FACEBOOK_INTEGRATION_STATUS.md

const PAGE_ID = process.env.FB_PAGE_ID;
const TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

async function createMockEvents() {
  console.log(`Target Page ID: ${PAGE_ID}`);
  
  // 1. Try to get a Page Access Token (if the current one is a User Token)
  let pageAccessToken = TOKEN;
  try {
    console.log('Attempting to exchange User Token for Page Token...');
    const response = await axios.get(`https://graph.facebook.com/v19.0/${PAGE_ID}?fields=access_token&access_token=${TOKEN}`);
    if (response.data.access_token) {
      pageAccessToken = response.data.access_token;
      console.log('✅ Successfully obtained Page Access Token.');
    }
  } catch (error) {
    console.warn('⚠️ Could not exchange token (might already be a Page Token or missing permissions). Using provided token.');
    // console.error(error.response?.data);
  }

  // 2. Define Mock Events
  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;

  const events = [
    {
      name: 'Aðalfundur Sósíalista 2025',
      description: 'Árlegur aðalfundur þar sem við kjósum nýja stjórn og ræðum stefnumál flokksins.',
      start_time: new Date(now.getTime() + 10 * oneDay).toISOString().split('.')[0], // 10 days from now
      end_time: new Date(now.getTime() + 10 * oneDay + 4 * 60 * 60 * 1000).toISOString().split('.')[0],
    },
    {
      name: 'Kaffispjall: Húsnæðismál',
      description: 'Opið hús og kaffispjall um stöðu húsnæðismála á Íslandi. Allir velkomnir.',
      start_time: new Date(now.getTime() + 3 * oneDay).toISOString().split('.')[0], // 3 days from now
      end_time: new Date(now.getTime() + 3 * oneDay + 2 * 60 * 60 * 1000).toISOString().split('.')[0],
    },
    {
      name: 'Mótmæli: Burt með verðbólgu!',
      description: 'Við krefjumst aðgerða strax! Mæting á Austurvöll.',
      start_time: new Date(now.getTime() + 14 * oneDay).toISOString().split('.')[0], // 2 weeks from now
      end_time: new Date(now.getTime() + 14 * oneDay + 1 * 60 * 60 * 1000).toISOString().split('.')[0],
    }
  ];

  // 3. Create Events
  console.log('\nStarting event creation...');
  
  for (const event of events) {
    try {
      const url = `https://graph.facebook.com/v19.0/${PAGE_ID}/events`;
      const res = await axios.post(url, event, {
        params: { access_token: pageAccessToken }
      });
      console.log(`✅ Created: "${event.name}" (ID: ${res.data.id})`);
    } catch (error) {
      console.error(`❌ Failed to create: "${event.name}"`);
      console.error('   Error:', error.response?.data?.error?.message || error.message);
      
      if (error.response?.data?.error?.code === 200) {
        console.error('   Hint: Check if the user has "pages_manage_events" permission.');
      }
    }
  }
}

createMockEvents();
