/** Small stroke icons (24px grid). Decorative: aria-hidden by default. */
type P = { className?: string };
const base = (className = "h-5 w-5") => ({
  className,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const IconGrid = ({ className }: P) => (
  <svg {...base(className)}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>
);
export const IconDatabase = ({ className }: P) => (
  <svg {...base(className)}><ellipse cx="12" cy="5.5" rx="7.5" ry="2.5" /><path d="M4.5 5.5v6c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-6" /><path d="M4.5 11.5v6c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-6" /></svg>
);
export const IconFlow = ({ className }: P) => (
  <svg {...base(className)}><rect x="3" y="4" width="6" height="5" rx="1.2" /><rect x="15" y="4" width="6" height="5" rx="1.2" /><rect x="9" y="15" width="6" height="5" rx="1.2" /><path d="M9 6.5h6M6 9v3.5h12V9M12 12.5V15" /></svg>
);
export const IconShield = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z" /><path d="M8.8 12.2l2.2 2.2 4.3-4.6" /></svg>
);
export const IconUsers = ({ className }: P) => (
  <svg {...base(className)}><circle cx="9" cy="8" r="3.2" /><path d="M3 19.5c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2" /><path d="M16 5a3 3 0 010 6M17.5 14.6c2 .6 3.2 2.3 3.5 4.9" /></svg>
);
export const IconSteps = ({ className }: P) => (
  <svg {...base(className)}><path d="M7.5 14.5c-1.8 0-3-1.6-3-4s1.2-6 3.2-6 2.8 2.6 2.4 5.5c-.3 2.4-.8 4.5-2.6 4.5zM6 17.5c0 1.4.8 2.5 2 2.5s2-1 2-2.5" /><path d="M16.5 11c1.8 0 3-1.6 3-4s-1.2-4-3.2-4-2.8 2.1-2.4 4.5c.3 2.2.8 3.5 2.6 3.5zM15 14c0 1.4.8 2.5 2 2.5s2-1 2-2.5" /></svg>
);
export const IconTarget = ({ className }: P) => (
  <svg {...base(className)}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></svg>
);
export const IconMoon = ({ className }: P) => (
  <svg {...base(className)}><path d="M19.5 14.5A8 8 0 019.5 4.5a8 8 0 1010 10z" /></svg>
);
export const IconBolt = ({ className }: P) => (
  <svg {...base(className)}><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" /></svg>
);
export const IconHeart = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0112 7.3 4.3 4.3 0 0119.5 10c0 5.6-7.5 10-7.5 10z" /></svg>
);
export const IconSparkle = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 3.5l1.8 4.9 4.9 1.8-4.9 1.8L12 16.9l-1.8-4.9-4.9-1.8 4.9-1.8z" /><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></svg>
);
export const IconBell = ({ className }: P) => (
  <svg {...base(className)}><path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 004 0" /></svg>
);
export const IconLock = ({ className }: P) => (
  <svg {...base(className)}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 018 0v2.5" /></svg>
);
export const IconUser = ({ className }: P) => (
  <svg {...base(className)}><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20c.8-3.8 3.7-6 7.5-6s6.7 2.2 7.5 6" /></svg>
);
export const IconEyeOff = ({ className }: P) => (
  <svg {...base(className)}><path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0112 6c5 0 8.5 4.5 9.5 6-.4.7-1.4 2.1-2.9 3.4M6.3 7.6C4.4 8.9 3.1 10.8 2.5 12c1 1.5 4.5 6 9.5 6 1.5 0 2.9-.4 4.1-1" /><path d="M9.9 9.9a3 3 0 004.2 4.2" /></svg>
);
export const IconEye = ({ className }: P) => (
  <svg {...base(className)}><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const IconLogout = ({ className }: P) => (
  <svg {...base(className)}><path d="M15 4.5h3a1.5 1.5 0 011.5 1.5v12a1.5 1.5 0 01-1.5 1.5h-3M10 16.5L5.5 12 10 7.5M5.5 12H15" /></svg>
);
export const IconMenu = ({ className }: P) => (
  <svg {...base(className)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
);
export const IconUpload = ({ className }: P) => (
  <svg {...base(className)}><path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9" /><path d="M4.5 15.5v2.5A1.5 1.5 0 006 19.5h12a1.5 1.5 0 001.5-1.5v-2.5" /></svg>
);
