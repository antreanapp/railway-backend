// Global error handling untuk menangkap error yang tidak tertangani
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

import { Request, Response, Router } from "express";
import admin from "../config/firebase";
import connectToWhatsApp from "../config/whatsapp";

const router = Router();

// 🔹 Simpan sesi WhatsApp agar tidak membuat koneksi baru setiap kali ada request
let sock: any = null;

// 🔹 Fungsi untuk memastikan koneksi tetap aktif
async function getWhatsAppConnection() {
  if (!sock) {
    sock = await connectToWhatsApp();
  }
  return sock;
}

// 🔹 Fungsi untuk mengirim OTP dengan retry jika gagal
async function sendOtpMessage(phoneNumber: string, otpCode: string, retryCount = 3): Promise<boolean> {
  const sock = await getWhatsAppConnection();
  
  for (let i = 0; i < retryCount; i++) {
    try {
      await sock.sendMessage(`${phoneNumber}@s.whatsapp.net`, { text: `Kode OTP Anda: ${otpCode}` });
      console.log("✅ OTP berhasil dikirim ke:", phoneNumber);
      return true;
    } catch (error: any) {
      console.error(`❌ Error mengirim OTP (percobaan ${i + 1}/${retryCount}):`, error.message);

      // Jika error mengandung "timeout", anggap pesan terkirim
      if (error.message && error.message.toLowerCase().includes("timeout")) {
        console.warn("⚠️ Timeout terjadi, tetapi pesan kemungkinan terkirim.");
        return true;
      }

      // Jika error karena koneksi terputus atau conflict, reinitialize koneksi
      if (error.message && (error.message.includes("connection closed") || error.message.includes("conflict"))) {
        console.log("🔄 Reconnecting WhatsApp...");
        let sock = await connectToWhatsApp();
      }

      // Tunggu sebelum mencoba lagi
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }

  console.error("❌ Gagal mengirim OTP setelah beberapa percobaan.");
  return false;
}

// 🔹 Endpoint untuk mengirim OTP
const sendOtpHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      res.status(400).json({ error: "Nomor telepon harus diisi" });
      return;
    }

    // 🔹 Buat kode OTP 6 digit
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`📩 OTP untuk ${phoneNumber}: ${otpCode}`);

    const otpRef = admin.firestore().collection("otp").doc(phoneNumber);

    // 🔹 Cek apakah OTP sebelumnya masih berlaku (batas 4 menit)
    const existingOtp = await otpRef.get();
    if (existingOtp.exists) {
      const data = existingOtp.data();
      const createdAt = data?.createdAt?.toDate();
      const now = new Date();
      if (createdAt && now.getTime() - createdAt.getTime() < 4 * 60 * 1000) {
        res.status(429).json({ error: "OTP sudah dikirim, tunggu beberapa menit sebelum meminta lagi." });
        return;
      }
    }

    // 🔹 Simpan OTP ke Firestore dengan timestamp
    await otpRef.set({
      otp: otpCode,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2 * 60 * 1000)) // 2 menit kedaluwarsa
    });

    // 🔹 Kirim OTP via WhatsApp dengan retry
    const sent = await sendOtpMessage(phoneNumber, otpCode);
    if (!sent) {
      res.status(500).json({ error: "Gagal mengirim OTP setelah beberapa percobaan." });
      return;
    }

    res.json({ success: true, message: "OTP terkirim!" });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: "Gagal mengirim OTP" });
  }
};

// 🔹 Endpoint untuk verifikasi OTP
const verifyOtpHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phoneNumber, otp } = req.body;
    console.log("Nomor Telepon:", phoneNumber);
    console.log("OTP:", otp);
    if (!phoneNumber || !otp) {
      res.status(400).json({ error: "Nomor telepon dan OTP harus diisi." });
      return;
    }

    const otpRef = admin.firestore().collection("otp").doc(phoneNumber);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      res.status(400).json({ error: "OTP tidak ditemukan. Mohon minta OTP terlebih dahulu." });
      return;
    }

    const data = otpDoc.data();
    const storedOtp = data?.otp;
    const createdAt = data?.createdAt?.toDate();
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
    await otpRef.delete();

    res.json({ success: true, message: "OTP valid!" });
  } catch (error) {
    console.error("❌ Error:", error);
    res.status(500).json({ error: "Gagal memverifikasi OTP" });
  }
};

// 🔹 Register endpoint ke router
router.post("/send-otp", sendOtpHandler);
router.post("/verify-otp", verifyOtpHandler);

export default router;
