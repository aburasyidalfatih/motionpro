-- Gaya bicara bawaan lama sering ikut dibacakan oleh Gemini TTS; kini bawaannya kosong.
UPDATE "Project" SET "voiceStyle" = NULL
WHERE "voiceStyle" = 'Bacakan sebagai narator dokumenter sejarah: suara tenang dan berwibawa, tempo sedang, jeda wajar antar kalimat.';
