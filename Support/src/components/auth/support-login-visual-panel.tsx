"use client";

export type SupportLoginVisualPanelProps = {
  hello?: string;
  title?: string;
  tagline?: string;
  gradient?: string;
};

const DEFAULT_GRADIENT =
  "linear-gradient(145deg, #10b981 0%, #2563eb 52%, #7c3aed 100%)";

export function SupportLoginVisualPanel({
  hello = "Hello",
  title = "ZYND Support",
  tagline = "Here to help your investors",
  gradient = DEFAULT_GRADIENT,
}: SupportLoginVisualPanelProps) {
  return (
    <div className="support-login-page__visual-frame support-login-page__visual-panel">
      <div
        className="support-login-page__visual-panel-bg"
        style={{ background: gradient }}
        aria-hidden
      />
      <div className="support-login-page__visual-panel-shade" aria-hidden />
      <div className="support-login-page__visual-copy">
        <p className="support-login-page__visual-hello">{hello}</p>
        <h2 className="support-login-page__visual-title">{title}</h2>
        <p className="support-login-page__visual-tagline">{tagline}</p>
      </div>
    </div>
  );
}
