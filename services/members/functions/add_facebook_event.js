/**
 * Add Facebook Event to Firestore
 * Event: "Tölum um húsnæðismál" - Housing education discussion
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('/home/gudro/Development/projects/ekklesia/services/members/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ekklesia-prod-10-2025'
});

const db = admin.firestore();

async function addEvent() {
  try {
    console.log('Adding event to Firestore...');

    const eventData = {
      title: 'Jón Ferdinand Estherarson fjallar um húsnæðismálin',
      description: 'Húsnæðismál eru í dag eitt stærsta verkefnið sem unga fólkið, láglaunafólk og efnaminni eru að takast á við. Verkefnið er alþjóðlegt, en hér á Íslandi er það engu að síður einstakt. Hvað er til ráða? Og hvað getur róttækur stjórnmálaflókur gert til að bjarga þeim sem í vandræðum eru?\n\nKomdu og tökum þetta saman! Miðvikudaginn 25. September kl. 20:00-21:30 í húsakynnum Sósíalistaflokks Íslands, Hverfisgötu 105, Rvk. og á zoom.',
      date: '2025-09-25T20:00:00+00:00', // September 25, 2025 at 8 PM Iceland time
      endDate: '2025-09-25T21:30:00+00:00', // 9:30 PM
      location: 'Sósíalistaflokkur Íslands, Hverfisgötu 105, Reykjavík',
      onlineLink: 'https://us02web.zoom.us/j/83176043832',
      organizers: ['Birna Gunnlaugsdóttir', 'Markus Candi'],
      type: 'education', // educational event
      status: 'upcoming',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Add to Firestore
    const docRef = await db.collection('events').add(eventData);

    console.log('✅ Event added successfully!');
    console.log('Document ID:', docRef.id);
    console.log('Event data:', JSON.stringify(eventData, null, 2));

    // Verify by reading it back
    const doc = await docRef.get();
    console.log('\n✅ Verification - Event retrieved from Firestore:');
    console.log(JSON.stringify(doc.data(), null, 2));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding event:', error);
    process.exit(1);
  }
}

addEvent();
