"use client";

import { Player } from "@remotion/player";
import { useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH } from "@/remotion/constants";
import { HistoryVideo } from "@/remotion/history/HistoryVideo";
import { totalFrames } from "@/remotion/history/timing";
import type { HistoryVideoProps } from "@/remotion/history/types";

// F-26: pratinjau video lengkap di browser, tanpa render. Pilihan subtitle
// berlaku untuk pratinjau dan render.
export function VideoPreview({
  props,
  renderAction,
  canRender,
  busy,
}: {
  props: HistoryVideoProps;
  renderAction: (formData: FormData) => Promise<void>;
  canRender: boolean;
  busy: boolean;
}) {
  const [subtitles, setSubtitles] = useState(props.subtitles);
  const inputProps = { ...props, subtitles };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <Player
          component={HistoryVideo}
          inputProps={inputProps}
          durationInFrames={totalFrames(inputProps)}
          fps={VIDEO_FPS}
          compositionWidth={VIDEO_WIDTH}
          compositionHeight={VIDEO_HEIGHT}
          controls
          style={{ width: "100%", aspectRatio: `${VIDEO_WIDTH} / ${VIDEO_HEIGHT}` }}
        />
      </div>
      <form action={renderAction} className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="subtitles"
            checked={subtitles}
            onChange={(e) => setSubtitles(e.target.checked)}
            className="h-4 w-4"
          />
          Subtitle ditanam di video
        </label>
        <SubmitButton disabled={!canRender || busy} pendingText="Memulai render...">
          Render video 1080p
        </SubmitButton>
      </form>
    </div>
  );
}
