"use client";

import { Thumbnail as StillFrame } from "@remotion/player";
import { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "@/remotion/constants";
import { Thumbnail, type ThumbnailProps } from "@/remotion/history/Thumbnail";

// Pratinjau thumbnail YouTube: frame terakhir komposisi Thumbnail, sama seperti hasil render.
export function ThumbnailPreview({ props }: { props: ThumbnailProps }) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
      <StillFrame
        component={Thumbnail}
        inputProps={props}
        compositionWidth={VIDEO_WIDTH}
        compositionHeight={VIDEO_HEIGHT}
        durationInFrames={Math.max(1, props.frames)}
        frameToDisplay={Math.max(0, props.frames - 1)}
        fps={VIDEO_FPS}
        style={{ width: "100%", aspectRatio: `${VIDEO_WIDTH} / ${VIDEO_HEIGHT}` }}
      />
    </div>
  );
}
