const admin = require('firebase-admin');
const serviceAccount = require('./fpa-tracker-firebase-adminsdk-fbsvc-cdce50fbbf.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'fpa-tracker'
});

const db = admin.firestore();
const auth = admin.auth();

const email = 'bryent.daugherty@dnr.wa.gov';

(async () => {
  try {
    console.log(`Looking up user: ${email}`);
    const userRecord = await auth.getUserByEmail(email);
    const uid = userRecord.uid;
    console.log(`Found user with UID: ${uid}`);

    console.log('Checking current document...');
    const ref = db.collection('user_access').doc(uid);
    const snap = await ref.get();
    
    if (snap.exists) {
      console.log('Current document:', JSON.stringify(snap.data(), null, 2));
    } else {
      console.log('Document does not exist yet');
    }

    console.log('\nChanging status to approved...');
    await ref.update({
      status: 'approved',
      role: 'user',
      approvedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✓ Successfully updated!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
