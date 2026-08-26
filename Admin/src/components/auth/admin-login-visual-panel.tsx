"use client";

import { AdminAuthLottie } from "@/components/auth/admin-login-visual-lottie";

export type AdminLoginVisualPanelProps = {
  hello?: string;
  title?: string;
  description?: string;
  lottieSrc?: string;
};

export function AdminLoginVisualPanel({
  hello = "ZYND Admin Console",
  title,
  description = "Manage your wealth with confidence and show every client the support they deserve.",
  lottieSrc,
}: AdminLoginVisualPanelProps) {
  return (
    <div className="admin-login-visual-panel">
      <div className="admin-login-visual-panel__content">
        <div className="admin-login-visual-panel__intro">
          <div className="admin-login-visual-panel__mark" aria-hidden="true">
            <AdminAuthLottie src={lottieSrc} />
          </div>

          <div className="admin-login-visual-panel__copy">
            <h2 className="admin-login-visual-panel__hello">{hello}</h2>
            {title ? <p className="admin-login-visual-panel__title">{title}</p> : null}
            <p className="admin-login-visual-panel__description">{description}</p>
          </div>
        </div>
      </div>

      <p className="admin-login-visual-panel__copyright">
        © {new Date().getFullYear()} ZYND. All rights reserved.
      </p>
    </div>
  );
}
