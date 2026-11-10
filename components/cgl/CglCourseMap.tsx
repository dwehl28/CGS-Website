/** An illustrative course graphic, not a map of a real venue. */
export default function CglCourseMap({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 520 350"
      fill="none"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid slice"
    >
      <path fill="#173e43" d="M0 0h520v350H0z" />
      <g stroke="#356064" strokeWidth="1" opacity=".65">
        <path d="M-50 50C90-40 181 40 185 125S80 295 190 370" />
        <path d="M-50 69C84-20 160 48 164 127S65 296 170 370" />
        <path d="M-50 88C73 0 139 58 143 128S46 296 150 370" />
        <path d="M-50 109C60 20 119 70 122 129S26 299 130 370" />
        <path d="M-50 130C42 42 98 78 101 129S6 301 110 370" />
        <path d="M275-20c-75 91 38 139 89 137s57 108 163 138" />
        <path d="M296-20c-70 77 28 117 76 116s55 106 155 139" />
        <path d="M318-20c-63 60 17 96 61 95s51 104 148 139" />
        <path d="M342-20c-51 44 2 74 45 74s47 100 140 139" />
        <path d="M365-20c-38 28-11 51 28 53s44 95 134 139" />
        <path d="M251 370c-48-88 37-74 75-114s55-2 104-12 80 18 105 50" />
        <path d="M275 370c-42-68 24-56 64-96s53 0 93-9 67 12 103 48" />
        <path d="M299 370c-35-51 13-37 53-76s49 2 82-7 55 6 101 45" />
      </g>
      <path d="M-10 251c63-39 97-27 134 1s54 87 82 108H-10z" fill="#224f5c" />
      <path
        d="M241 272c-32-30-40-47-10-72s54-24 59-53 0-47 24-56 53 3 59 25-23 40-22 67-24 39-41 53-15 42-40 42z"
        fill="#49764e"
      />
      <path
        d="M250 261c-23-24-27-39-2-58s54-28 56-57 2-40 19-44 32 7 33 20-20 35-19 60-22 35-40 49-21 39-32 36z"
        fill="#74a15f"
      />
      <path
        d="M300 98c1-16 17-23 31-21s25 14 20 25-12 7-23 6-30 4-28-10z"
        fill="#b7cc83"
      />
      <path
        d="M285 94c-10-9-6-20 5-20s13 8 10 16-9 8-15 4zM359 110c12-3 19 5 16 14s-10 15-17 7-7-18 1-21z"
        fill="#ddcea3"
      />
      <path
        d="M255 259c-8-57 84-54 75-159"
        stroke="#d4ef99"
        strokeWidth="1.5"
        strokeDasharray="5 5"
      />
      <circle cx="255" cy="259" r="5" fill="#fff" />
      <circle cx="255" cy="259" r="12" stroke="#fff" strokeOpacity=".25" />
      <path
        d="M330 99V61l23 8-23 9"
        stroke="#d1f778"
        strokeWidth="2"
        fill="#d1f778"
      />
      {!compact ? (
        <g
          fill="#a3babb"
          fontFamily="Arial, sans-serif"
          fontSize="10"
          letterSpacing="2"
        >
          <text x="32" y="37">
            CGL / COURSE NOTES
          </text>
          <text x="32" y="320">
            ILLUSTRATIVE COURSE MAP
          </text>
          <text x="455" y="320">
            N ↑
          </text>
        </g>
      ) : null}
    </svg>
  );
}
