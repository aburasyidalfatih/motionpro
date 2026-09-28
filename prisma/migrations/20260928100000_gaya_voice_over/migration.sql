-- Gaya bicara yang dipakai saat voice over dibuat, untuk mendeteksi adegan yang
-- suaranya tidak sama dengan pengaturan proyek.
ALTER TABLE "Voiceover" ADD COLUMN "voiceStyle" TEXT;
