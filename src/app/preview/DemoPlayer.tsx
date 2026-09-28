"use client";

import { Player } from "@remotion/player";
import { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "@/remotion/constants";
import { demoProps } from "@/remotion/history/demo";
import { HistoryVideo } from "@/remotion/history/HistoryVideo";
import { totalFrames } from "@/remotion/history/timing";

export function DemoPlayer() {
  return (
    <Player
      component={HistoryVideo}
      inputProps={demoProps}
      durationInFrames={totalFrames(demoProps)}
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
