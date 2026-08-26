export type DistributorWorkGeolocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export class DistributorWorkGeolocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DistributorWorkGeolocationError";
  }
}

export function requestDistributorWorkGeolocation(): Promise<DistributorWorkGeolocation> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return Promise.reject(
      new DistributorWorkGeolocationError(
        "Location access is required to sign in for work. Enable location in your browser and try again.",
      ),
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(
            new DistributorWorkGeolocationError(
              "Location permission was denied. Allow location access to sign in for work.",
            ),
          );
          return;
        }
        reject(
          new DistributorWorkGeolocationError(
            "Could not read your location. Check browser permissions and try again.",
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
    );
  });
}

export function formatWorkGeolocation(coords: DistributorWorkGeolocation): string {
  return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)} · ±${Math.round(coords.accuracy)}m`;
}
