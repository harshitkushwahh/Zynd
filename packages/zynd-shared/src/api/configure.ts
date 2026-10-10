let apiUrl = "/api/v1";
let clientKind: "web" | "admin" | "distributor" | "support" = "web";

export function configureApiClient(config: {
  apiUrl: string;
  clientKind?: "web" | "admin" | "distributor" | "support";
}) {
  apiUrl = config.apiUrl;
  if (config.clientKind) {
    clientKind = config.clientKind;
  }
}

export function getApiUrl() {
  return apiUrl;
}

export function getClientKind() {
  return clientKind;
}
