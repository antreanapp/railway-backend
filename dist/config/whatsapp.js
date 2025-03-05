"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const boom_1 = require("@hapi/boom");
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const firebase_1 = __importDefault(require("../config/firebase")); // 🔹 Menggunakan Firebase Admin SDK
const db = firebase_1.default.database();
const sessionRef = db.ref("whatsapp/session"); // 🔹 Lokasi penyimpanan sesi di Firebase
// 🔹 Flag global untuk mencegah reconnect berulang
let isReconnecting = false;
// 🔹 Fungsi untuk memuat sesi dari Firebase
function loadSession() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const snapshot = yield sessionRef.once("value");
            if (snapshot.exists()) {
                console.log("✅ Sesi ditemukan di Firebase.");
                return JSON.parse(snapshot.val(), baileys_1.BufferJSON.reviver);
            }
            else {
                console.log("⚠️ Tidak ada sesi yang tersimpan. Harap scan ulang.");
                return null;
            }
        }
        catch (error) {
            console.error("❌ Gagal memuat sesi dari Firebase:", error);
            return null;
        }
    });
}
// 🔹 Fungsi untuk menyimpan sesi ke Firebase
function saveSession(session) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield sessionRef.set(JSON.stringify(session, baileys_1.BufferJSON.replacer));
            console.log("✅ Sesi berhasil disimpan ke Firebase.");
        }
        catch (error) {
            console.error("❌ Gagal menyimpan sesi ke Firebase:", error);
        }
    });
}
// 🔹 Fungsi utama untuk koneksi WhatsApp
function connectToWhatsApp() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("🔄 Memulai koneksi WhatsApp...");
        const sessionData = yield loadSession();
        const { state, saveCreds } = yield (0, baileys_1.useMultiFileAuthState)("./baileys_auth_info"); // Masih perlu untuk state auth
        // 🔹 Jika sesi ada, gunakan sesi yang tersimpan
        if (sessionData) {
            Object.assign(state.creds, sessionData);
        }
        const sock = (0, baileys_1.default)({
            auth: state,
            printQRInTerminal: false, // Tidak menampilkan QR di terminal secara otomatis
        });
        // 🔹 Menyimpan sesi ke Firebase saat diperbarui
        sock.ev.on("creds.update", () => __awaiter(this, void 0, void 0, function* () {
            yield saveCreds();
            yield saveSession(state.creds);
        }));
        sock.ev.on("connection.update", (update) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { connection, lastDisconnect, qr } = update;
            if (qr) {
                console.log("📌 Scan QR Code ini untuk login:");
                qrcode_terminal_1.default.generate(qr, { small: true });
            }
            if (connection === "close") {
                let shouldReconnect = true;
                if ((lastDisconnect === null || lastDisconnect === void 0 ? void 0 : lastDisconnect.error) instanceof boom_1.Boom) {
                    const errorPayload = lastDisconnect.error.output.payload;
                    if ((_a = errorPayload === null || errorPayload === void 0 ? void 0 : errorPayload.message) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes("conflict")) {
                        console.log("🔴 Conflict error detected. Melakukan logout untuk membersihkan sesi.");
                        try {
                            yield sock.logout();
                            yield sessionRef.remove(); // Hapus sesi di Firebase agar scan ulang
                            console.log("✅ Sesi berhasil dihapus dari Firebase.");
                        }
                        catch (err) {
                            console.error("❌ Error saat logout:", err);
                        }
                    }
                    shouldReconnect = lastDisconnect.error.output.statusCode !== baileys_1.DisconnectReason.loggedOut;
                }
                console.log("⚠️ Koneksi terputus, mencoba kembali...", shouldReconnect);
                if (shouldReconnect && !isReconnecting) {
                    isReconnecting = true;
                    setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                        try {
                            console.log("🔄 Mencoba koneksi ulang...");
                            yield connectToWhatsAppWithRetry();
                        }
                        catch (e) {
                            console.error("❌ Reconnect gagal:", e);
                        }
                        isReconnecting = false;
                    }), 10000); // Delay 10 detik sebelum reconnect
                }
            }
            else if (connection === "open") {
                console.log("✅ WhatsApp terhubung!");
            }
        }));
        return sock;
    });
}
// 🔹 Fungsi untuk mencoba koneksi ulang jika gagal
function connectToWhatsAppWithRetry() {
    return __awaiter(this, arguments, void 0, function* (retryCount = 5) {
        try {
            return yield connectToWhatsApp();
        }
        catch (error) {
            if (retryCount > 0) {
                console.error(`❌ Gagal terhubung, mencoba kembali. Sisa percobaan: ${retryCount}`, error);
                yield new Promise((resolve) => setTimeout(resolve, 5000));
                return connectToWhatsAppWithRetry(retryCount - 1);
            }
            throw new Error("❌ Gagal terhubung ke WhatsApp setelah beberapa percobaan.");
        }
    });
}
exports.default = connectToWhatsAppWithRetry;
