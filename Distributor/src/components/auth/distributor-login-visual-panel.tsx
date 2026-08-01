"use client";

import { ZYND_MITRA_COPY } from "@/lib/zynd-mitra-copy";

export type DistributorLoginVisualPanelProps = {
  hello?: string;
  title?: string;
  tagline?: string;
  /** CSS `background` value for the panel (gradient or solid). */
  gradient?: string;
};

const DEFAULT_GRADIENT =
  "linear-gradient(145deg, #10b981 0%, #2563eb 52%, #7c3aed 100%)";

export function DistributorLoginVisualPanel({
  hello = "Hello",
  title = ZYND_MITRA_COPY.welcomeConsole,
  tagline = "Your Wealth, Your Way",
  gradient = DEFAULT_GRADIENT,
}: DistributorLoginVisualPanelProps) {
  return (
    <div className="distributor-login-page__visual-frame distributor-login-page__visual-panel">
      <div
        className="distributor-login-page__visual-panel-bg"
        style={{ background: gradient }}
        aria-hidden
      />
      <div className="distributor-login-page__visual-panel-shade" aria-hidden />
      <div className="distributor-login-page__visual-copy">
        <p className="distributor-login-page__visual-hello">{hello}</p>
        <h2 className="distributor-login-page__visual-title">{title}</h2>
        <p className="distributor-login-page__visual-tagline">{tagline}</p>
      </div>
    </div>
  );
}
