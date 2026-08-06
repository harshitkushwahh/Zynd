import { apiRequest } from "@/lib/api-client";

export type AdminPincodeLookup = {
  code: string;
  city: string;
  district: string;
  state_name: string;
  state_code: string;
  country_ansi_code: string;
};

export async function fetchAdminPincodeLookup(pincode: string) {
  return apiRequest<AdminPincodeLookup>(`/admin/master-data/pincode/${encodeURIComponent(pincode)}`);
}
