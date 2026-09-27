import { Composition } from "remotion";
import { TitleCard } from "./compositions/TitleCard";
import {
  TITLE_CARD_DURATION,
  titleCardDefaults,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "./constants";

// Daftar komposisi yang muncul di Remotion Studio dan bisa dirender.
export function RemotionRoot() {
  return (
    <Composition
      id="TitleCard"
      component={TitleCard}
      durationInFrames={TITLE_CARD_DURATION}
      fps={VIDEO_FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
      defaultProps={titleCardDefaults}
    />
  );
}
