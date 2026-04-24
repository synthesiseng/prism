import type { SVGProps } from "react";

type IconProps = Readonly<{
  size?: number;
  color?: string;
}>;

function iconProps(size: number): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    "aria-hidden": true
  };
}

export function CheckIcon({ size = 12, color = "currentColor" }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <path
        d="M3 8.5L6.5 12L13 4.5"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function ArrowIcon({ size = 12, color = "currentColor" }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <path
        d="M3 8h10M9 4l4 4-4 4"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

export function DownloadIcon({ size = 12, color = "currentColor" }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <path
        d="M8 2v8m0 0L5 7.5M8 10l3-2.5M2.5 13h11"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function BringForwardIcon({ size = 14, color = "currentColor" }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <rect height="8" rx="1" stroke={color} strokeWidth="1.4" width="8" x="2" y="6" />
      <rect
        fill="#111"
        height="8"
        rx="1"
        stroke={color}
        strokeWidth="1.4"
        width="8"
        x="6"
        y="2"
      />
    </svg>
  );
}

export function SendBackwardIcon({ size = 14, color = "currentColor" }: IconProps) {
  return (
    <svg {...iconProps(size)}>
      <rect height="8" rx="1" stroke={color} strokeWidth="1.4" width="8" x="6" y="2" />
      <rect
        fill="#111"
        height="8"
        rx="1"
        stroke={color}
        strokeWidth="1.4"
        width="8"
        x="2"
        y="6"
      />
    </svg>
  );
}

export function PrismMark({ size = 20 }: Readonly<{ size?: number }>) {
  return (
    <svg
      aria-hidden
      className="brand-mark"
      fill="none"
      height={size}
      viewBox="0 0 20 20"
      width={size}
    >
      <rect fill="#ff4d6d" height="9" opacity="0.85" rx="1.5" width="9" x="3.5" y="3.5" />
      <rect fill="#7B61FF" height="9" rx="1.5" width="9" x="5.5" y="5.5" />
      <rect
        fill="#4dd4ff"
        height="9"
        opacity="0.85"
        rx="1.5"
        style={{ mixBlendMode: "screen" }}
        width="9"
        x="7.5"
        y="7.5"
      />
    </svg>
  );
}

export function SynthesisWord() {
  return (
    <svg aria-hidden fill="none" height="9" viewBox="0 0 72 9" width="72">
      <text
        fill="currentColor"
        fontFamily="Inter, sans-serif"
        fontSize="8"
        fontWeight="500"
        letterSpacing="0.12em"
        textRendering="geometricPrecision"
        x="2"
        y="7"
      >
        @bysynthesis
      </text>
    </svg>
  );
}
