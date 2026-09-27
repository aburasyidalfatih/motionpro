"use client";

import { Player } from "@remotion/player";
import { TitleCard } from "@/remotion/compositions/TitleCard";
import {
  TITLE_CARD_DURATION,
  titleCardDefaults,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "@/remotion/constants";

export function TitleCardPlayer() {
  return (
    <Player
      component={TitleCard}
      inputProps={titleCardDefaults}
      durationInFrames={TITLE_CARD_DURATION}
      fps={VIDEO_FPS}
      compositionWidth={VIDEO_WIDTH}
      compositionHeight={VIDEO_HEIGHT}
      controls
      loop
      autoPlay
      style={{ width: "100%", aspectRatio: `${VIDEO_WIDTH} / ${VIDEO_HEIGHT}` }}
    />
  );
}
