import { HtmlInCanvasMotionBlur } from "@remotion/motion-blur";
import {
  AbsoluteFill,
  Easing,
  Html5Audio,
  interpolate,
  isHtmlInCanvasSupported,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { beatFrames, popCues, SceneSpeechContext } from "./beats";
import { FilmGrain, GRADE_FILTER, GradeOverlay, LightLeakFlash } from "./finishing";
import { Backdrop, Heading } from "./graphics/Backdrop";
import { ChartScene } from "./graphics/ChartScene";
import { ComparisonScene } from "./graphics/ComparisonScene";
import { KineticText } from "./graphics/KineticText";
import { ProfileScene } from "./graphics/ProfileScene";
import { QuoteScene } from "./graphics/QuoteScene";
import { StatScene } from "./graphics/StatScene";
import { TimelineScene } from "./graphics/TimelineScene";
import { MapLayer } from "./MapLayer";
import { ChapterOverlay, LabelOverlay, Subtitles, TimelineBadge, TitleOverlay } from "./overlays";
import { theme } from "./theme";
import {
  chapterNumbers,
  CROSSFADE_FRAMES,
  END_HOLD_FRAMES,
  FPS,
  sceneTimings,
  speechRanges,
  transitionFor,
  type TransitionKind,
} from "./timing";
import type { HistoryVideoProps, SceneProps } from "./types";
import { CinematicParticles, FallbackLayer, FootageLayer, ImageLayer, Vignette } from "./visuals";

const MUSIC_VOLUME = 0.22;
const MUSIC_DUCKED = 0.07;
const DUCK_FADE_FRAMES = 10;
// Pergantian musik antarbab: trek lama mengecil sementara trek baru membesar.
const MUSIC_CROSSFADE_FRAMES = 2 * FPS;

// Efek suara dipilih bergantian dari beberapa file sejenis agar tidak berulang persis.
const pick = (files: string[], i: number) => (files.length ? files[i % files.length] : null);

type Graphic = { layer: React.ReactNode; heading: boolean };

// Visual grafis sesuai tipe adegan, atau null bila datanya tidak ada.
function graphicFor(scene: SceneProps, mapIntro: boolean): Graphic | null {
  const g = scene.graphic;
  switch (scene.visualType) {
    case "map":
      return g.map?.points.length ? { layer: <MapLayer map={g.map} intro={mapIntro} />, heading: false } : null;
    case "kinetic_text":
      return g.kinetic?.lines.length ? { layer: <KineticText {...g.kinetic} />, heading: false } : null;
    case "timeline":
      return g.events?.length ? { layer: <TimelineScene events={g.events} />, heading: true } : null;
    case "stat":
      return g.stats?.length ? { layer: <StatScene stats={g.stats} />, heading: true } : null;
    case "comparison":
      return g.comparison ? { layer: <ComparisonScene comparison={g.comparison} />, heading: false } : null;
    case "quote":
      return g.quote ? { layer: <QuoteScene {...g.quote} />, heading: false } : null;
    case "chart":
      return g.chart?.bars.length ? { layer: <ChartScene chart={g.chart} />, heading: true } : null;
    case "profile":
      return g.profile ? { layer: <ProfileScene profile={g.profile} />, heading: false } : null;
    default:
      return null;
  }
}

// Gaya transisi masuk adegan pada progres p (0 → 1).
function transitionStyle(kind: TransitionKind | null, p: number): React.CSSProperties {
  if (kind === null || p >= 1) return {};
  switch (kind) {
    case "slide":
      return { transform: `translateX(${(1 - p) * 100}%)` };
    case "zoom":
      return { opacity: p, transform: `scale(${1.25 - 0.25 * p})` };
    case "wipe":
      return { clipPath: `inset(0 ${(1 - p) * 100}% 0 0)` };
    default:
      return { opacity: p };
  }
}

function SceneVisual({
  scene,
  index,
  title,
  chapter,
  transition,
  graphicStyle,
  mapIntro,
}: {
  scene: SceneProps;
  index: number;
  title: string;
  chapter: number | null;
  transition: TransitionKind | null;
  graphicStyle: boolean;
  mapIntro: boolean;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = interpolate(frame, [0, CROSSFADE_FRAMES], [0, 1], {
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const graphic = graphicFor(scene, mapIntro);
  const headingIn = interpolate(frame, [4, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Grafik terus mendekat perlahan sepanjang adegan agar layar tidak pernah diam.
  const drift = interpolate(frame, [0, durationInFrames], [1, 1.045]);

  // Peta menggambar latarnya sendiri; tipe grafis lain di atas latar navy.
  let background;
  if (graphic) background = scene.visualType === "map" ? null : <Backdrop />;
  else if (scene.asset?.kind === "VIDEO") background = <FootageLayer asset={scene.asset} />;
  else if (scene.asset) background = <ImageLayer asset={scene.asset} variant={index} />;
  else background = graphicStyle ? <Backdrop /> : <FallbackLayer />;
  const photographic = !graphic && Boolean(scene.asset);

  let overlay = null;
  if (scene.visualType === "title") {
    overlay = chapter ? (
      <ChapterOverlay number={chapter} title={scene.onScreenText || title} />
    ) : (
      <TitleOverlay title={scene.onScreenText || title} />
    );
  } else if (!graphic && scene.onScreenText) {
    overlay = <LabelOverlay text={scene.onScreenText} />;
  }

  return (
    <AbsoluteFill style={{ overflow: "hidden", ...transitionStyle(transition, p) }}>
      {background}
      {photographic && <Vignette />}
      {photographic && (scene.visualType === "illustration" || scene.visualType === "painting") && (
        <CinematicParticles mood={scene.mood} seed={scene.id} />
      )}
      {graphic && (
        <AbsoluteFill style={scene.visualType === "map" ? undefined : { transform: `scale(${drift})` }}>
          {graphic.layer}
        </AbsoluteFill>
      )}
      {graphic?.heading && scene.onScreenText && <Heading text={scene.onScreenText} opacity={headingIn} />}
      {overlay}
      {scene.graphic.timeline && scene.visualType !== "timeline" && (
        <TimelineBadge date={scene.graphic.timeline.date} label={scene.graphic.timeline.label} />
      )}
      {transition === "wipe" && p < 1 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: `calc(${p * 100}% - 6px)`,
            width: 6,
            background: theme.goldStrong,
            boxShadow: `0 0 24px ${theme.goldStrong}`,
          }}
        />
      )}
    </AbsoluteFill>
  );
}

// Pusat kasar (bujur, lintang) titik-titik peta sebuah adegan.
function mapCenter(scene: SceneProps): [number, number] | null {
  const points = scene.visualType === "map" ? scene.graphic.map?.points : undefined;
  if (!points?.length) return null;
  return [points.reduce((s, p) => s + p.lng, 0) / points.length, points.reduce((s, p) => s + p.lat, 0) / points.length];
}

// Peta yang diawali globe: peta pertama video dan peta yang lokasinya jauh
// (lebih dari 20°) dari peta sebelumnya, agar penonton tahu di mana cerita berpindah.
function mapIntros(scenes: SceneProps[]) {
  let previous: [number, number] | null = null;
  return scenes.map((scene) => {
    const center = mapCenter(scene);
    if (!center) return false;
    const far = !previous || Math.hypot(center[0] - previous[0], center[1] - previous[1]) > 20;
    previous = center;
    return far;
  });
}

// Motion blur selama transisi geser, zoom, dan sapuan: beberapa sampel frame
// pecahan dirata-rata seperti rana kamera (HTML-in-canvas). Hanya saat render
// atau di Chrome yang mendukungnya; di luar transisi adegan digambar biasa.
function TransitionBlur({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  if (!enabled || frame >= CROSSFADE_FRAMES || !isHtmlInCanvasSupported()) return children;
  return (
    <HtmlInCanvasMotionBlur width={width} height={height} samples={6} shutterAngle={200}>
      {children}
    </HtmlInCanvasMotionBlur>
  );
}

// Volume musik: turun saat narasi berbicara (ducking), fade in di awal dan
// fade out di akhir video.
function useMusicVolume(props: HistoryVideoProps) {
  const { durationInFrames } = useVideoConfig();
  const ranges = speechRanges(props);
  return (frame: number) => {
    let distance = Infinity;
    for (const [start, end] of ranges) {
      if (frame >= start && frame <= end) {
        distance = 0;
        break;
      }
      distance = Math.min(distance, frame < start ? start - frame : frame - end);
    }
    const duck = interpolate(distance, [0, DUCK_FADE_FRAMES], [MUSIC_DUCKED, MUSIC_VOLUME], {
      extrapolateRight: "clamp",
    });
    const edges = interpolate(frame, [0, 30, durationInFrames - 60, durationInFrames], [0, 1, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return duck * edges;
  };
}

// Template video sejarah militer dan geopolitik (F-25): adegan grafis (teks
// kinetik, peta pertempuran, timeline, statistik, grafik, perbandingan, profil
// tokoh, kutipan) dan, pada gaya arsip, lukisan dengan ken-burns dan footage.
// Elemen grafis muncul mengikuti narasi (beats.ts), transisi bervariasi per
// jenis adegan, kartu bab, subtitle karaoke, musik per bab dengan ducking, dan
// efek suara pada transisi dan beat.
export function HistoryVideo(props: HistoryVideoProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const timings = sceneTimings(props);
  const chapters = chapterNumbers(props.scenes);
  const intros = mapIntros(props.scenes);
  const musicVolume = useMusicVolume(props);
  const endFade = interpolate(frame, [durationInFrames - END_HOLD_FRAMES, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Efek suara: whoosh pada transisi geser, zoom, dan sapuan; impact pada
  // kartu judul dan bab; kertas saat peta dibuka; pop saat angka atau peristiwa muncul.
  const sfx: { key: string; from: number; src: string; volume: number }[] = [];
  props.scenes.forEach((scene, i) => {
    const { start, frames } = timings[i];
    const lead = i === 0 ? 0 : CROSSFADE_FRAMES;
    const tail = i === props.scenes.length - 1 ? END_HOLD_FRAMES : 0;
    const add = (kind: string, src: string | null, from: number, volume: number) => {
      if (src) sfx.push({ key: `${kind}-${scene.id}-${sfx.length}`, from: Math.max(0, Math.round(from)), src, volume });
    };
    const transition = i === 0 ? null : transitionFor(props.scenes, i);
    if (scene.visualType === "title") add("impact", pick(props.sfx.impact, i), start - lead, 0.5);
    else if (transition && transition !== "fade") add("whoosh", pick(props.sfx.whoosh, i), start - lead, 0.35);
    if (scene.visualType === "map") add("paper", pick(props.sfx.paper, i), start - lead + 4, 0.4);
    const beats = beatFrames({ words: scene.words, offset: lead }, popCues(scene), FPS, frames + lead + tail);
    beats.forEach((beat, b) => add("pop", pick(props.sfx.pop, i + b), start - lead + beat, 0.3));
  });

  // Musik per bab: tiap bagian bersilang-fade dengan bagian berikutnya.
  const music = props.music.map((part, k) => {
    const next = props.music[k + 1];
    const from = k === 0 ? 0 : Math.max(0, (timings[part.fromScene]?.start ?? 0) - MUSIC_CROSSFADE_FRAMES / 2);
    const to = next
      ? (timings[next.fromScene]?.start ?? durationInFrames) + MUSIC_CROSSFADE_FRAMES / 2
      : durationInFrames;
    return { ...part, from, frames: Math.max(1, to - from), fadeIn: k > 0, fadeOut: Boolean(next) };
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ opacity: endFade, filter: props.finishing ? GRADE_FILTER : undefined }}>
        {props.scenes.map((scene, i) => {
          const { start, frames } = timings[i];
          const lead = i === 0 ? 0 : CROSSFADE_FRAMES;
          const tail = i === props.scenes.length - 1 ? END_HOLD_FRAMES : 0;
          const transition = i === 0 ? null : transitionFor(props.scenes, i);
          return (
            <Sequence
              key={scene.id}
              from={start - lead}
              durationInFrames={frames + lead + tail}
              name={`Adegan ${i + 1}`}
            >
              <SceneSpeechContext.Provider value={{ words: scene.words, offset: lead }}>
                <TransitionBlur enabled={props.motionBlur && transition !== null && transition !== "fade"}>
                  <SceneVisual
                    scene={scene}
                    index={i}
                    title={props.title}
                    chapter={chapters[i] || null}
                    transition={transition}
                    graphicStyle={props.style === "GRAPHIC"}
                    mapIntro={intros[i]}
                  />
                </TransitionBlur>
              </SceneSpeechContext.Provider>
            </Sequence>
          );
        })}
      </AbsoluteFill>

      {props.finishing && (
        <>
          <GradeOverlay />
          {props.scenes.map((scene, i) =>
            scene.visualType === "title" ? (
              // Kilatan memuncak tepat di potongan, lalu surut sebelum judul terbaca.
              <Sequence
                key={`leak-${scene.id}`}
                from={Math.max(0, timings[i].start - (i === 0 ? 0 : CROSSFADE_FRAMES) - 18)}
                durationInFrames={40}
                name="Light leak"
              >
                <LightLeakFlash seed={i} />
              </Sequence>
            ) : null,
          )}
          <FilmGrain />
        </>
      )}

      {props.scenes.map((scene, i) => {
        const { start, frames } = timings[i];
        return (
          <Sequence key={`audio-${scene.id}`} from={start} durationInFrames={frames} name={`Narasi ${i + 1}`}>
            {scene.narrationSrc && <Html5Audio src={scene.narrationSrc} />}
            {props.subtitles && <Subtitles words={scene.words} />}
          </Sequence>
        );
      })}

      {sfx.map((effect) => (
        <Sequence key={effect.key} from={effect.from} durationInFrames={75} name="SFX">
          <Html5Audio src={effect.src} volume={effect.volume} />
        </Sequence>
      ))}

      {music.map((part, k) => (
        <Sequence key={`music-${k}`} from={part.from} durationInFrames={part.frames} name={`Musik ${k + 1}`}>
          <Html5Audio
            src={part.src}
            loop
            // Frame volume dihitung dari awal bagian musik ini.
            volume={(f) => {
              const fadeIn = part.fadeIn
                ? interpolate(f, [0, MUSIC_CROSSFADE_FRAMES], [0, 1], { extrapolateRight: "clamp" })
                : 1;
              const fadeOut = part.fadeOut
                ? interpolate(f, [part.frames - MUSIC_CROSSFADE_FRAMES, part.frames], [1, 0], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })
                : 1;
              return musicVolume(part.from + f) * fadeIn * fadeOut;
            }}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
