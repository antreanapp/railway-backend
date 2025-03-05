import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import otpRoutes from "./routes/otp";
import connectToWhatsApp from "./config/whatsapp";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", otpRoutes);

const PORT = Number(process.env.PORT) || 3000;
connectToWhatsApp();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server berjalan di port ${PORT}`);
});
