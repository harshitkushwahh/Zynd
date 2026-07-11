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

export async function requestKycGeolocation(): Promise<KycGeolocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new KycGeolocationError(copy.kyc.location.unsupported, "unsupported");
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
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: coords.accuracy,
  };
}
