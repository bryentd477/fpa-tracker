const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');

admin.initializeApp();

const db = admin.firestore();
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const TRACKED_FPA_FIELDS = new Set([
  'fpaNumber',
  'landowner',
  'timberSaleName',
  'landownerType',
  'applicationStatus',
  'decisionDeadline',
  'expirationDate',
  'approvedActivity',
  'notes'
]);

const ACTIVITY_FIELDS = new Set([
  'status',
  'startDate',
  'harvestCompleteDate',
  'activityCompleteDate',
  'comments',
  'reforestationRequired'
]);

const RATE_LIMITS = {
  fpaCreate: { limit: 20, windowMs: 60 * 1000 },
  fpaUpdate: { limit: 60, windowMs: 60 * 1000 },
  fpaDelete: { limit: 20, windowMs: 60 * 1000 },
  renewalWrite: { limit: 30, windowMs: 60 * 1000 },
  activityWrite: { limit: 30, windowMs: 60 * 1000 },
  geminiParse: { limit: 30, windowMs: 60 * 1000 },
  geminiChat: { limit: 30, windowMs: 60 * 1000 },
  accessAdmin: { limit: 60, windowMs: 60 * 1000 },
  accessRequest: { limit: 10, windowMs: 60 * 1000 }
};

const assertAuth = (context) => {
  if (!context.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  return context.auth.uid;
};

const assertAppCheck = (context) => {
  if (!context.app) {
    throw new HttpsError('failed-precondition', 'App Check token required.');
  }
};

const clampString = (value, max = 1000) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
};

