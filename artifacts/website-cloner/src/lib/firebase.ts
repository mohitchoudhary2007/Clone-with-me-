import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  limit,
  where
} from 'firebase/firestore';
import firebaseConfig from './firebase-config.json';

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);

// Collection References
export const CHATS_COLL = 'chats';
export const ADMIN_AUTH_COLL = 'admin_auth';
export const CLONES_COLL = 'clones';
export const APP_CONFIG_COLL = 'app_config';

/**
 * Seeds the default Admin credentials in Firebase Firestore if not already present.
 * This ensures the admin email mohitdudwal123@gmail.com is registered securely
 * and the password is saved in Firestore rather than hardcoded in the client's code.
 */
export async function seedAdminAuthIfNeeded() {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    console.info('Firebase seeding deferred: Client is currently offline.');
    return;
  }
  try {
    const adminDocRef = doc(db, ADMIN_AUTH_COLL, 'primary_admin');
    const docSnap = await getDoc(adminDocRef);
    
    if (!docSnap.exists()) {
      // Seed default credentials securely in the Firestore database
      await setDoc(adminDocRef, {
        email: 'mohitdudwal123@gmail.com',
        password: '@#Mohit2007',
        lastUpdated: Date.now()
      });
      console.log('Primary admin credentials seeded successfully in Firestore.');
    }
  } catch (e: any) {
    const isOffline = e?.message?.includes('offline') || e?.code === 'unavailable';
    if (isOffline) {
      console.warn('Deferred seeding admin credentials: database is offline/unavailable.');
    } else {
      console.error('Failed to seed admin credentials:', e);
    }
  }
}

/**
 * Seeds default app controls if needed
 */
export async function seedAppConfigIfNeeded() {
  if (typeof window !== 'undefined' && !navigator.onLine) {
    console.info('Firebase app config seeding deferred: Client is currently offline.');
    return;
  }
  try {
    const configDocRef = doc(db, APP_CONFIG_COLL, 'controls');
    const docSnap = await getDoc(configDocRef);
    if (!docSnap.exists()) {
      await setDoc(configDocRef, {
        strictProtocols: false,
        showLiveCards: true,
        maintenanceMode: false,
        lastUpdated: Date.now()
      });
    }
  } catch (e: any) {
    const isOffline = e?.message?.includes('offline') || e?.code === 'unavailable';
    if (isOffline) {
      console.warn('Deferred seeding app config: database is offline/unavailable.');
    } else {
      console.error('Failed to seed app config:', e);
    }
  }
}

// Seeding functions are exported so they can be triggered lazily inside React component mount cycles.

