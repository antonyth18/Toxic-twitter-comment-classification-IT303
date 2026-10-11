import React from 'react';

export default function WaveBackground() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-0"
    >
      <svg
        className="w-full h-full min-h-screen opacity-30"
        viewBox="0 0 1440 900"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path
          d="M-100 120 C 260 220, 580 -20, 960 140 C 1180 230, 1380 160, 1600 100"
          stroke="white"
          strokeWidth="1.2"
          opacity="0.7"
        />
        <path
          d="M-100 200 C 240 340, 560 60, 920 250 C 1220 380, 1420 160, 1600 220"
          stroke="white"
          strokeWidth="1.5"
          opacity="0.85"
        />
        <path
          d="M-100 300 C 220 440, 620 140, 1020 340 C 1280 440, 1480 240, 1600 310"
          stroke="white"
          strokeWidth="1.2"
          opacity="0.6"
        />
        <path
          d="M-100 420 C 300 560, 680 220, 1080 460 C 1300 560, 1460 380, 1600 430"
          stroke="white"
          strokeWidth="1.5"
          opacity="0.8"
        />
        <path
          d="M-100 540 C 280 680, 700 360, 1060 590 C 1280 700, 1480 500, 1600 550"
          stroke="white"
          strokeWidth="1.2"
          opacity="0.7"
        />
        <path
          d="M-100 660 C 340 820, 740 480, 1140 720 C 1340 830, 1500 640, 1600 680"
          stroke="white"
          strokeWidth="1.5"
          opacity="0.8"
        />
        <path
          d="M-100 780 C 300 920, 780 620, 1180 840 C 1360 920, 1500 780, 1600 820"
          stroke="white"
          strokeWidth="1.2"
          opacity="0.65"
        />
      </svg>
    </div>
  );
}
