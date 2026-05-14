import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle() {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Error signing in with Google", error);
        throw error;
    }
}

export async function signOutUser() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error signing out", error);
        throw error;
    }
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
