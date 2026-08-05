"use client";

export type AdminLoginVisualPanelProps = {
  hello?: string;
  title?: string;
  description?: string;
};

export function AdminLoginVisualPanel({
  hello = "Hello ZYND! 👋",
  title,
  description = "Manage distributors, investors, compliance, and platform operations from one secure administrative hub.",
}: AdminLoginVisualPanelProps) {
  return (
    <div className="admin-login-visual-panel">
      <div className="admin-login-visual-panel__content">
        <div className="admin-login-visual-panel__mark" aria-hidden="true">
          <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M32 4L36.5 27.5L60 32L36.5 36.5L32 60L27.5 36.5L4 32L27.5 27.5L32 4Z"
              fill="currentColor"
            />
          </svg>
        </div>

        <div className="admin-login-visual-panel__copy">
          <h2 className="admin-login-visual-panel__hello">{hello}</h2>
          {title ? <p className="admin-login-visual-panel__title">{title}</p> : null}
          <p className="admin-login-visual-panel__description">{description}</p>
        </div>
      </div>

      <p className="admin-login-visual-panel__copyright">
        © {new Date().getFullYear()} ZYND. All rights reserved.
      </p>
    </div>
  );
}
