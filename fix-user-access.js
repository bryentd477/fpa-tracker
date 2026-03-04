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
    // Find user by email
    console.log(`Looking up user: ${email}`);
    const userRecord = await auth.getUserByEmail(email);
    const uid = userRecord.uid;
    console.log(`Found user with UID: ${uid}`);

    // Update user_access document
    const userAccessRef = db.collection('user_access').doc(uid);
    const docSnap = await userAccessRef.get();

    if (docSnap.exists) {
      console.log('Document exists, updating...');
      console.log('Current data:', JSON.stringify(docSnap.data(), null, 2));
    } else {
      console.log('Document does not exist, creating...');
    }

    // Set the document with proper structure
    const updateData = {
      uid: uid,
      email: email,
      username: 'bdau490',
      status: 'approved',
      role: 'user',
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    console.log('Updating with data...');
    await userAccessRef.set(updateData);
    console.log(`✓ Successfully updated user_access for ${email}`);
    console.log(`User can now login with username: bdau490`);
    process.exit(0);
  } catch (error) {
    console.error('Error details:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    process.exit(1);
  }
})();
