import { AbsoluteFill, Html5Audio, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, Heading } from "./graphics/Backdrop";
import { ComparisonScene } from "./graphics/ComparisonScene";
import { KineticText } from "./graphics/KineticText";
import { QuoteScene } from "./graphics/QuoteScene";
import { StatScene } from "./graphics/StatScene";
import { TimelineScene } from "./graphics/TimelineScene";
import { MapLayer } from "./MapLayer";
import { LabelOverlay, Subtitles, TimelineBadge, TitleOverlay } from "./overlays";
import { CROSSFADE_FRAMES, END_HOLD_FRAMES, sceneTimings, speechRanges } from "./timing";
import type { HistoryVideoProps, SceneProps } from "./types";
import { FallbackLayer, FootageLayer, ImageLayer, Vignette } from "./visuals";

const MUSIC_VOLUME = 0.22;
const MUSIC_DUCKED = 0.07;
const DUCK_FADE_FRAMES = 10;

type Graphic = { layer: React.ReactNode; heading: boolean };

// Visual grafis sesuai tipe adegan, atau null bila datanya tidak ada.
function graphicFor(scene: SceneProps): Graphic | null {
  const g = scene.graphic;
  switch (scene.visualType) {
    case "map":
      return g.map?.points.length ? { layer: <MapLayer map={g.map} />, heading: false } : null;
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
    default:
      return null;
  }
}

function SceneVisual({
  scene,
  index,
  title,
  fadeIn,
  graphicStyle,
}: {
  scene: SceneProps;
  index: number;
  title: string;
  fadeIn: boolean;
  graphicStyle: boolean;
}) {
  const frame = useCurrentFrame();
  const opacity = fadeIn ? interpolate(frame, [0, CROSSFADE_FRAMES], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const graphic = graphicFor(scene);
  const headingIn = interpolate(frame, [4, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Peta menggambar latarnya sendiri; tipe grafis lain di atas latar navy.
  let background;
  if (graphic) background = scene.visualType === "map" ? null : <Backdrop />;
  else if (scene.asset?.kind === "VIDEO") background = <FootageLayer asset={scene.asset} />;
  else if (scene.asset) background = <ImageLayer asset={scene.asset} variant={index} />;
  else background = graphicStyle ? <Backdrop /> : <FallbackLayer />;
  const photographic = !graphic && Boolean(scene.asset);

  return (
    <AbsoluteFill style={{ opacity }}>
      {background}
      {photographic && <Vignette />}
      {graphic?.layer}
      {graphic?.heading && scene.onScreenText && <Heading text={scene.onScreenText} opacity={headingIn} />}
      {scene.visualType === "title" ? (
        <TitleOverlay title={scene.onScreenText || title} />
      ) : (
        !graphic && scene.onScreenText && <LabelOverlay text={scene.onScreenText} />
      )}
      {scene.graphic.timeline && scene.visualType !== "timeline" && (
        <TimelineBadge date={scene.graphic.timeline.date} label={scene.graphic.timeline.label} />
      )}
    </AbsoluteFill>
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
// kinetik, peta pertempuran, timeline, statistik, perbandingan, kutipan) dan,
// pada gaya arsip, lukisan dengan ken-burns dan footage; ditambah penanda tahun,
// subtitle karaoke, crossfade, musik dengan ducking, dan SFX.
export function HistoryVideo(props: HistoryVideoProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const timings = sceneTimings(props);
  const musicVolume = useMusicVolume(props);
  const endFade = interpolate(frame, [durationInFrames - END_HOLD_FRAMES, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ opacity: endFade }}>
        {props.scenes.map((scene, i) => {
          const { start, frames } = timings[i];
          const lead = i === 0 ? 0 : CROSSFADE_FRAMES;
          const tail = i === props.scenes.length - 1 ? END_HOLD_FRAMES : 0;
          return (
            <Sequence
              key={scene.id}
              from={start - lead}
              durationInFrames={frames + lead + tail}
              name={`Adegan ${i + 1}`}
            >
              <SceneVisual
                scene={scene}
                index={i}
                title={props.title}
                fadeIn={i > 0}
                graphicStyle={props.style === "GRAPHIC"}
              />
            </Sequence>
          );
        })}
      </AbsoluteFill>

      {props.scenes.map((scene, i) => {
        const { start, frames } = timings[i];
        return (
          <Sequence key={`audio-${scene.id}`} from={start} durationInFrames={frames} name={`Narasi ${i + 1}`}>
            {scene.narrationSrc && <Html5Audio src={scene.narrationSrc} />}
            {props.subtitles && <Subtitles words={scene.words} />}
          </Sequence>
        );
      })}

      {props.sfx.impact && (
        <Sequence durationInFrames={90} name="SFX pembuka">
          <Html5Audio src={props.sfx.impact} volume={0.5} />
        </Sequence>
      )}
      {props.sfx.whoosh &&
        props.scenes.map((scene, i) =>
          i > 0 && ["map", "title", "stat", "comparison"].includes(scene.visualType) ? (
            <Sequence key={`sfx-${scene.id}`} from={timings[i].start - CROSSFADE_FRAMES} durationInFrames={60}>
              <Html5Audio src={props.sfx.whoosh!} volume={0.35} />
            </Sequence>
          ) : null,
        )}

      {props.musicSrc && <Html5Audio src={props.musicSrc} loop volume={musicVolume} />}
    </AbsoluteFill>
  );
}
