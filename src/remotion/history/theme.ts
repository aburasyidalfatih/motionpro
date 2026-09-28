// Palet dan tipografi template: nuansa ruang komando (navy, grid, emas) untuk
// adegan grafis, dan nuansa perkamen untuk adegan lukisan dan arsip.
export const theme = {
  serif: "Georgia, 'Times New Roman', 'Liberation Serif', serif",
  sans: "'Helvetica Neue', Arial, 'Liberation Sans', sans-serif",
  ink: "#f3e6cf",
  inkSoft: "#e2d3b8",
  muted: "#9fb0bf",
  gold: "#d6b98c",
  goldStrong: "#e0b565",
  shadow: "0 2px 12px rgba(0,0,0,0.85)",
  panel: "rgba(10, 16, 22, 0.78)",
  night: "#0b131a",
  sea: "#1f2d36",
  land: "#c7b087",
  landEdge: "#8b7550",
  marker: "#e0b565",
  grid: "rgba(159, 176, 191, 0.07)",
};

// Warna pihak yang bertikai: indeks 0 merah, 1 biru, 2 emas.
export const sideColors = ["#e04b3f", "#3d86e0", "#e0b565"];

export const sideColor = (side: number | undefined) =>
  side === undefined ? theme.marker : (sideColors[side] ?? theme.marker);
