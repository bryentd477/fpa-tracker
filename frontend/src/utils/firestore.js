import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  doc,
  getDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';

const FPA_COLLECTION = 'fpas';
const ACTIVITIES_COLLECTION = 'approved_activities';
const RENEWALS_COLLECTION = 'renewal_history';
const ALLOWED_FPA_FIELDS = new Set([
  'fpaNumber',
  'landowner',
  'timberSaleName',
  'landownerType',
  'applicationStatus',
  'decisionDeadline',
  'expirationDate',
  'approvedActivity',
  'notes',
  'activity',
  'activityHistory',
  'geometry'
]);

const ALLOWED_ACTIVITY_FIELDS = new Set([
  'fpaId',
  'status',
  'startDate',
  'harvestCompleteDate',
  'activityCompleteDate',
  'comments',
  'reforestationRequired'
]);

const ALLOWED_RENEWAL_FIELDS = new Set([
  'renewalDate',
  'notes'
]);

const sanitizePayload = (data, allowedKeys) => {
  const cleaned = {};
  if (!data || typeof data !== 'object') return cleaned;
  Object.keys(data).forEach((key) => {
    if (allowedKeys.has(key)) {
      cleaned[key] = data[key];
    }
  });
  return cleaned;
};

const sanitizeFpaPayload = (data) => sanitizePayload(data, ALLOWED_FPA_FIELDS);
const sanitizeActivityPayload = (data) => sanitizePayload(data, ALLOWED_ACTIVITY_FIELDS);
const sanitizeRenewalPayload = (data) => sanitizePayload(data, ALLOWED_RENEWAL_FIELDS);

// ===== FPA Operations =====
export const createFPA = async (fpaData, userId) => {
  try {
    const payload = sanitizeFpaPayload(fpaData);
    
    // Convert geometry to JSON string to avoid Firestore nested array error
    if (payload.geometry && typeof payload.geometry === 'object') {
      payload.geometry = JSON.stringify(payload.geometry);
    }
    
    const docData = {
      ...payload,
      ownerId: userId,
      userId: userId, // Keep legacy field for backward compatibility
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const docRef = await addDoc(collection(db, 'fpas'), docData);
    return { id: docRef.id, ...docData };
  } catch (error) {
    console.error('Error creating FPA:', error);
    throw error;
  }
};

export const updateFPA = async (fpaId, fpaData) => {
  try {
    const payload = sanitizeFpaPayload(fpaData);
    
    console.log('[Firestore.updateFPA] Before sanitization:', {
      fpaId,
      hasGeometry: !!fpaData.geometry,
      geometryType: fpaData.geometry?.type
    });
    
    console.log('[Firestore.updateFPA] After sanitization:', {
      fpaId,
      hasGeometry: !!payload.geometry,
      geometryType: payload.geometry?.type
    });
    
    // SAFETY CHECK: If geometry is not in the update but exists in the database, preserve it
    if (!payload.geometry) {
      try {
        const docRef = doc(db, 'fpas', fpaId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const existingData = docSnap.data();
          if (existingData.geometry) {
            console.log('[Firestore.updateFPA] Preserving existing geometry from database');
            payload.geometry = existingData.geometry;
          }
        }
      } catch (err) {
        console.warn('[Firestore.updateFPA] Could not preserve geometry:', err.message);
      }
    }
    
    // Convert geometry to JSON string to avoid Firestore nested array error
    if (payload.geometry && typeof payload.geometry === 'object') {
      payload.geometry = JSON.stringify(payload.geometry);
      console.log('[Firestore.updateFPA] Geometry stringified');
    }
    
    const docRef = doc(db, 'fpas', fpaId);
    await updateDoc(docRef, {
      ...payload,
      updatedAt: new Date()
    });
    
    console.log('[Firestore.updateFPA] Update completed for FPA:', fpaId);
  } catch (error) {
    console.error('Error updating FPA:', error);
    throw error;
  }
};

export const deleteFPA = async (fpaId) => {
  try {
    const docRef = doc(db, 'fpas', fpaId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting FPA:', error);
    throw error;
  }
};

export const getFPAs = async (userId) => {
  try {
    if (!userId) {
      console.log('No userId provided');
      return [];
    }
    
    console.log('Querying FPAs for userId:', userId);
    // Remove orderBy to avoid index requirement - sort client-side instead
    const ownerQuery = query(
      collection(db, FPA_COLLECTION),
      where('ownerId', '==', userId)
    );
    const ownerSnapshot = await getDocs(ownerQuery);
    const ownerFpas = ownerSnapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`[Firestore.getFPAs-owner] FPA:`, {
        id: doc.id,
        fpaNumber: data.fpaNumber,
        hasGeometry: !!data.geometry,
        geometryType: typeof data.geometry,
        geometryLength: typeof data.geometry === 'string' ? data.geometry.length : 'N/A'
      });
      
      // Parse geometry string back to object
      if (data.geometry && typeof data.geometry === 'string') {
        try {
          data.geometry = JSON.parse(data.geometry);
          console.log(`[Firestore.getFPAs-owner] Parsed geometry for FPA:`, doc.id);
        } catch (e) {
          console.warn('Failed to parse geometry for FPA:', doc.id, e.message);
        }
      }
      return { id: doc.id, ...data };
    });

    const legacyQuery = query(
      collection(db, FPA_COLLECTION),
      where('userId', '==', userId)
    );
    const legacySnapshot = await getDocs(legacyQuery);
    const legacyFpas = legacySnapshot.docs.map(doc => {
      const data = doc.data();
      console.log(`[Firestore.getFPAs-legacy] FPA:`, {
        id: doc.id,
        fpaNumber: data.fpaNumber,
        hasGeometry: !!data.geometry,
        geometryType: typeof data.geometry,
        geometryLength: typeof data.geometry === 'string' ? data.geometry.length : 'N/A'
      });
      
      // Parse geometry string back to object
      if (data.geometry && typeof data.geometry === 'string') {
        try {
          data.geometry = JSON.parse(data.geometry);
          console.log(`[Firestore.getFPAs-legacy] Parsed geometry for FPA:`, doc.id);
        } catch (e) {
          console.warn('Failed to parse geometry for FPA:', doc.id, e.message);
        }
      }
      return { id: doc.id, ...data };
    });

    const merged = new Map();
    ownerFpas.forEach((fpa) => merged.set(fpa.id, fpa));
    legacyFpas.forEach((fpa) => merged.set(fpa.id, fpa));

    // Sort client-side by createdAt descending
    const result = Array.from(merged.values()).sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.getTime?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.getTime?.() || 0;
      return bTime - aTime; // Descending order (newest first)
    });

    return result;
  } catch (error) {
    console.error('Error fetching FPAs:', error);
    return [];
  }
};

