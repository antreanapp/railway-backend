import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  throw new Error("Environment variable FIREBASE_SERVICE_ACCOUNT belum diatur.");
}

let serviceAccount;

// Jika variabel mulai dengan '{', anggap itu JSON biasa
if (process.env.FIREBASE_SERVICE_ACCOUNT.trim().startsWith("{")) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  // Jika tidak, asumsikan nilainya adalah Base64
  serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf-8")
  );
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL, // Pastikan sudah diatur di .env
});

export default admin;
