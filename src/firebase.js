import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Thay cấu hình này bằng config của project Firebase của bạn
// Vào Firebase console -> Project settings -> General -> Your apps -> Web app -> Config
const firebaseConfig = {
  apiKey: "AIzaSyCi_C5QOtMK_Hkb8S2l4LzToRClAUnyNuE",
  authDomain: "test-dfc47.firebaseapp.com",
  projectId: "test-dfc47",
  storageBucket: "test-dfc47.firebasestorage.app",
  messagingSenderId: "672757453254",
  appId: "1:672757453254:web:4cbe24d16fb3cb7a0d62c7",
  measurementId: "G-H38S15R55B"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
