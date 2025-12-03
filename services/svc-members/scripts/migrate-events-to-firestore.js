#!/usr/bin/env node
/**
 * Migrate Events to Firestore
 *
 * Moves the hardcoded Facebook events from events.js to Firestore collection
 *
 * Usage:
 *   node scripts/migrate-events-to-firestore.js
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin with default credentials
// This will use Application Default Credentials from gcloud
admin.initializeApp({
  projectId: 'ekklesia-prod-10-2025'
});

const db = admin.firestore();

// Event data from apps/members-portal/js/events.js
const events = [
  {
    title: 'Málþing um sveitarstjórnarmál',
    date: new Date('2025-11-01T10:00:00+00:00'), // 1. nóvember 2025, kl. 10:00
    endDate: new Date('2025-11-01T14:30:00+00:00'), // kl. 14:30
    description: 'Opinn fundur um sveitastjórnarmál þar sem allir fá tækifæri til að segja sína skoðun og heyra skoðun annara.\n\nDagskrá:\n• Fullrúar frá svæðisfélögum sósíalista segir frá sinni sýn á sveitastjórnarmálum\n• Hlé\n• Almennar umræður um sveitastjórnarmál þar sem félagsmenn fá að segja sína skoðun\n• Kaffi og léttar veitingar í boði',
    location: 'Hverfisgata 105, 101 Reykjavík',
    status: 'upcoming',
    organizers: ['Sósíalistaflokkur Íslands'],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    title: 'Tölum um húsnæðismál',
    date: new Date('2025-09-25T20:00:00+00:00'), // 25. september 2025, kl. 20:00
    endDate: new Date('2025-09-25T21:30:00+00:00'), // kl. 21:30
    description: 'Jón Ferdinand Estherarson fjallar um húsnæðismálin. Húsnæðismál eru í dag eitt stærsta verkefnið sem unga fólkið, láglaunafólk og efnaminni eru að takast á við. Verkefnið er alþjóðlegt, en hér á Íslandi er það engu að síður einstakt. Hvað er til ráða? Og hvað getur róttækur stjórnmálaflókkur gert til að bjarga þeim sem í vandræðum eru?\n\nKomdu og tökum þetta saman! Í húsakynnum Sósíalistaflokks Íslands, Hverfisgötu 105, Rvk. og á zoom.',
    location: 'Sósíalistaflokkur Íslands, Hverfisgötu 105',
    onlineLink: 'https://zoom.us/j/example', // Zoom link from Facebook
    status: 'upcoming',
    organizers: ['Birna Gunnlaugsdóttir', 'Markus Candi'],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  },
  {
    title: 'Félagsfundur Október 2025',
    date: new Date('2025-10-25T10:30:00+00:00'), // 25. október 2025, kl. 10:30
    endDate: new Date('2025-10-25T12:00:00+00:00'), // ~1.5 klst
    description: 'Félagsfundur Sósíalistaflokks Íslands.\n\nHúsið opnar klukkan 10:30 og fundurinn hefst stundvíslega klukkan 11:00. Boðið var upp á að taka þátt í gegnum Zoom.\n\nDagskrá:\n1. Framkvæmdastjórn segir frá starfinu\n2. Málefnastjórn segir frá starfinu\n3. Kosningastjórn segir frá starfinu\n4. Sagt frá starfi svæðisfélaga\n5. Önnur mál\n\nLéttar veitingar voru í boði.',
    location: 'Hverfisgata 105, 101 Reykjavík',
    status: 'past',
    organizers: ['Sósíalistaflokkur Íslands'],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }
];

async function migrateEvents() {
  try {
    console.log('🚀 Starting event migration to Firestore...\n');

    const batch = db.batch();
    const eventsRef = db.collection('events');

    // Check if events already exist
    const existingEvents = await eventsRef.get();
    if (!existingEvents.empty) {
      console.log(`⚠️  Found ${existingEvents.size} existing events in Firestore.`);
      console.log('Do you want to delete them first? (Ctrl+C to cancel, Enter to continue)\n');
      // For now, we'll add them anyway with unique IDs
    }

    let addedCount = 0;
    for (const event of events) {
      const docRef = eventsRef.doc(); // Auto-generate ID
      batch.set(docRef, event);
      addedCount++;

      console.log(`✓ Queued: "${event.title}"`);
      console.log(`  Status: ${event.status}`);
      console.log(`  Date: ${event.date.toISOString()}`);
      console.log(`  Location: ${event.location}`);
      console.log('');
    }

    // Commit batch
    await batch.commit();

    console.log(`✅ Successfully migrated ${addedCount} events to Firestore!\n`);

    // Verify
    const allEvents = await eventsRef.get();
    console.log(`📊 Verification: Firestore now has ${allEvents.size} total events\n`);

    // Show events by status
    const upcoming = allEvents.docs.filter(doc => doc.data().status === 'upcoming');
    const past = allEvents.docs.filter(doc => doc.data().status === 'past');

    console.log(`   Upcoming: ${upcoming.length}`);
    console.log(`   Past: ${past.length}\n`);

    console.log('✅ Migration complete!');
    console.log('Next steps:');
    console.log('  1. Update events.js to fetch from Firestore');
    console.log('  2. Remove hardcoded events from events.js');
    console.log('  3. Deploy changes\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error migrating events:', error);
    process.exit(1);
  }
}

migrateEvents();
