import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cancelRender, continueRender, delayRender } from "remotion";

// Resolusi canvas relatif terhadap ukuran tampil, agar tetap tajam saat peta
// perlahan diperbesar.
const PIXEL_RATIO = 2;

// Lapisan peta yang tidak beranimasi (laut, daratan bertekstur, sungai, danau,
// batas negara) digambar sekali ke canvas dari markup SVG. Menggambar ulang
// ribuan path setiap frame membuat render peta beberapa kali lebih lambat.
export function MapBase({
  svg,
  width,
  height,
  style,
}: {
  svg: string;
  width: number;
  height: number;
  style?: CSSProperties;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // delayRender saat render pertama (bukan di effect) agar frame tidak diambil
  // sebelum canvas terisi.
  const [handle] = useState(() => delayRender("Menggambar peta dasar"));
  const released = useRef(false);

  useEffect(() => {
    const release = () => {
      if (released.current) return;
      released.current = true;
      continueRender(handle);
    };
    const image = new Image();
    image.onload = () => {
      const context = canvas.current?.getContext("2d");
      if (context) {
        context.clearRect(0, 0, width * PIXEL_RATIO, height * PIXEL_RATIO);
        context.drawImage(image, 0, 0, width * PIXEL_RATIO, height * PIXEL_RATIO);
      }
      release();
    };
    image.onerror = () => cancelRender(new Error("Peta dasar gagal digambar"));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return () => {
      image.onload = null;
      image.onerror = null;
      release();
    };
  }, [svg, width, height, handle]);

  return (
    <canvas
      ref={canvas}
      width={width * PIXEL_RATIO}
      height={height * PIXEL_RATIO}
      style={{ position: "absolute", inset: 0, width, height, ...style }}
    />
  );
}
