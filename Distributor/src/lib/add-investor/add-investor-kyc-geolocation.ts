export type AddInvestorKycGeolocation = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

export class AddInvestorKycGeolocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AddInvestorKycGeolocationError";
  }
}

export function requestAddInvestorKycGeolocation(): Promise<AddInvestorKycGeolocation> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return Promise.reject(
      new AddInvestorKycGeolocationError(
        "Location access is required to submit KYC. Enable location in your browser and try again.",
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
            new AddInvestorKycGeolocationError(
              "Location permission was denied. Allow location access to complete KYC submission.",
            ),
          );
          return;
        }
        reject(
          new AddInvestorKycGeolocationError(
            "Could not read your location. Check browser permissions and try again.",
          ),
        );
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
    );
  });
}
