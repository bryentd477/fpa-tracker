#!/usr/bin/env node
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

try {
  const serviceAccountPath = path.join(__dirname, 'fpa-tracker-firebase-adminsdk-fbsvc-cdce50fbbf.json');
  console.log(`Loading service account from: ${serviceAccountPath}`);
  
  if (!fs.existsSync(serviceAccountPath)) {
    console.error(`❌ Service account file not found: ${serviceAccountPath}`);
    process.exit(1);
  }

  const serviceAccount = require(serviceAccountPath);
  console.log('✓ Service account loaded');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✓ Firebase initialized');

  const db = admin.firestore();
  const auth = admin.auth();

  async function approveUser(usernameOrEmail) {
    try {
      console.log(`\n🔍 Looking for user: ${usernameOrEmail}`);
      
      let user;
      
      // Try to find by email first
      if (usernameOrEmail.includes('@')) {
        try {
          user = await auth.getUserByEmail(usernameOrEmail);
          console.log(`✓ Found user by email: ${user.uid}`);
        } catch (err) {
          console.log('Not found by email, searching in user_access collection...');
        }
      }

      // If not found by email, search in user_access collection
      if (!user) {
        console.log('Searching user_access collection...');
        const snapshot = await db.collection('user_access').get();
        let found = false;
        
        snapshot.forEach(doc => {
          const data = doc.data();
          if (
            data.username?.toLowerCase() === usernameOrEmail.toLowerCase() ||
            data.email?.toLowerCase() === usernameOrEmail.toLowerCase()
          ) {
            user = { uid: data.uid, email: data.email, username: data.username };
            found = true;
          }
        });
        
        if (found) {
          console.log(`✓ Found user in user_access: ${user.uid}`);
        } else {
          console.error(`❌ User not found: ${usernameOrEmail}`);
          process.exit(1);
        }
      }

      // Check current access record
      console.log(`\n📋 Current access record:`);
      const accessRef = db.collection('user_access').doc(user.uid);
      const accessSnap = await accessRef.get();
      
      if (!accessSnap.exists()) {
        console.log('   No access record exists. Creating one...');
        await accessRef.set({
          uid: user.uid,
          email: user.email,
          username: user.username || user.email.split('@')[0],
          status: 'approved',
          role: 'user',
          requestedAt: admin.firestore.Timestamp.now(),
          approvedAt: admin.firestore.Timestamp.now()
        });
        console.log('   ✓ Created and approved');
      } else {
        const data = accessSnap.data();
        console.log(`   Status: ${data.status}`);
        console.log(`   Role: ${data.role}`);
        console.log(`   Email: ${data.email}`);
        console.log(`   Username: ${data.username}`);
        
        if (data.status !== 'approved') {
          console.log(`\n✏️  Updating status to 'approved'...`);
          await accessRef.update({
            status: 'approved',
            approvedAt: admin.firestore.Timestamp.now()
          });
          console.log('   ✓ User approved!');
        } else {
          console.log('\n   ✓ User is already approved!');
        }
      }

      console.log(`\n✅ User ${usernameOrEmail} is now ready to login!\n`);
      process.exit(0);

    } catch (error) {
      console.error('\n❌ Error:', error.message);
      console.error(error);
      process.exit(1);
    }
  }

  const username = process.argv[2];
  if (!username) {
    console.log('Usage: node approve-user.js <username-or-email>');
    console.log('Example: node approve-user.js bdau490');
    process.exit(1);
  }

  approveUser(username);
} catch (error) {
  console.error('❌ Initialization error:', error.message);
  console.error(error);
  process.exit(1);
}

