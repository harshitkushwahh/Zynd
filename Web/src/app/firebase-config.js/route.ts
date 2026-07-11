import { NextResponse } from "next/server";

import { getFirebaseWebConfig, isFirebaseWebConfigured } from "@/features/notifications/lib/firebase-web-config";

export async function GET() {
  if (!isFirebaseWebConfigured()) {
    return new NextResponse("self.__ZYND_FIREBASE_CONFIG__ = {};", {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const config = getFirebaseWebConfig();
  const body = `self.__ZYND_FIREBASE_CONFIG__ = ${JSON.stringify({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  })};`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
