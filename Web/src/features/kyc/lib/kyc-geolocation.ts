import { copy } from "@/shared/config/copy";

export type KycGeolocationResult = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export type KycGeolocationErrorCode =
  | "unsupported"
  | "denied"
  | "unavailable"
  | "timeout"
  | "inaccurate"
  | "spoofed";

export class KycGeolocationError extends Error {
  code: KycGeolocationErrorCode;

  constructor(message: string, code: KycGeolocationErrorCode) {
    super(message);
    this.name = "KycGeolocationError";
    this.code = code;
  }
}

const LOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 0,
};

const MAX_ACCURACY_METERS = 5000;

/** Cybrilla POA kyc_forms reject coordinates with more than 6 decimal places. */
export function roundKycGeoCoordinate(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function mapBrowserGeolocationError(error: GeolocationPositionError): KycGeolocationError {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return new KycGeolocationError(copy.kyc.location.denied, "denied");
    case error.TIMEOUT:
      return new KycGeolocationError(copy.kyc.location.timeout, "timeout");
    default:
      return new KycGeolocationError(copy.kyc.location.unavailable, "unavailable");
  }
}

async function geolocationPermissionDenied(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) {
    return false;
  }
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state === "denied";
  } catch {
    return false;
  }
}

export async function requestKycGeolocation(): Promise<KycGeolocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new KycGeolocationError(copy.kyc.location.unsupported, "unsupported");
  }

  if (await geolocationPermissionDenied()) {
    throw new KycGeolocationError(copy.kyc.location.denied, "denied");
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => reject(mapBrowserGeolocationError(error)),
      LOCATION_OPTIONS,
    );
  });

  const coords = position.coords as GeolocationCoordinates & { mocked?: boolean };
  if (coords.mocked) {
    throw new KycGeolocationError(copy.kyc.location.spoofDetected, "spoofed");
  }

  if (coords.accuracy > MAX_ACCURACY_METERS) {
    throw new KycGeolocationError(copy.kyc.location.inaccurate, "inaccurate");
  }

  return {
    latitude: roundKycGeoCoordinate(coords.latitude),
    longitude: roundKycGeoCoordinate(coords.longitude),
    accuracy: coords.accuracy,
  };
}
