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
exports.useFirestoreAuthState = useFirestoreAuthState;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
/**
 * Fungsi rekursif untuk mengonversi objek Buffer-like menjadi Buffer.
 * Fungsi ini akan:
 * - Jika menemukan objek dengan properti "data" berupa array, mencoba mengonversinya menjadi Buffer.
 * - Jika menemukan objek dengan properti "public" yang seharusnya Buffer, mencoba mengonversinya.
 */
function deepReviveBuffers(obj) {
    if (Array.isArray(obj)) {
        return obj.map(deepReviveBuffers);
    }
    else if (obj !== null && typeof obj === "object") {
        // Jika objek memiliki properti "data" berupa array, konversi menjadi Buffer
        if (obj.data && Array.isArray(obj.data) && obj.data.every((el) => typeof el === "number")) {
            return Buffer.from(obj.data);
        }
        // Jika objek memiliki properti "public" yang tampaknya harus berupa Buffer
        if (obj.public && typeof obj.public === "object" && !Buffer.isBuffer(obj.public)) {
            if (obj.public.data && Array.isArray(obj.public.data) && obj.public.data.every((el) => typeof el === "number")) {
                obj.public = Buffer.from(obj.public.data);
            }
        }
        // Rekursif untuk setiap properti
        const newObj = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                newObj[key] = deepReviveBuffers(obj[key]);
            }
        }
        return newObj;
    }
    return obj;
}
/**
 * Fungsi untuk mengambil dan menyimpan auth state ke Firestore.
 * Fungsi ini memanggil deepReviveBuffers untuk memastikan bahwa properti yang seharusnya Buffer dikonversi kembali.
 */
function useFirestoreAuthState(documentId) {
    return __awaiter(this, void 0, void 0, function* () {
        const db = firebase_admin_1.default.firestore();
        const docRef = db.collection("whatsappAuthState").doc(documentId);
        let state;
        const doc = yield docRef.get();
        if (doc.exists) {
            state = doc.data();
            console.log("Session ditemukan di Firestore.");
            state = deepReviveBuffers(state);
            // Jika bagian keys kosong, inisialisasi ulang bagian keys saja tanpa mengubah creds.
            if (!state.keys || Object.keys(state.keys).length === 0) {
                console.warn("Field keys kosong, menginisialisasi ulang keys.");
                state.keys = {
                    preKeys: {},
                    sessions: {},
                    senderKeyMemory: {},
                    appStateSyncKeyData: null,
                };
                yield docRef.set({ keys: state.keys }, { merge: true });
                console.log("State keys telah diinisialisasi ulang.");
            }
        }
        else {
            state = {
                creds: {},
                keys: {
                    preKeys: {},
                    sessions: {},
                    senderKeyMemory: {},
                    appStateSyncKeyData: null,
                },
            };
            yield docRef.set(state);
            console.log("Session baru dibuat di Firestore.");
        }
        function saveCreds() {
            return __awaiter(this, void 0, void 0, function* () {
                const cleanedState = deepReviveBuffers(state);
                yield docRef.set(cleanedState, { merge: true });
                console.log("Session berhasil disimpan ke Firestore.");
            });
        }
        return { state, saveCreds };
    });
}
