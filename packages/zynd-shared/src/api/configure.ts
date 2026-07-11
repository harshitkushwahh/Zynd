let apiUrl = "/api/v1";

export function configureApiClient(config: { apiUrl: string }) {
  apiUrl = config.apiUrl;
}

export function getApiUrl() {
  return apiUrl;
}
