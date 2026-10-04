/**
 * Shared look for the "Funds For You" surfaces. The purple matches the navbar
 * button background so the popover and the KYC unlock page read as one thing.
 */
export const RECOMMEND_FUNDS_GRAINIENT_PROPS = {
  color1: "#6D28D9",
  color2: "#5B21B6",
  color3: "#3B0764",
  timeSpeed: 0.18,
  colorBalance: 0.28,
  warpStrength: 0.75,
  warpFrequency: 4.0,
  warpSpeed: 1.4,
  warpAmplitude: 60.0,
  blendAngle: 18.0,
  blendSoftness: 0.04,
  rotationAmount: 360.0,
  noiseScale: 1.8,
  grainAmount: 0.06,
  grainScale: 2.2,
  grainAnimated: false,
  contrast: 1.2,
  gamma: 1.05,
  saturation: 1.08,
  centerX: 0.0,
  centerY: 0.0,
  zoom: 0.52,
} as const;

/** Same palette, framed for a full-viewport canvas. */
export const RECOMMEND_FUNDS_PAGE_GRAINIENT_PROPS = {
  ...RECOMMEND_FUNDS_GRAINIENT_PROPS,
  timeSpeed: 0.14,
  warpAmplitude: 70.0,
  grainAmount: 0.05,
  zoom: 0.95,
} as const;
