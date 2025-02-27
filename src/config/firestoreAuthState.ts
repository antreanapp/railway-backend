import admin from "firebase-admin";

// Definisikan interface untuk session state
interface FirestoreAuthState {
  creds: any;
  keys: any;
}

/**
 * Fungsi rekursif untuk mengonversi objek Buffer-like menjadi Buffer.
 * Fungsi ini akan:
 * - Jika menemukan objek dengan properti "data" berupa array, mencoba mengonversinya menjadi Buffer.
 * - Jika menemukan objek dengan properti "public" yang seharusnya Buffer, mencoba mengonversinya.
 */
function deepReviveBuffers(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(deepReviveBuffers);
  } else if (obj !== null && typeof obj === "object") {
    // Jika objek memiliki properti "data" berupa array, konversi menjadi Buffer
    if (obj.data && Array.isArray(obj.data) && obj.data.every((el: any) => typeof el === "number")) {
      return Buffer.from(obj.data);
    }
    // Jika objek memiliki properti "public" yang tampaknya harus berupa Buffer
    if (obj.public && typeof obj.public === "object" && !Buffer.isBuffer(obj.public)) {
      if (obj.public.data && Array.isArray(obj.public.data) && obj.public.data.every((el: any) => typeof el === "number")) {
        obj.public = Buffer.from(obj.public.data);
      }
    }
    // Rekursif untuk setiap properti
    const newObj: any = {};
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
export async function useFirestoreAuthState(documentId: string): Promise<{ state: FirestoreAuthState, saveCreds: () => Promise<void> }> {
  const db = admin.firestore();
  const docRef = db.collection("whatsappAuthState").doc(documentId);

  let state: FirestoreAuthState;
  const doc = await docRef.get();
  if (doc.exists) {
    state = doc.data() as FirestoreAuthState;
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
      await docRef.set({ keys: state.keys }, { merge: true });
      console.log("State keys telah diinisialisasi ulang.");
    }
  } else {
    state = {
      creds: {},
      keys: {
        preKeys: {},
        sessions: {},
        senderKeyMemory: {},
        appStateSyncKeyData: null,
      },
    };
    await docRef.set(state);
    console.log("Session baru dibuat di Firestore.");
  }

  async function saveCreds(): Promise<void> {
    const cleanedState = deepReviveBuffers(state);
    await docRef.set(cleanedState, { merge: true });
    console.log("Session berhasil disimpan ke Firestore.");
  }

  return { state, saveCreds };
}
