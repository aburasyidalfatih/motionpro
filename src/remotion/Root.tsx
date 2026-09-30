import { Composition } from "remotion";
import { TitleCard } from "./compositions/TitleCard";
import {
  TITLE_CARD_DURATION,
  titleCardDefaults,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "./constants";
import { demoProps } from "./history/demo";
import { HistoryVideo } from "./history/HistoryVideo";
import { Thumbnail, type ThumbnailProps } from "./history/Thumbnail";
import { totalFrames } from "./history/timing";

// Daftar komposisi yang muncul di Remotion Studio dan bisa dirender.
export function RemotionRoot() {
  return (
    <>
      <Composition
        id="HistoryVideo"
        component={HistoryVideo}
        durationInFrames={totalFrames(demoProps)}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={demoProps}
        // Durasi mengikuti adegan dan voice over proyek yang dirender.
        calculateMetadata={({ props }) => ({ durationInFrames: totalFrames(props) })}
      />
      <Composition
        id="Thumbnail"
        component={Thumbnail}
        durationInFrames={240}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={
          {
            text: "Kota yang menolak menyerah",
            kicker: "1945",
            scene: demoProps.scenes.find((s) => s.id === "demo-map") ?? null,
            frames: 240,
          } satisfies ThumbnailProps
        }
        // Still diambil di akhir adegan latar, jadi durasi mengikuti adegan itu.
        calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, props.frames) })}
      />
      <Composition
        id="TitleCard"
        component={TitleCard}
        durationInFrames={TITLE_CARD_DURATION}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        defaultProps={titleCardDefaults}
      />
    </>
  );
}