const ensureString = (value, field) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${field} must be a string.`);
  }
  return value.trim();
};

const ensureBoolean = (value, field) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') {
    throw new HttpsError('invalid-argument', `${field} must be a boolean.`);
  }
  return value;
};

const pickFields = (data, allowed) => {
  const result = {};
  if (!data || typeof data !== 'object') return result;
  Object.keys(data).forEach((key) => {
    if (allowed.has(key)) {
      result[key] = data[key];
    }
  });
  return result;
};

const sanitizeActivity = (activity) => {
  if (!activity || typeof activity !== 'object') return undefined;
  const cleaned = pickFields(activity, ACTIVITY_FIELDS);
  if ('status' in cleaned) cleaned.status = ensureString(cleaned.status, 'activity.status');
  if ('startDate' in cleaned) cleaned.startDate = ensureString(cleaned.startDate, 'activity.startDate');
  if ('harvestCompleteDate' in cleaned) cleaned.harvestCompleteDate = ensureString(cleaned.harvestCompleteDate, 'activity.harvestCompleteDate');
  if ('activityCompleteDate' in cleaned) cleaned.activityCompleteDate = ensureString(cleaned.activityCompleteDate, 'activity.activityCompleteDate');
  if ('comments' in cleaned) cleaned.comments = ensureString(cleaned.comments, 'activity.comments');
  if ('reforestationRequired' in cleaned) cleaned.reforestationRequired = ensureBoolean(cleaned.reforestationRequired, 'activity.reforestationRequired');
  return cleaned;
};

const sanitizeFpaPayload = (data) => {
  const allowed = new Set([
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
    'activityHistory'
  ]);

  const cleaned = pickFields(data, allowed);

  if ('fpaNumber' in cleaned) cleaned.fpaNumber = ensureString(cleaned.fpaNumber, 'fpaNumber');
  if ('landowner' in cleaned) cleaned.landowner = ensureString(cleaned.landowner, 'landowner');
  if ('timberSaleName' in cleaned) cleaned.timberSaleName = ensureString(cleaned.timberSaleName, 'timberSaleName');
  if ('landownerType' in cleaned) cleaned.landownerType = ensureString(cleaned.landownerType, 'landownerType');
  if ('applicationStatus' in cleaned) cleaned.applicationStatus = ensureString(cleaned.applicationStatus, 'applicationStatus');
  if ('decisionDeadline' in cleaned) cleaned.decisionDeadline = ensureString(cleaned.decisionDeadline, 'decisionDeadline');
  if ('expirationDate' in cleaned) cleaned.expirationDate = ensureString(cleaned.expirationDate, 'expirationDate');
  if ('approvedActivity' in cleaned) cleaned.approvedActivity = ensureString(cleaned.approvedActivity, 'approvedActivity');
  if ('notes' in cleaned) cleaned.notes = ensureString(cleaned.notes, 'notes');
  if ('activity' in cleaned) cleaned.activity = sanitizeActivity(cleaned.activity);
  if ('activityHistory' in cleaned) {
    if (!Array.isArray(cleaned.activityHistory)) {
      throw new HttpsError('invalid-argument', 'activityHistory must be an array.');
    }
  }

  return cleaned;
};

const sanitizeRenewalPayload = (data) => {
  const allowed = new Set(['renewalDate', 'notes']);
  const cleaned = pickFields(data, allowed);
  if ('renewalDate' in cleaned) cleaned.renewalDate = ensureString(cleaned.renewalDate, 'renewalDate');
  if ('notes' in cleaned) cleaned.notes = ensureString(cleaned.notes, 'notes');
  return cleaned;
};

const sanitizeApprovedActivityPayload = (data) => {
  const allowed = new Set([
    'fpaId',
    'status',
    'startDate',
    'harvestCompleteDate',
    'activityCompleteDate',
    'comments',
    'reforestationRequired'
  ]);
  const cleaned = pickFields(data, allowed);
  if ('fpaId' in cleaned) cleaned.fpaId = ensureString(cleaned.fpaId, 'fpaId');
  if ('status' in cleaned) cleaned.status = ensureString(cleaned.status, 'status');
  if ('startDate' in cleaned) cleaned.startDate = ensureString(cleaned.startDate, 'startDate');
  if ('harvestCompleteDate' in cleaned) cleaned.harvestCompleteDate = ensureString(cleaned.harvestCompleteDate, 'harvestCompleteDate');
  if ('activityCompleteDate' in cleaned) cleaned.activityCompleteDate = ensureString(cleaned.activityCompleteDate, 'activityCompleteDate');
  if ('comments' in cleaned) cleaned.comments = ensureString(cleaned.comments, 'comments');
  if ('reforestationRequired' in cleaned) cleaned.reforestationRequired = ensureBoolean(cleaned.reforestationRequired, 'reforestationRequired');
  return cleaned;
};

const toComparableValue = (value) => {
  if (value && typeof value?.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value === undefined) return null;
  return value;
};

const valuesAreEqual = (left, right) => {
  const normalizedLeft = toComparableValue(left);
  const normalizedRight = toComparableValue(right);

  if (
    normalizedLeft &&
    normalizedRight &&
    typeof normalizedLeft === 'object' &&
    typeof normalizedRight === 'object'
  ) {
    try {
      return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
    } catch {
      return false;
    }
  }

  return normalizedLeft === normalizedRight;
};

const checkRateLimit = async (uid, action, limit, windowMs) => {
  const now = Date.now();
  const docId = `${uid}_${action}`;
  const ref = db.collection('rate_limits').doc(docId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, {
        uid,
        action,
        count: 1,
        windowStart: admin.firestore.Timestamp.fromMillis(now)
      });
      return;
    }

    const data = snap.data();
    const windowStart = data.windowStart?.toMillis?.() || 0;
    if (now - windowStart >= windowMs) {
      tx.set(ref, {
        uid,
        action,
        count: 1,
        windowStart: admin.firestore.Timestamp.fromMillis(now)
      }, { merge: true });
      return;
    }

    if ((data.count || 0) >= limit) {
      throw new HttpsError('resource-exhausted', 'Too many requests. Please slow down.');
    }

    tx.update(ref, {
      count: (data.count || 0) + 1
    });
  });
};

const getOwnerData = (snap, uid) => {
  if (!snap.exists) {
    throw new HttpsError('not-found', 'Document not found.');
  }
  const data = snap.data();
  if (data.ownerId && data.ownerId !== uid) {
    throw new HttpsError('permission-denied', 'Not allowed to access this document.');
  }
  if (!data.ownerId && data.userId && data.userId !== uid) {
    throw new HttpsError('permission-denied', 'Not allowed to access this document.');
  }
  return data;
};

const assertAdmin = async (uid) => {
  const accessSnap = await db.collection('user_access').doc(uid).get();
  if (!accessSnap.exists) {
    throw new HttpsError('permission-denied', 'Admin access required.');
  }
  const access = accessSnap.data();
  if (access.status !== 'approved') {
    throw new HttpsError('permission-denied', 'Admin access required.');
  }
  if (access.role !== 'admin' && access.role !== 'super_admin') {
    throw new HttpsError('permission-denied', 'Admin access required.');
  }
  return access;
};

const buildFpaChangeHistory = (currentData, nextData) => {
  const changes = Object.keys(nextData)
    .filter((field) => TRACKED_FPA_FIELDS.has(field))
    .map((field) => ({
      field,
      from: toComparableValue(currentData[field]),
      to: toComparableValue(nextData[field])
    }))
    .filter((entry) => !valuesAreEqual(entry.from, entry.to));

  return changes;
};

const callGemini = async (prompt, temperature = 0.3) => {
  if (!GEMINI_API_KEY) {
    throw new HttpsError('failed-precondition', 'Gemini API key is not configured.');
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024
      }
    })
  });

  if (!response.ok) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch {
      errorData = {};
    }
    logger.error('Gemini API error', { status: response.status, errorData });
    throw new HttpsError('internal', 'Gemini API error.');
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new HttpsError('internal', 'Gemini response missing content.');
  }
  return text.trim();
};

exports.createFpa = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = assertAuth(request);
  const { limit, windowMs } = RATE_LIMITS.fpaCreate;
  await checkRateLimit(uid, 'fpaCreate', limit, windowMs);

  const payload = sanitizeFpaPayload(request.data?.fpaData || {});
  const now = admin.firestore.Timestamp.now();

  const changeHistory = buildFpaChangeHistory({}, payload);

  const docRef = await db.collection('fpas').add({
    ...payload,
    ownerId: uid,
    userId: uid,
    createdAt: now,
    updatedAt: now,
    changeHistory: [
      {
        action: 'created',
        timestamp: now.toDate().toISOString(),
        changes: changeHistory
      }
    ]
  });

  logger.info('FPA created', { uid, fpaId: docRef.id });

  return { id: docRef.id };
});

exports.updateFpa = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = assertAuth(request);
  const { limit, windowMs } = RATE_LIMITS.fpaUpdate;
  await checkRateLimit(uid, 'fpaUpdate', limit, windowMs);

  const fpaId = ensureString(request.data?.fpaId, 'fpaId');
  const payload = sanitizeFpaPayload(request.data?.fpaData || {});

  if (!fpaId) {
    throw new HttpsError('invalid-argument', 'fpaId is required.');
  }

  if (Object.keys(payload).length === 0) {
    throw new HttpsError('invalid-argument', 'No valid fields provided.');
  }

  const fpaRef = db.collection('fpas').doc(fpaId);
  const snap = await fpaRef.get();
  const currentData = getOwnerData(snap, uid);

  const changes = buildFpaChangeHistory(currentData, payload);
  const now = admin.firestore.Timestamp.now();
  const history = Array.isArray(currentData.changeHistory) ? currentData.changeHistory : [];

  const updatePayload = {
    ...payload,
    ownerId: currentData.ownerId || uid,
    userId: currentData.userId || uid,
    updatedAt: now
  };

  if (changes.length > 0) {
    updatePayload.changeHistory = [
      ...history,
      {
        action: 'updated',
        timestamp: now.toDate().toISOString(),
        changes
      }
    ];
  }

  await fpaRef.update(updatePayload);
  logger.info('FPA updated', { uid, fpaId, changes: changes.length });

  return { ok: true };
});

exports.deleteFpa = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = assertAuth(request);
  const { limit, windowMs } = RATE_LIMITS.fpaDelete;
  await checkRateLimit(uid, 'fpaDelete', limit, windowMs);

  const fpaId = ensureString(request.data?.fpaId, 'fpaId');
  if (!fpaId) {
    throw new HttpsError('invalid-argument', 'fpaId is required.');
  }

  const fpaRef = db.collection('fpas').doc(fpaId);
  const snap = await fpaRef.get();
  getOwnerData(snap, uid);

  await fpaRef.delete();
  logger.info('FPA deleted', { uid, fpaId });

  return { ok: true };
});

exports.addRenewal = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = assertAuth(request);
  const { limit, windowMs } = RATE_LIMITS.renewalWrite;
  await checkRateLimit(uid, 'renewalWrite', limit, windowMs);

  const fpaId = ensureString(request.data?.fpaId, 'fpaId');
  if (!fpaId) {
    throw new HttpsError('invalid-argument', 'fpaId is required.');
  }

  const payload = sanitizeRenewalPayload(request.data?.renewalData || {});
  const fpaSnap = await db.collection('fpas').doc(fpaId).get();
  getOwnerData(fpaSnap, uid);

  const now = admin.firestore.Timestamp.now();
  const docRef = await db.collection('renewal_history').add({
    ...payload,
    fpaId,
    ownerId: uid,
    userId: uid,
    createdAt: now,
    updatedAt: now
  });

  logger.info('Renewal created', { uid, renewalId: docRef.id, fpaId });

  return { id: docRef.id };
});

exports.deleteRenewal = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = assertAuth(request);
  const { limit, windowMs } = RATE_LIMITS.renewalWrite;
  await checkRateLimit(uid, 'renewalWrite', limit, windowMs);

  const renewalId = ensureString(request.data?.renewalId, 'renewalId');
  if (!renewalId) {
    throw new HttpsError('invalid-argument', 'renewalId is required.');
  }

  const renewalRef = db.collection('renewal_history').doc(renewalId);
  const snap = await renewalRef.get();
  getOwnerData(snap, uid);

  await renewalRef.delete();
  logger.info('Renewal deleted', { uid, renewalId });

  return { ok: true };
});

exports.addApprovedActivity = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = assertAuth(request);
  const { limit, windowMs } = RATE_LIMITS.activityWrite;
  await checkRateLimit(uid, 'activityWrite', limit, windowMs);

  const payload = sanitizeApprovedActivityPayload(request.data?.activityData || {});
  if (!payload.fpaId) {
    throw new HttpsError('invalid-argument', 'fpaId is required.');
  }

  const fpaSnap = await db.collection('fpas').doc(payload.fpaId).get();
  getOwnerData(fpaSnap, uid);

  const now = admin.firestore.Timestamp.now();
  const docRef = await db.collection('approved_activities').add({
    ...payload,
    ownerId: uid,
    userId: uid,
    createdAt: now,
    updatedAt: now
  });

  logger.info('Approved activity created', { uid, activityId: docRef.id, fpaId: payload.fpaId });

  return { id: docRef.id };
});

exports.updateApprovedActivity = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = assertAuth(request);
  const { limit, windowMs } = RATE_LIMITS.activityWrite;
  await checkRateLimit(uid, 'activityWrite', limit, windowMs);

  const activityId = ensureString(request.data?.activityId, 'activityId');
  const payload = sanitizeApprovedActivityPayload(request.data?.activityData || {});
  if (!activityId) {
    throw new HttpsError('invalid-argument', 'activityId is required.');
  }

  const activityRef = db.collection('approved_activities').doc(activityId);
  const snap = await activityRef.get();
  const currentData = getOwnerData(snap, uid);

  const now = admin.firestore.Timestamp.now();
  await activityRef.update({
    ...payload,
    ownerId: currentData.ownerId || uid,
    userId: currentData.userId || uid,
    updatedAt: now
  });

  logger.info('Approved activity updated', { uid, activityId });

  return { ok: true };
});

exports.deleteApprovedActivity = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = assertAuth(request);
  const { limit, windowMs } = RATE_LIMITS.activityWrite;
  await checkRateLimit(uid, 'activityWrite', limit, windowMs);

  const activityId = ensureString(request.data?.activityId, 'activityId');
  if (!activityId) {
    throw new HttpsError('invalid-argument', 'activityId is required.');
  }

  const activityRef = db.collection('approved_activities').doc(activityId);
  const snap = await activityRef.get();
  getOwnerData(snap, uid);

  await activityRef.delete();
  logger.info('Approved activity deleted', { uid, activityId });

  return { ok: true };
});

exports.requestUserAccess = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = assertAuth(request);
  const { limit, windowMs } = RATE_LIMITS.accessRequest;
  await checkRateLimit(uid, 'accessRequest', limit, windowMs);

  const email = ensureString(request.data?.email, 'email');
  const username = ensureString(request.data?.username, 'username');
  if (!email || !username) {
    throw new HttpsError('invalid-argument', 'email and username are required.');
  }

  const normalizedUsername = username.toLowerCase();
  const existingUsername = await db.collection('user_access')
    .where('usernameLower', '==', normalizedUsername)
    .get();
  if (!existingUsername.empty) {
    throw new HttpsError('already-exists', 'Username is already taken.');
  }

  const approvedAdmins = await db.collection('user_access')
    .where('status', '==', 'approved')
    .where('role', 'in', ['admin', 'super_admin'])
    .get();

  const hasAdmin = !approvedAdmins.empty;
  const accessStatus = hasAdmin ? 'pending' : 'approved';
  const accessRole = hasAdmin ? 'user' : 'admin';

  const now = admin.firestore.Timestamp.now();
  const payload = {
    uid,
    email,
    username,
    usernameLower: normalizedUsername,
    status: accessStatus,
    role: accessRole,
    createdAt: now,
    updatedAt: now,
    ...(accessStatus === 'approved' ? { approvedAt: now } : {})
  };

  await db.collection('user_access').doc(uid).set(payload, { merge: true });
  logger.info('User access requested', { uid, status: accessStatus, role: accessRole });

  return { status: accessStatus, role: accessRole };
});

exports.resolveEmail = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const { limit, windowMs } = RATE_LIMITS.accessRequest;
  const identifier = clampString(request.data?.identifier, 200);
  if (!identifier) {
    throw new HttpsError('invalid-argument', 'Identifier is required.');
  }

  const key = request.auth?.uid || request.app?.appId || 'anonymous';
  await checkRateLimit(key, 'resolveEmail', limit, windowMs);

  if (identifier.includes('@')) {
    return { email: identifier };
  }

  const normalized = identifier.toLowerCase();
  let snapshot = await db.collection('user_access')
    .where('usernameLower', '==', normalized)
    .limit(1)
    .get();

  if (snapshot.empty) {
    snapshot = await db.collection('user_access')
      .where('username', '==', identifier)
      .limit(1)
      .get();
  }

  if (snapshot.empty) {
    throw new HttpsError('not-found', 'Username not found.');
  }

  const data = snapshot.docs[0].data();
  if (!data?.email) {
    throw new HttpsError('not-found', 'No email found for that username.');
  }

  return { email: data.email };
});

exports.listPendingUsers = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = assertAuth(request);
  const { limit, windowMs } = RATE_LIMITS.accessAdmin;
  await checkRateLimit(uid, 'accessAdmin', limit, windowMs);
  await assertAdmin(uid);

  const snapshot = await db.collection('user_access')
    .where('status', '==', 'pending')
    .get();

  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data()
  }));
});

exports.listApprovedUsers = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = assertAuth(request);
  const { limit, windowMs } = RATE_LIMITS.accessAdmin;
  await checkRateLimit(uid, 'accessAdmin', limit, windowMs);
  await assertAdmin(uid);

  const snapshot = await db.collection('user_access')
    .where('status', '==', 'approved')
    .get();

  return snapshot.docs.map((doc) => ({
    uid: doc.id,
    ...doc.data()
  }));
});

exports.approveUser = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = assertAuth(request);
  const { limit, windowMs } = RATE_LIMITS.accessAdmin;
  await checkRateLimit(uid, 'accessAdmin', limit, windowMs);
  await assertAdmin(uid);

  const targetUid = ensureString(request.data?.userId, 'userId');
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'userId is required.');
  }

  const now = admin.firestore.Timestamp.now();
  await db.collection('user_access').doc(targetUid).set({
    status: 'approved',
    approvedAt: now,
    updatedAt: now
  }, { merge: true });

  logger.info('User approved', { uid, targetUid });
  return { ok: true };
});

exports.denyUser = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = assertAuth(request);
  const { limit, windowMs } = RATE_LIMITS.accessAdmin;
  await checkRateLimit(uid, 'accessAdmin', limit, windowMs);
  await assertAdmin(uid);

  const targetUid = ensureString(request.data?.userId, 'userId');
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'userId is required.');
  }

  await db.collection('user_access').doc(targetUid).delete();
  logger.info('User denied', { uid, targetUid });

  return { ok: true };
});

exports.removeUser = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = assertAuth(request);
  const { limit, windowMs } = RATE_LIMITS.accessAdmin;
  await checkRateLimit(uid, 'accessAdmin', limit, windowMs);
  await assertAdmin(uid);

  const targetUid = ensureString(request.data?.userId, 'userId');
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'userId is required.');
  }

  await db.collection('user_access').doc(targetUid).delete();
  logger.info('User removed', { uid, targetUid });

  return { ok: true };
});

exports.syncUserAccess = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = assertAuth(request);
  const { limit, windowMs } = RATE_LIMITS.accessRequest;
  await checkRateLimit(uid, 'accessSync', limit, windowMs);

  const email = request.auth?.token?.email || null;
  const accessRef = db.collection('user_access');

  let snapshot = await accessRef.where('uid', '==', uid).limit(1).get();
  if (snapshot.empty && email) {
    snapshot = await accessRef.where('email', '==', email).limit(1).get();
  }

  if (snapshot.empty) {
    return { migrated: false };
  }

  const docSnap = snapshot.docs[0];
  const data = docSnap.data();

  if (docSnap.id !== uid) {
    await accessRef.doc(uid).set({
      ...data,
      uid,
      updatedAt: admin.firestore.Timestamp.now()
    }, { merge: true });
    await docSnap.ref.delete();
    logger.info('user_access migrated', { uid, previousId: docSnap.id });
    return { migrated: true };
  }

  return { migrated: false };
});

exports.geminiChat = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = request.auth?.uid || 'anonymous';
  const { limit, windowMs } = RATE_LIMITS.geminiChat;
  await checkRateLimit(uid, 'geminiChat', limit, windowMs);

  const userMessage = clampString(request.data?.userMessage, 2000);
  const systemContext = clampString(request.data?.systemContext, 2000) || '';
  const history = Array.isArray(request.data?.conversationHistory)
    ? request.data.conversationHistory.slice(-6)
    : [];

  if (!userMessage) {
    throw new HttpsError('invalid-argument', 'userMessage is required.');
  }

  const historyText = history.map((msg) => {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    const text = clampString(msg.text, 500) || '';
    return `${role}: ${text}`;
  }).join('\n');

  const contextPrompt = systemContext
    ? `Context: You are an AI assistant for an FPA (Forest Practice Applications) Tracker system. ${systemContext}\n\n`
    : '';

  const fullPrompt = `${contextPrompt}${historyText}\nUser: ${userMessage}\nAssistant:`;
  const aiResponse = await callGemini(fullPrompt, 0.7);

  return { response: aiResponse };
});

exports.parseFpaCommand = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = request.auth?.uid || 'anonymous';
  const { limit, windowMs } = RATE_LIMITS.geminiParse;
  await checkRateLimit(uid, 'geminiParse', limit, windowMs);

  const userMessage = clampString(request.data?.userMessage, 2000);
  if (!userMessage) {
    throw new HttpsError('invalid-argument', 'userMessage is required.');
  }

  const systemPrompt = `Parse FPA command and return JSON only:
{
  "intent": "create|update|delete|view|list|navigate|question|unknown",
  "fpaNumber": "number or null",
  "fields": {
    "landowner": "name only",
    "timberSaleName": "name only",
    "landownerType": "Small|Large|null",
    "applicationStatus": "In Decision Window|Approved|Withdrawn|Disapproved|Closed Out|null",
    "approvedActivity": "Not Started|Started|Completed|null",
    "decisionDeadline": "YYYY-MM-DD or null",
    "expirationDate": "YYYY-MM-DD or null",
    "notes": "text or null"
  },
  "response": "friendly message"
}

