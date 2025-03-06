import makeWASocket, { useMultiFileAuthState, BufferJSON, DisconnectReason } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";
import admin from "../config/firebase"; // Menggunakan Firebase Admin SDK

const db = admin.database();
const sessionRef = db.ref("whatsapp/session"); // Lokasi penyimpanan sesi

// Flag untuk mencegah reconnect berulang
let isReconnecting = false;

// Fungsi untuk memuat sesi dari Firebase
async function loadSession() {
  try {
    const snapshot = await sessionRef.once("value");
    if (snapshot.exists()) {
      console.log("✅ Sesi ditemukan di Firebase.");
      return JSON.parse(snapshot.val(), BufferJSON.reviver);
    } else {
      console.log("⚠️ Tidak ada sesi yang tersimpan. Harap scan ulang.");
      return null;
    }
  } catch (error) {
    console.error("❌ Gagal memuat sesi dari Firebase:", error);
    return null;
  }
}

// Fungsi untuk menyimpan sesi ke Firebase
async function saveSession(session: any) {
  try {
    await sessionRef.set(JSON.stringify(session, BufferJSON.replacer));
    console.log("✅ Sesi berhasil disimpan ke Firebase.");
  } catch (error) {
    console.error("❌ Gagal menyimpan sesi ke Firebase:", error);
  }
}

// Fungsi utama untuk koneksi WhatsApp
async function connectToWhatsApp(): Promise<any> {
  console.log("🔄 Memulai koneksi WhatsApp...");

  const sessionData = await loadSession();
  const { state, saveCreds } = await useMultiFileAuthState("whatsapp/session");

  // Jika sesi ada, gunakan sesi yang tersimpan
  if (sessionData) {
    Object.assign(state.creds, sessionData);
  }

  // Menerapkan opsi koneksi long polling agar tidak menggunakan WebSocket
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // Tidak menampilkan QR di terminal secara otomatis
  });

  // Simpan sesi ke Firebase saat diperbarui
  sock.ev.on("creds.update", async () => {
    await saveCreds();
    await saveSession(state.creds);
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("📌 Scan QR Code ini untuk login:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      let shouldReconnect = true;
      if (lastDisconnect?.error instanceof Boom) {
        const errorPayload = lastDisconnect.error.output.payload;
        if (errorPayload?.message?.toLowerCase().includes("conflict")) {
      console.log("🔴 Conflict error detected. Melakukan logout untuk membersihkan sesi dan mencoba menyambung kembali.");

          try {
            await sock.logout();
            await sessionRef.remove(); // Hapus sesi di Firebase agar scan ulang
          } catch (err) {
            console.error("❌ Error saat logout:", err);
          }
        }
        shouldReconnect = lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut;
      }

      console.log("⚠️ Koneksi terputus, mencoba kembali...", shouldReconnect ? "true" : "false");

      if (shouldReconnect && !isReconnecting) {
        isReconnecting = true;
        setTimeout(async () => {
          try {
            await connectToWhatsAppWithRetry();
          } catch (e) {
            console.error("❌ Reconnect gagal:", e);
          }
          isReconnecting = false;
        }, 60000); // Delay 60 detik sebelum reconnect
      }
    } else if (connection === "open") {
      console.log("✅ WhatsApp terhubung!");
    }
  });

  return sock;
}

// Fungsi untuk mencoba koneksi ulang jika gagal
async function connectToWhatsAppWithRetry(retryCount = 5): Promise<any> {
  try {
    return await connectToWhatsApp();
  } catch (error) {
    if (retryCount > 0) {
      console.error(`❌ Gagal terhubung, mencoba kembali. Sisa percobaan: ${retryCount}`, error);
      await new Promise((resolve) => setTimeout(resolve, 20000));
      return connectToWhatsAppWithRetry(retryCount - 1);
    }
    throw new Error("❌ Gagal terhubung ke WhatsApp setelah beberapa percobaan.");
  }
}

export default connectToWhatsAppWithRetry;
