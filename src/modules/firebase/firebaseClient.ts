import admin from 'firebase-admin';
import fs from 'node:fs';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';

let appInstance: admin.app.App | null = null;
let firestoreDb: admin.firestore.Firestore | null = null;
let isRealFirebase = false;

export function initFirebase(): { db: admin.firestore.Firestore; isReal: boolean } {
  if (firestoreDb) {
    return { db: firestoreDb, isReal: isRealFirebase };
  }

  try {
    let credential: admin.credential.Credential | undefined;

    if (config.FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(config.FIREBASE_SERVICE_ACCOUNT_PATH)) {
      logger.info({ path: config.FIREBASE_SERVICE_ACCOUNT_PATH }, 'Initializing Firebase Admin with service account file');
      credential = admin.credential.cert(config.FIREBASE_SERVICE_ACCOUNT_PATH);
    } else if (config.FIREBASE_CLIENT_EMAIL && config.FIREBASE_PRIVATE_KEY) {
      logger.info({ clientEmail: config.FIREBASE_CLIENT_EMAIL }, 'Initializing Firebase Admin with environment credentials');
      credential = admin.credential.cert({
        projectId: config.FIREBASE_PROJECT_ID,
        clientEmail: config.FIREBASE_CLIENT_EMAIL,
        privateKey: config.FIREBASE_PRIVATE_KEY
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      logger.info('Initializing Firebase Admin with GOOGLE_APPLICATION_CREDENTIALS');
      credential = admin.credential.applicationDefault();
    }

    if (credential) {
      appInstance = admin.initializeApp({
        credential,
        projectId: config.FIREBASE_PROJECT_ID,
        databaseURL: config.FIREBASE_DATABASE_URL
      });
      firestoreDb = admin.firestore(appInstance);
      isRealFirebase = true;
      logger.info('Firebase Admin successfully connected to Cloud Firestore');
      return { db: firestoreDb, isReal: true };
    }
  } catch (error: any) {
    logger.warn({ error: error.message }, 'Failed to initialize real Firebase connection. Falling back to in-memory store.');
  }

  logger.warn('Firebase credentials not provided. Using embedded Firestore-compatible mock repository for development.');
  isRealFirebase = false;
  return { db: null as any, isReal: false };
}

export function getFirestoreDb(): admin.firestore.Firestore | null {
  return firestoreDb;
}

export function isRealFirebaseConfigured(): boolean {
  return isRealFirebase;
}
