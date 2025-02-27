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
// Global error handling untuk menangkap error yang tidak tertangani
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
});
const express_1 = require("express");
const firebase_1 = __importDefault(require("../config/firebase"));
const whatsapp_1 = __importDefault(require("../config/whatsapp"));
const router = (0, express_1.Router)();
// 🔹 Simpan sesi WhatsApp agar tidak membuat koneksi baru setiap kali ada request
let sock = null;
// 🔹 Fungsi untuk memastikan koneksi tetap aktif
function getWhatsAppConnection() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!sock) {
            sock = yield (0, whatsapp_1.default)();
        }
        return sock;
    });
}
// 🔹 Fungsi untuk mengirim OTP dengan retry jika gagal
function sendOtpMessage(phoneNumber_1, otpCode_1) {
    return __awaiter(this, arguments, void 0, function* (phoneNumber, otpCode, retryCount = 3) {
        const sock = yield getWhatsAppConnection();
        for (let i = 0; i < retryCount; i++) {
            try {
                yield sock.sendMessage(`${phoneNumber}@s.whatsapp.net`, { text: `Kode OTP Anda: ${otpCode}` });
                console.log("✅ OTP berhasil dikirim ke:", phoneNumber);
                return true;
            }
            catch (error) {
                console.error(`❌ Error mengirim OTP (percobaan ${i + 1}/${retryCount}):`, error.message);
                // Jika error mengandung "timeout", anggap pesan terkirim
                if (error.message && error.message.toLowerCase().includes("timeout")) {
                    console.warn("⚠️ Timeout terjadi, tetapi pesan kemungkinan terkirim.");
                    return true;
                }
                // Jika error karena koneksi terputus atau conflict, reinitialize koneksi
                if (error.message && (error.message.includes("connection closed") || error.message.includes("conflict"))) {
                    console.log("🔄 Reconnecting WhatsApp...");
                    let sock = yield (0, whatsapp_1.default)();
                }
                // Tunggu sebelum mencoba lagi
                yield new Promise((resolve) => setTimeout(resolve, 5000));
            }
        }
        console.error("❌ Gagal mengirim OTP setelah beberapa percobaan.");
        return false;
    });
}
// 🔹 Endpoint untuk mengirim OTP
const sendOtpHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            res.status(400).json({ error: "Nomor telepon harus diisi" });
            return;
        }
        // 🔹 Buat kode OTP 6 digit
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`📩 OTP untuk ${phoneNumber}: ${otpCode}`);
        const otpRef = firebase_1.default.firestore().collection("otp").doc(phoneNumber);
        // 🔹 Cek apakah OTP sebelumnya masih berlaku (batas 4 menit)
        const existingOtp = yield otpRef.get();
        if (existingOtp.exists) {
            const data = existingOtp.data();
            const createdAt = (_a = data === null || data === void 0 ? void 0 : data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate();
            const now = new Date();
            if (createdAt && now.getTime() - createdAt.getTime() < 4 * 60 * 1000) {
                res.status(429).json({ error: "OTP sudah dikirim, tunggu beberapa menit sebelum meminta lagi." });
                return;
            }
        }
        // 🔹 Simpan OTP ke Firestore dengan timestamp
        yield otpRef.set({
            otp: otpCode,
            createdAt: firebase_1.default.firestore.FieldValue.serverTimestamp(),
            expiresAt: firebase_1.default.firestore.Timestamp.fromDate(new Date(Date.now() + 2 * 60 * 1000)) // 2 menit kedaluwarsa
        });
        // 🔹 Kirim OTP via WhatsApp dengan retry
        const sent = yield sendOtpMessage(phoneNumber, otpCode);
        if (!sent) {
            res.status(500).json({ error: "Gagal mengirim OTP setelah beberapa percobaan." });
            return;
        }
        res.json({ success: true, message: "OTP terkirim!" });
    }
    catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ error: "Gagal mengirim OTP" });
    }
});
// 🔹 Endpoint untuk verifikasi OTP
const verifyOtpHandler = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { phoneNumber, otp } = req.body;
        if (!phoneNumber || !otp) {
            res.status(400).json({ error: "Nomor telepon dan OTP harus diisi." });
            return;
        }
        const otpRef = firebase_1.default.firestore().collection("otp").doc(phoneNumber);
        const otpDoc = yield otpRef.get();
        if (!otpDoc.exists) {
            res.status(400).json({ error: "OTP tidak ditemukan. Mohon minta OTP terlebih dahulu." });
            return;
        }
        const data = otpDoc.data();
        const storedOtp = data === null || data === void 0 ? void 0 : data.otp;
        const createdAt = (_a = data === null || data === void 0 ? void 0 : data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate();
        const now = new Date();
        // 🔹 Cek apakah OTP telah kedaluwarsa (lebih dari 4 menit)
        if (!createdAt || now.getTime() - createdAt.getTime() > 4 * 60 * 1000) {
            res.status(400).json({ error: "OTP telah kedaluwarsa. Mohon minta OTP baru." });
            return;
        }
        // 🔹 Cek kecocokan OTP
        if (storedOtp !== otp) {
            res.status(400).json({ error: "OTP salah. Silakan coba lagi." });
            return;
        }
        // 🔹 OTP valid, hapus dari Firestore agar tidak bisa digunakan ulang
        yield otpRef.delete();
        res.json({ success: true, message: "OTP valid!" });
    }
    catch (error) {
        console.error("❌ Error:", error);
        res.status(500).json({ error: "Gagal memverifikasi OTP" });
    }
});
// 🔹 Register endpoint ke router
router.post("/send-otp", sendOtpHandler);
router.post("/verify-otp", verifyOtpHandler);
exports.default = router;
