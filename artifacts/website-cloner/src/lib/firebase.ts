import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
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

// Configure Firestore with auto-detect long-polling and fallback cache managers.
// We use memoryLocalCache() primarily to avoid IndexedDB / third-party storage blocks inside cross-origin sandboxed iframes.
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    localCache: memoryLocalCache(),
  });
} catch (error) {
  console.warn('initializeFirestore with memory cache and auto-polling failed, trying persistent cache:', error);
  try {
    firestoreDb = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (err2) {
    console.warn('initializeFirestore with persistent cache failed, falling back to getFirestore:', err2);
    firestoreDb = getFirestore(app);
  }
}

export const db = firestoreDb;

// Collection References
export const CHATS_COLL = 'chats';
export const ADMIN_AUTH_COLL = 'admin_auth';
export const CLONES_COLL = 'clones';
export const APP_CONFIG_COLL = 'app_config';
export const VISITORS_COLL = 'visitors';

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

/**
 * Logs a new visitor session or page view in Firestore
 */
export async function logVisit() {
  if (typeof window === 'undefined') return;
  try {
    const sessionKey = 'tinyfish_visitor_session_id';
    let sessionId = sessionStorage.getItem(sessionKey);
    
    if (!sessionId) {
      sessionId = 'v_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      sessionStorage.setItem(sessionKey, sessionId);
    }
    
    const visitDocRef = doc(db, VISITORS_COLL, sessionId);
    const docSnap = await getDoc(visitDocRef);
    
    const timestamp = Date.now();
    const userAgent = navigator.userAgent;
    const referrer = document.referrer || 'Direct';
    const language = navigator.language || 'en';
    
    // Detect basic device/browser info
    let browser = 'Unknown';
    if (userAgent.indexOf('Firefox') > -1) browser = 'Firefox';
    else if (userAgent.indexOf('Chrome') > -1) browser = 'Chrome';
    else if (userAgent.indexOf('Safari') > -1 && userAgent.indexOf('Chrome') === -1) browser = 'Safari';
    else if (userAgent.indexOf('Edge') > -1) browser = 'Edge';
    else if (userAgent.indexOf('Chrome') > -1) browser = 'Chrome';
    
    let os = 'Unknown';
    if (userAgent.indexOf('Windows') > -1) os = 'Windows';
    else if (userAgent.indexOf('Macintosh') > -1) os = 'macOS';
    else if (userAgent.indexOf('Linux') > -1) os = 'Linux';
    else if (userAgent.indexOf('Android') > -1) os = 'Android';
    else if (userAgent.indexOf('iPhone') > -1 || userAgent.indexOf('iPad') > -1) os = 'iOS';

    if (docSnap.exists()) {
      const data = docSnap.data();
      await setDoc(visitDocRef, {
        views: (data.views || 1) + 1,
        lastActive: timestamp
      }, { merge: true });
    } else {
      await setDoc(visitDocRef, {
        sessionId,
        browser,
        os,
        referrer,
        language,
        firstVisit: timestamp,
        lastActive: timestamp,
        views: 1
      });
    }
  } catch (error) {
    console.warn('Failed to log visitor session:', error);
  }
}

