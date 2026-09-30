import { ApiError } from "@google/genai";
import sharp from "sharp";
import { fatalError, geminiClient } from "./client";

// Ilustrasi sinematik buatan AI untuk momen kunci (cold open, klimaks) yang
// tidak bisa digambarkan dengan grafik dan tidak punya arsip. Gaya dikunci di
// sini agar semua ilustrasi dalam satu video terlihat seperti satu seri.

const DEFAULT_MODEL = "gemini-2.5-flash-image";

export function imageModel() {
  return process.env.GEMINI_IMAGE_MODEL || DEFAULT_MODEL;
}

const STYLE = [
  "Epic historical oil painting in the style of 19th-century military art, cinematic composition,",
  "dramatic volumetric lighting, muted earthy palette with warm gold highlights, atmospheric haze,",
  "historically accurate clothing, weapons, ships and architecture for the era,",
  "wide 16:9 frame, no text, no letters, no captions, no watermark, no borders, no modern objects.",
].join(" ");

export function illustrationPrompt(prompt: string, topic: string) {
  return `${STYLE}\nContext: a documentary about "${topic}".\nScene: ${prompt}`;
}

// Gambar pengganti untuk mode tiruan: gradasi hangat tanpa memanggil API.
function placeholder(prompt: string) {
  const hue = [...prompt].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 50, 15);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
<defs><radialGradient id="g" cx="40%" cy="40%" r="80%"><stop offset="0%" stop-color="hsl(${hue},55%,55%)"/><stop offset="100%" stop-color="hsl(${hue},40%,12%)"/></radialGradient></defs>
<rect width="1920" height="1080" fill="url(#g)"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Model yang tidak menerima imageSize dipanggil tanpanya.
let sizeUnsupported = false;

export async function generateIllustration(prompt: string, topic: string): Promise<Buffer> {
  if (process.env.AI_PROVIDER === "fake") return placeholder(prompt);
  const model = imageModel();
  const request = (withSize: boolean) =>
    geminiClient().generate(model, {
      contents: illustrationPrompt(prompt, topic),
      config: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio: "16:9", ...(withSize ? { imageSize: "2K" } : {}) },
      },
    });
  let response;
  try {
    response = await request(!sizeUnsupported);
  } catch (err) {
    if (sizeUnsupported || !(err instanceof ApiError && err.status === 400 && /size/i.test(err.message))) {
      throw fatalError(err, model);
    }
    sizeUnsupported = true;
    response = await request(false).catch((retryErr) => {
      throw fatalError(retryErr, model);
    });
  }
  const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) {
    // Model menolak (misalnya kebijakan keamanan) atau hanya menjawab teks.
    throw new Error(`Gemini tidak mengembalikan gambar${response.text ? `: ${response.text.slice(0, 200)}` : ""}`);
  }
  return Buffer.from(part.inlineData.data, "base64");
}
