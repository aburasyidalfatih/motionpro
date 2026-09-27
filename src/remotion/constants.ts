import type { TitleCardProps } from "./compositions/TitleCard";

// Format default video YouTube: 1920×1080, 30 fps (PRD, kebutuhan non-fungsional).
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
export const VIDEO_FPS = 30;

export const TITLE_CARD_DURATION = 5 * VIDEO_FPS;

export const titleCardDefaults: TitleCardProps = {
  era: "Abad ke-14",
  title: "Kejayaan Majapahit",
  subtitle: "Kerajaan maritim terbesar di Nusantara",
};
