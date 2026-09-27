import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type TitleCardProps = {
  title: string;
  subtitle: string;
  era: string;
};

// Kartu judul bergaya dokumenter sejarah: latar perkamen gelap yang perlahan
// di-zoom (efek ken-burns), label era, judul, dan subjudul yang masuk bertahap.
// Semua animasi dihitung dari nomor frame agar hasil render deterministik.
export function TitleCard({ title, subtitle, era }: TitleCardProps) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.08]);
  const fadeOut = interpolate(
    frame,
    [durationInFrames - fps * 0.5, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp" },
  );

  const eraIn = spring({ frame, fps, config: { damping: 200 } });
  const titleIn = spring({ frame: frame - fps * 0.4, fps, config: { damping: 200 } });
  const subtitleIn = spring({ frame: frame - fps * 0.9, fps, config: { damping: 200 } });
  const ruleWidth = interpolate(titleIn, [0, 1], [0, 480]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#120d08", opacity: fadeOut }}>
      <AbsoluteFill
        style={{
          transform: `scale(${zoom})`,
          background:
            "radial-gradient(ellipse at 30% 35%, #6b4a2b 0%, #3a2616 45%, #120d08 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          // Vignette agar teks tetap terbaca di atas latar yang bergerak.
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.65) 100%)",
        }}
      />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "Georgia, 'Times New Roman', serif",
          color: "#f3e6cf",
          textAlign: "center",
          padding: 120,
        }}
      >
        <div
          style={{
            fontSize: 34,
            letterSpacing: 12,
            textTransform: "uppercase",
            color: "#d6b98c",
            opacity: eraIn,
            transform: `translateY(${interpolate(eraIn, [0, 1], [20, 0])}px)`,
          }}
        >
          {era}
        </div>
        <h1
          style={{
            fontSize: 112,
            fontWeight: 700,
            lineHeight: 1.05,
            margin: "28px 0",
            opacity: titleIn,
            transform: `translateY(${interpolate(titleIn, [0, 1], [40, 0])}px)`,
          }}
        >
          {title}
        </h1>
        <div style={{ height: 3, width: ruleWidth, backgroundColor: "#b8894d" }} />
        <div
          style={{
            fontSize: 42,
            marginTop: 32,
            fontStyle: "italic",
            color: "#e2d3b8",
            opacity: subtitleIn,
          }}
        >
          {subtitle}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
