import { Config } from "@remotion/cli/config";

// Konfigurasi Remotion Studio dan CLI render. Lihat PRD: H.264, kualitas tinggi.
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
Config.setCrf(18);
Config.setOverwriteOutput(true);
