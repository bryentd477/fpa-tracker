import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, limit } from 'firebase/firestore';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyBt-Zjm-7SreD9TxAzlkNmo4vA_67HsPpw",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "fpa-tracker.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "fpa-tracker",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "fpa-tracker.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "513026239187",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:513026239187:web:f9e845fbbb4055aa108226",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-M8EEB8J9C1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);

const ensureAuthPersistence = async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn('Failed to set auth persistence:', error);
  }
};

const normalizeUsername = (value = '') => value.trim().toLowerCase();

const resolveEmailFromIdentifier = async (identifier) => {
  const trimmed = (identifier || '').trim();
  if (!trimmed) {
    throw new Error('Enter your email or username.');
  }

  if (trimmed.includes('@')) {
    return trimmed;
  }

  // Search user_access collection for username
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'user_access'),
        where('username', '==', trimmed),
        limit(1)
      )
    );
    
    if (snapshot.empty) {
      throw new Error('No user found with that username.');
    }
    
    const userData = snapshot.docs[0].data();
    return userData.email;
  } catch (error) {
    throw new Error(error.message || 'Username not found. Please check it or sign up.');
  }
};

// Authentication Functions
export const signUpWithEmail = async (email, password, username) => {
  try {
    await ensureAuthPersistence();
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      throw new Error('Username is required.');
    }

    console.log('Creating user:', email);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    console.log('User created, creating access record');

    try {
      // Admin emails get auto-approved
      const ADMIN_EMAILS = ['bryent.daugherty@gmail.com'];
      const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
      
      // Create user_access document
      const accessData = {
        uid: userCredential.user.uid,
        email: email,
        username: username.trim(),
        status: isAdmin ? 'approved' : 'pending',
        role: isAdmin ? 'super_admin' : 'user',
        requestedAt: new Date()
      };
      
      if (isAdmin) {
        accessData.approvedAt = new Date();
      }
      
      await setDoc(doc(db, 'user_access', userCredential.user.uid), accessData);
      
      return { user: userCredential.user, status: accessData.status, role: accessData.role };
    } catch (error) {
      // Rollback: delete auth user if access record creation failed
      try {
        await userCredential.user.delete();
      } catch (cleanupErr) {
        console.warn('Failed to clean up user after access error:', cleanupErr);
      }
      throw error;
    }
  } catch (error) {
    console.error('Signup error:', error);
    throw new Error(error.message);
  }
};

export const signInWithEmail = async (email, password) => {
  try {
    await ensureAuthPersistence();
    const resolvedEmail = await resolveEmailFromIdentifier(email);
    console.log('[signInWithEmail] Signing in:', resolvedEmail);
    const userCredential = await signInWithEmailAndPassword(auth, resolvedEmail, password);
    
    // Admin bypass: Allow known admin emails without approval check
    const ADMIN_EMAILS = ['bryent.daugherty@gmail.com'];
    if (ADMIN_EMAILS.includes(resolvedEmail.toLowerCase())) {
      console.log('[signInWithEmail] ✓ Admin user, bypassing approval check');
      return userCredential.user;
    }
    
    // Check if user is approved
    console.log('[signInWithEmail] User authenticated, checking approval status...');
    const userAccess = await getUserAccess(userCredential.user.uid);
    
    if (!userAccess) {
      console.error('[signInWithEmail] No access record found for user');
      await signOut(auth);
      throw new Error('Your account has not been approved yet. Please contact the administrator.');
    }
    
    if (userAccess.status !== 'approved') {
      console.error('[signInWithEmail] User status is not approved:', userAccess.status);
      await signOut(auth);
      throw new Error('Your account has not been approved yet. Please contact the administrator.');
    }
    
    console.log('[signInWithEmail] ✓ Approval confirmed, user signed in successfully');
    return userCredential.user;
  } catch (error) {
    throw new Error(error.message);
  }
};

export const sendPasswordReset = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw new Error(error.message);
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error(error.message);
  }
};

export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, async (currentUser) => {
    if (currentUser) {
      // Check if user is still approved
      const userAccess = await getUserAccess(currentUser.uid);
      if (!userAccess || userAccess.status !== 'approved') {
        await signOut(auth);
        callback(null);
        return;
      }
    }
    callback(currentUser);
  });
};

// User Access Management Functions

// Get user access status
export const getUserAccess = async (userId) => {
  try {
    const user = auth.currentUser;
    if (!user) return null;

    console.log('[getUserAccess] Checking approval for:', user.email, 'uid:', user.uid);
    
    // Admin bypass: Return super_admin role for known admin emails
    const ADMIN_EMAILS = ['bryent.daugherty@gmail.com'];
    if (ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
      console.log('[getUserAccess] ✓ Admin user detected, returning super_admin role');
      return {
        uid: user.uid,
        email: user.email,
        username: user.email.split('@')[0],
        role: 'super_admin',
        status: 'approved'
      };
    }
    
    const docRef = doc(db, 'user_access', user.uid);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) {
      console.log('[getUserAccess] No user access record found');
      return null;
    }

    const userData = snapshot.data();
    console.log('[getUserAccess] Found record - status:', userData.status, 'role:', userData.role);
    return userData;
  } catch (error) {
    console.error('Error getting user access:', error);
    return null;
  }
};

// Get all pending users (admin only)
export const getAllPendingUsers = async () => {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'user_access'),
        where('status', '==', 'pending')
      )
    );
    return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching pending users:', error);
    throw error;
  }
};

// Get all approved users (admin only)
export const getAllApprovedUsers = async () => {
  try {
    const snapshot = await getDocs(
      query(
        collection(db, 'user_access'),
        where('status', '==', 'approved')
      )
    );
    return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error fetching approved users:', error);
    throw error;
  }
};

// Approve user (admin only)
export const approveUser = async (userId) => {
  try {
    const docRef = doc(db, 'user_access', userId);
    await updateDoc(docRef, {
      status: 'approved',
      role: 'user',
      approvedAt: new Date()
    });
  } catch (error) {
    console.error('Error approving user:', error);
    throw error;
  }
};

// Deny user access (admin only)
export const denyUser = async (userId) => {
  try {
    const docRef = doc(db, 'user_access', userId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error denying user:', error);
    throw error;
  }
};

// Remove approved user (admin only)
export const removeUser = async (userId) => {
  try {
    const docRef = doc(db, 'user_access', userId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error removing user:', error);
    throw error;
  }
};
