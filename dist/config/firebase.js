"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error("Environment variable FIREBASE_SERVICE_ACCOUNT belum diatur.");
}
let serviceAccount;
// Jika variabel mulai dengan '{', anggap itu JSON biasa
if (process.env.FIREBASE_SERVICE_ACCOUNT.trim().startsWith("{")) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
}
else {
    // Jika tidak, asumsikan nilainya adalah Base64
    serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf-8"));
}
firebase_admin_1.default.initializeApp({
    credential: firebase_admin_1.default.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL, // Pastikan sudah diatur di .env
});
exports.default = firebase_admin_1.default;
