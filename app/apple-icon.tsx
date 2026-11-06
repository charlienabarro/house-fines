import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Home-screen icon for iPhones: a pint on the house purple.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#21143f",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ position: "relative", width: 96, height: 116, display: "flex" }}>
          {/* handle */}
          <div
            style={{
              position: "absolute",
              right: -26,
              top: 30,
              width: 40,
              height: 52,
              border: "10px solid #fff7e8",
              borderRadius: 18,
            }}
          />
          {/* glass */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 14,
              width: 92,
              height: 102,
              background: "#ffc233",
              border: "7px solid #fff7e8",
              borderRadius: "6px 6px 16px 16px",
            }}
          />
          {/* foam */}
          <div style={{ position: "absolute", left: -6, top: 0, width: 38, height: 38, borderRadius: 19, background: "#fff7e8" }} />
          <div style={{ position: "absolute", left: 24, top: -8, width: 44, height: 44, borderRadius: 22, background: "#fff7e8" }} />
          <div style={{ position: "absolute", left: 60, top: -2, width: 38, height: 38, borderRadius: 19, background: "#fff7e8" }} />
        </div>
      </div>
    ),
    size,
  );
}
