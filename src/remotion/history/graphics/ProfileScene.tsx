import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useBeats } from "../beats";
import { theme } from "../theme";
import type { Profile } from "../types";

// Inisial untuk lencana tokoh, misalnya "Bung Tomo" → "BT".
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^\p{Lu}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("") || name.slice(0, 1).toUpperCase();

// Profil tokoh bergaya berkas intelijen: lencana (potret dari arsip, atau
// inisial) dengan cincin yang berputar, nama, peran, dan masa hidup, lalu
// fakta muncul saat disebut narator.
export function ProfileScene({ profile, portrait = null }: { profile: Profile; portrait?: string | null }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  const nameIn = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const beats = useBeats(
    profile.facts.map((fact) => [fact]),
    { start: 30 },
  );

  return (
    <AbsoluteFill style={{ flexDirection: "row", alignItems: "center", padding: "0 150px", gap: 110 }}>
      <div style={{ position: "relative", width: 420, height: 420, flexShrink: 0, transform: `scale(${enter})` }}>
        <svg width="420" height="420" viewBox="0 0 420 420" style={{ position: "absolute", inset: 0 }}>
          <circle
            cx="210"
            cy="210"
            r="200"
            fill="none"
            stroke={theme.goldStrong}
            strokeWidth="3"
            strokeDasharray="6 14"
            transform={`rotate(${frame * 0.4} 210 210)`}
          />
          <circle cx="210" cy="210" r="172" fill="rgba(10,16,22,0.85)" stroke={theme.gold} strokeWidth="6" />
        </svg>
        {portrait ? (
          <div style={{ position: "absolute", inset: 44, borderRadius: "50%", overflow: "hidden" }}>
            <Img
              src={portrait}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "50% 20%",
                filter: "sepia(0.35) contrast(1.05)",
                transform: `scale(${interpolate(frame, [0, 300], [1.05, 1.15], { extrapolateRight: "clamp" })})`,
              }}
            />
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: theme.serif,
              fontSize: 150,
              fontWeight: 700,
              color: theme.goldStrong,
            }}
          >
            {initials(profile.name)}
          </div>
        )}
      </div>

      <div style={{ flex: 1, fontFamily: theme.sans, color: theme.ink }}>
        <div
          style={{
            fontSize: 30,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: theme.muted,
            opacity: nameIn,
          }}
        >
          {profile.role}
          {profile.years && ` · ${profile.years}`}
        </div>
        <div
          style={{
            fontFamily: theme.serif,
            fontSize: profile.name.length > 22 ? 84 : 104,
            fontWeight: 700,
            lineHeight: 1.05,
            marginTop: 12,
            textShadow: theme.shadow,
            opacity: nameIn,
            transform: `translateX(${interpolate(nameIn, [0, 1], [-40, 0])}px)`,
          }}
        >
          {profile.name}
        </div>
        <div style={{ height: 4, width: 360 * nameIn, background: theme.goldStrong, margin: "32px 0 36px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {profile.facts.map((fact, i) => {
            const factIn = spring({ frame: frame - beats[i], fps, config: { damping: 200 } });
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 20,
                  alignItems: "baseline",
                  fontSize: 40,
                  lineHeight: 1.3,
                  color: theme.inkSoft,
                  opacity: factIn,
                  transform: `translateX(${interpolate(factIn, [0, 1], [30, 0])}px)`,
                }}
              >
                <span style={{ color: theme.goldStrong, fontWeight: 800 }}>▸</span>
                {fact}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}