Extract CLEAN values only:
- FPA numbers: "282-0028" -> "2820028" (remove hyphens/spaces, keep only digits)
- "landowner name brandon" -> "brandon" (remove "name")
- "timbersale called shoot" -> "shoot" (remove "called")
- "note that sale started" -> "Sale started" (remove "that", capitalize)
- "june 4 2039" -> "2039-06-04" (expirationDate or decisionDeadline depending on context)
- "decision deadline june 5 2027" -> decisionDeadline: "2027-06-05"
- "pending" -> status: "In Decision Window", DO NOT set approvedActivity
- "sale is started" -> status: "Approved", approvedActivity: "Started"
- "branden" -> "brandon" (fix misspellings)

User: ${userMessage}`;

  const aiResponse = await callGemini(systemPrompt, 0.3);
  const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { error: 'Could not parse AI response', useRuleBased: true };
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (error) {
    logger.warn('Gemini JSON parse failed', { error: error.message });
    return { error: 'Invalid AI response format', useRuleBased: true };
  }

  if (parsed.fields) {
    if (parsed.fields.landowner) {
      let cleaned = String(parsed.fields.landowner).trim();
      let changed = true;
      while (changed) {
        const before = cleaned;
        cleaned = cleaned.replace(/^(?:name|named|called|is|of|the|a)\s+/i, '').trim();
        changed = before !== cleaned;
      }
      parsed.fields.landowner = cleaned;
    }

    if (parsed.fields.timberSaleName) {
      let cleaned = String(parsed.fields.timberSaleName).trim();
      let changed = true;
      while (changed) {
        const before = cleaned;
        cleaned = cleaned.replace(/^(?:name|named|called|is|of|the|a)\s+/i, '').trim();
        changed = before !== cleaned;
      }
      parsed.fields.timberSaleName = cleaned;
    }

    if (parsed.fields.notes) {
      let cleaned = String(parsed.fields.notes).trim();
      let changed = true;
      while (changed) {
        const before = cleaned;
        cleaned = cleaned
          .replace(/^(?:that\s+the|that\s+a|that)\s+/i, '')
          .replace(/^(?:the|a)\s+/i, '')
          .trim();
        changed = before !== cleaned;
      }
      if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
      parsed.fields.notes = cleaned;
    }
  }

  if (parsed.fpaNumber) {
    parsed.fpaNumber = String(parsed.fpaNumber).replace(/[-\s]/g, '').trim();
  }

  return parsed;
});

exports.backfillOwnerIds = onCall({ enforceAppCheck: true }, async (request) => {
  assertAppCheck(request);
  const uid = assertAuth(request);
  const { limit, windowMs } = RATE_LIMITS.accessAdmin;
  await checkRateLimit(uid, 'accessAdmin', limit, windowMs);
  await assertAdmin(uid);

  const collections = ['fpas', 'approved_activities', 'renewal_history'];
  const dryRun = !!request.data?.dryRun;
  const scanLimit = Math.min(Math.max(Number(request.data?.scanLimit || 1000), 1), 5000);
  const now = admin.firestore.Timestamp.now();

  const results = [];

  for (const collectionName of collections) {
    let scanned = 0;
    let updated = 0;
    let lastDoc = null;

    while (scanned < scanLimit) {
      let query = db.collection(collectionName).orderBy(admin.firestore.FieldPath.documentId()).limit(500);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snapshot = await query.get();
      if (snapshot.empty) break;

      const batch = db.batch();

      snapshot.docs.forEach((docSnap) => {
        if (scanned >= scanLimit) return;
        scanned += 1;
        const data = docSnap.data() || {};
        const ownerId = data.ownerId;
        const userId = data.userId;

        if (!ownerId && userId) {
          if (!dryRun) {
            batch.update(docSnap.ref, {
              ownerId: userId,
              userId,
              updatedAt: data.updatedAt || now
            });
          }
          updated += 1;
        }
      });

      if (!dryRun && updated > 0) {
        await batch.commit();
      }

      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      if (snapshot.docs.length < 500) break;
    }

    results.push({ collection: collectionName, scanned, updated, dryRun });
    logger.info('OwnerId backfill summary', { collectionName, scanned, updated, dryRun });
  }

  return { results };
});

/**
 * Proxy for ArcGIS REST API to bypass CORS restrictions
 * Queries Forest Practices Applications data
 */
exports.arcgisProxy = onCall(
  { region: 'us-west-1', timeoutSeconds: 30 },
  async (request) => {
    const { region, where } = request.data;

    if (!where) {
      throw new HttpsError('invalid-argument', 'WHERE clause is required');
    }

    const ARCGIS_API_URL = 'https://services.arcgis.com/wasde-gis/arcgis/rest/services/Forest_Practices_Applications_FPA/FeatureServer/0/query';

    try {
      const params = new URLSearchParams({
        where: where,
        outFields: '*',
        returnGeometry: true,
        f: 'json'
      });

      logger.info('ArcGIS proxy request', { where });

      const response = await fetch(`${ARCGIS_API_URL}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new HttpsError('internal', `ArcGIS API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new HttpsError('internal', `ArcGIS error: ${data.error.message}`);
      }

      return {
        type: 'FeatureCollection',
        features: (data.features || []).map(feature => ({
          type: 'Feature',
          geometry: feature.geometry,
          properties: feature.attributes
        }))
      };
    } catch (error) {
      logger.error('ArcGIS proxy error', { error: error.message, where });
      throw new HttpsError('internal', `Failed to fetch ArcGIS data: ${error.message}`);
    }
  }
);
