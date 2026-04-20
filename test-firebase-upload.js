import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import dotenv from 'dotenv';
dotenv.config({ path: './client/.env' });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

async function testUpload() {
  try {
    const fileRef = ref(storage, 'test-images/test.txt');
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const snapshot = await uploadBytes(fileRef, bytes, { contentType: 'text/plain' });
    const url = await getDownloadURL(snapshot.ref);
    console.log("Upload Success! URL:", url);
  } catch (err) {
    console.error("Upload Failed:", err.message);
  }
}

testUpload();