export const getFPA = async (fpaId) => {
  try {
    const fpaRef = doc(db, FPA_COLLECTION, fpaId);
    const fpaSnap = await getDoc(fpaRef);
    if (fpaSnap.exists()) {
      const data = fpaSnap.data();
      // Parse geometry string back to object
      if (data.geometry && typeof data.geometry === 'string') {
        try {
          data.geometry = JSON.parse(data.geometry);
        } catch (e) {
          console.warn('Failed to parse geometry for FPA:', fpaId);
        }
      }
      return { id: fpaSnap.id, ...data };
    }
    return null;
  } catch (error) {
    console.error('Error fetching FPA:', error);
    throw error;
  }
};

export const searchFPAs = async (query_text, userId) => {
  try {
    if (!userId) return [];
    const ownerQuery = query(collection(db, FPA_COLLECTION), where('ownerId', '==', userId));
    const ownerSnapshot = await getDocs(ownerQuery);
    const ownerFpas = ownerSnapshot.docs.map(doc => {
      const data = doc.data();
      // Parse geometry string back to object
      if (data.geometry && typeof data.geometry === 'string') {
        try {
          data.geometry = JSON.parse(data.geometry);
        } catch (e) {
          console.warn('Failed to parse geometry for FPA:', doc.id);
        }
      }
      return { id: doc.id, ...data };
    });

    const legacyQuery = query(collection(db, FPA_COLLECTION), where('userId', '==', userId));
    const legacySnapshot = await getDocs(legacyQuery);
    const legacyFpas = legacySnapshot.docs.map(doc => {
      const data = doc.data();
      // Parse geometry string back to object
      if (data.geometry && typeof data.geometry === 'string') {
        try {
          data.geometry = JSON.parse(data.geometry);
        } catch (e) {
          console.warn('Failed to parse geometry for FPA:', doc.id);
        }
      }
      return { id: doc.id, ...data };
    });

    const merged = new Map();
    ownerFpas.forEach((fpa) => merged.set(fpa.id, fpa));
    legacyFpas.forEach((fpa) => merged.set(fpa.id, fpa));
    const userFpas = Array.from(merged.values());

    // Client-side search
    const lowerQuery = query_text.toLowerCase();
    return userFpas.filter(fpa =>
      (fpa.fpa_number && fpa.fpa_number.toLowerCase().includes(lowerQuery)) ||
      (fpa.landowner && fpa.landowner.toLowerCase().includes(lowerQuery)) ||
      (fpa.timber_sale_name && fpa.timber_sale_name.toLowerCase().includes(lowerQuery)) ||
      (fpa.fpaNumber && fpa.fpaNumber.toLowerCase().includes(lowerQuery)) ||
      (fpa.timberSaleName && fpa.timberSaleName.toLowerCase().includes(lowerQuery))
    );
  } catch (error) {
    console.error('Error searching FPAs:', error);
    return [];
  }
};

