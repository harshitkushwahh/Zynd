import { apiRequest } from "@/lib/api-client";

export type AdminState = {
  state_name: string;
  state_code: string;
};

export type AdminPincodeLookup = {
  code: string;
  city: string;
  district: string;
  state_name: string;
  state_code: string;
  country_ansi_code: string;
};

export async function fetchAdminStates() {
  return apiRequest<AdminState[]>("/admin/master-data/states");
}

export async function fetchAdminPincodeLookup(pincode: string) {
  return apiRequest<AdminPincodeLookup>(`/admin/master-data/pincode/${encodeURIComponent(pincode)}`);
}
