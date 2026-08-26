"use client";

import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export const ADMIN_AUTH_LOTTIE_SRC = "/Unlocked.lottie";
export const ADMIN_INVITE_LOTTIE_SRC = "/Send-letter.lottie";
const ADMIN_LOGIN_LOTTIE_SIZE_PX = 112;

type AdminAuthLottieProps = {
  src?: string;
};

export function AdminAuthLottie({ src = ADMIN_AUTH_LOTTIE_SRC }: AdminAuthLottieProps) {
  return (
    <div className="admin-login-visual-panel__lottie-shell">
      <DotLottieReact
        src={src}
        loop
        autoplay
        layout={{ fit: "contain", align: [0, 0] }}
        renderConfig={{
          autoResize: true,
          devicePixelRatio: 2,
        }}
        style={{
          width: ADMIN_LOGIN_LOTTIE_SIZE_PX,
          height: ADMIN_LOGIN_LOTTIE_SIZE_PX,
        }}
      />
    </div>
  );
}

/** @deprecated Use AdminAuthLottie */
export function AdminLoginVisualLottie() {
  return <AdminAuthLottie />;
}