// ===== Activity Operations =====
export const addActivity = async (fpaId, activityData) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');
    
    const payload = sanitizeActivityPayload(activityData);
    const docData = {
      ...payload,
      fpaId,
      ownerId: uid,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const docRef = await addDoc(collection(db, ACTIVITIES_COLLECTION), docData);
    return { id: docRef.id, ...docData };
  } catch (error) {
    console.error('Error adding activity:', error);
    throw error;
  }
};

export const updateActivity = async (activityId, activityData) => {
  try {
    const payload = sanitizeActivityPayload(activityData);
    const docRef = doc(db, ACTIVITIES_COLLECTION, activityId);
    await updateDoc(docRef, {
      ...payload,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating activity:', error);
    throw error;
  }
};

export const deleteActivity = async (activityId) => {
  try {
    const docRef = doc(db, ACTIVITIES_COLLECTION, activityId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting activity:', error);
    throw error;
  }
};

export const getActivities = async (fpaId) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const activitiesSnapshot = await getDocs(
      query(
        collection(db, ACTIVITIES_COLLECTION),
        where('fpaId', '==', fpaId),
        where('ownerId', '==', uid)
      )
    );
    // Sort client-side instead of using orderBy
    const activities = activitiesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return activities.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() || a.createdAt?.getTime?.() || 0;
      const bTime = b.createdAt?.toMillis?.() || b.createdAt?.getTime?.() || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error('Error fetching activities:', error);
    throw error;
  }
};

// ===== Renewal Operations =====
export const addRenewal = async (fpaId, renewalData) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');
    
    const payload = sanitizeRenewalPayload(renewalData);
    const docData = {
      ...payload,
      fpaId,
      ownerId: uid,
      createdAt: new Date()
    };
    const docRef = await addDoc(collection(db, RENEWALS_COLLECTION), docData);
    return { id: docRef.id, ...docData };
  } catch (error) {
    console.error('Error adding renewal:', error);
    throw error;
  }
};

export const deleteRenewal = async (renewalId) => {
  try {
    const docRef = doc(db, RENEWALS_COLLECTION, renewalId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting renewal:', error);
    throw error;
  }
};

export const getRenewals = async (fpaId) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return [];
    const renewalsSnapshot = await getDocs(
      query(
        collection(db, RENEWALS_COLLECTION),
        where('fpaId', '==', fpaId),
        where('ownerId', '==', uid)
      )
    );
    // Sort client-side by renewalDate descending
    const renewals = renewalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return renewals.sort((a, b) => {
      const aTime = a.renewalDate?.toMillis?.() || a.renewalDate?.getTime?.() || 0;
      const bTime = b.renewalDate?.toMillis?.() || b.renewalDate?.getTime?.() || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error('Error fetching renewals:', error);
    throw error;
  }
};

// ===== Dashboard =====
export const getDashboardStats = async (userId) => {
  try {
    if (!userId) return { total: 0, byStatus: {} };
    const fpasSnapshot = await getDocs(
      query(collection(db, FPA_COLLECTION), where('ownerId', '==', userId))
    );
    const fpas = fpasSnapshot.docs.map(doc => doc.data());
    
    const grouped = {
      'Not Started': [],
      'In Progress': [],
      'In Decision Window': [],
      'Approved': [],
      'Expired': [],
      'Withdrawn': []
    };

    fpas.forEach(fpa => {
      const status = fpa.application_status || 'Not Started';
      if (grouped[status]) {
        grouped[status].push(fpa);
      }
    });

    return {
      total: fpas.length,
      byStatus: grouped
    };
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    throw error;
  }
};
