import { initializeApp, getApps, getApp } from 'firebase/app';

try {
  const configStr = process.env.VITE_FIREBASE_CONFIG || "{}";
  const config = JSON.parse(configStr);
  if (Object.keys(config).length > 0) {
    getApps().length === 0 ? initializeApp(config) : getApp();
  }
} catch (e) {
  console.warn("Firebase Init Error:", e);
}
