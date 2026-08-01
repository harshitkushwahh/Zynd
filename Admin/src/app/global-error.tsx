"use client";

import { useEffect } from "react";
import Image from "next/image";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="admin-error-shell min-h-full antialiased">
        <div className="admin-error-card">
          <Image
            src="/zynda-h.png"
            alt="ZYND"
            width={160}
            height={44}
            className="admin-error-card__logo"
            priority
          />

          <h1 className="admin-error-card__title">Something went wrong</h1>

          <div className="admin-error-card__detail">
            <p className="admin-error-card__message">
              {error.message || "An unexpected error occurred."}
            </p>
            {error.digest ? (
              <p className="admin-error-card__digest">Error ID: {error.digest}</p>
            ) : null}
          </div>

          <button type="button" className="admin-error-card__action admin-auth-button admin-auth-button--primary" onClick={() => reset()}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
