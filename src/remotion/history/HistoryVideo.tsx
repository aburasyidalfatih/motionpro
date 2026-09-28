import { AbsoluteFill, Html5Audio, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { MapLayer } from "./MapLayer";
import { LabelOverlay, Subtitles, TimelineBadge, TitleOverlay } from "./overlays";
import { CROSSFADE_FRAMES, END_HOLD_FRAMES, sceneTimings, speechRanges } from "./timing";
import type { HistoryVideoProps, SceneProps } from "./types";
import { FallbackLayer, FootageLayer, ImageLayer, Vignette } from "./visuals";

const MUSIC_VOLUME = 0.22;
const MUSIC_DUCKED = 0.07;
const DUCK_FADE_FRAMES = 10;

function SceneVisual({
  scene,
  index,
  title,
  fadeIn,
}: {
  scene: SceneProps;
  index: number;
  title: string;
  fadeIn: boolean;
}) {
  const frame = useCurrentFrame();
  const opacity = fadeIn ? interpolate(frame, [0, CROSSFADE_FRAMES], [0, 1], { extrapolateRight: "clamp" }) : 1;
  const showMap = scene.map && scene.map.points.length > 0 && (scene.visualType === "map" || !scene.asset);

  let layer;
  if (showMap) layer = <MapLayer map={scene.map!} />;
  else if (scene.asset?.kind === "VIDEO") layer = <FootageLayer asset={scene.asset} />;
  else if (scene.asset) layer = <ImageLayer asset={scene.asset} variant={index} />;
  else layer = <FallbackLayer />;

  return (
    <AbsoluteFill style={{ opacity }}>
      {layer}
      {!showMap && <Vignette />}
      {scene.visualType === "title" ? (
        <TitleOverlay title={scene.onScreenText || title} />
      ) : (
        scene.onScreenText && !showMap && <LabelOverlay text={scene.onScreenText} />
      )}
      {scene.timeline && <TimelineBadge date={scene.timeline.date} label={scene.timeline.label} />}
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

// Template video sejarah (F-25): lukisan dengan ken-burns, footage, peta animasi,
// label, penanda tahun, subtitle karaoke, crossfade, musik dengan ducking, dan SFX.
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
              <SceneVisual scene={scene} index={i} title={props.title} fadeIn={i > 0} />
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
          i > 0 && (scene.visualType === "map" || scene.visualType === "title") ? (
            <Sequence key={`sfx-${scene.id}`} from={timings[i].start - CROSSFADE_FRAMES} durationInFrames={60}>
              <Html5Audio src={props.sfx.whoosh!} volume={0.35} />
            </Sequence>
          ) : null,
        )}

      {props.musicSrc && <Html5Audio src={props.musicSrc} loop volume={musicVolume} />}
    </AbsoluteFill>
  );
}
