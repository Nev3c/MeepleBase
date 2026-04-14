import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #FBBF24 0%, #E8821A 60%, #B45309 100%)",
          borderRadius: "7px",
        }}
      >
        <svg
          viewBox="0 0 512 512"
          style={{ width: "80%", height: "80%" }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="256" cy="138" r="76" fill="white" />
          <circle cx="94" cy="262" r="62" fill="white" />
          <circle cx="418" cy="262" r="62" fill="white" />
          <path
            d="M 152 228 Q 256 298 360 228 L 356 330 L 302 330 L 296 440 L 216 440 L 210 330 L 156 330 Z"
            fill="white"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
