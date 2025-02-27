"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/scripts/upload-session.ts
const baileys_1 = require("@whiskeysockets/baileys");
const firebase_1 = __importDefault(require("../config/firebase")); // Sesuaikan path dengan file firebase.ts Anda
const path_1 = __importDefault(require("path"));
const cleanData_1 = require("../utils/cleanData"); // Sesuaikan path jika perlu
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Tentukan direktori tempat sesi disimpan; sesuaikan path sesuai proyek Anda
const sessionDir = path_1.default.resolve(__dirname, "../../session"); // Misalnya, folder "session" di root
function uploadSessionToFirestore() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Ambil state dari direktori session menggunakan useMultiFileAuthState
            const { state } = yield (0, baileys_1.useMultiFileAuthState)(sessionDir);
            // Bersihkan state dari properti undefined dan fungsi
            const cleanedState = (0, cleanData_1.cleanData)(state);
            // Upload cleanedState ke Firestore pada koleksi 'whatsappAuthState' dengan dokumen ID 'session'
            yield firebase_1.default.firestore().collection("whatsappAuthState").doc("session").set(cleanedState);
            console.log("State lokal:", JSON.stringify(state, null, 2));
            console.log("Session berhasil diupload ke Firestore.");
        }
        catch (error) {
            console.error("Gagal mengupload session:", error);
        }
    });
}
uploadSessionToFirestore();
