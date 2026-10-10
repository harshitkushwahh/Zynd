export type SupportClientCapturedDetailRow = {
  id: string;
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
  verified?: boolean;
};

export type SupportClientCapturedField = {
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
};

export type SupportClientCapturedSlide = {
  id: string;
  fields: SupportClientCapturedField[];
  verified?: boolean;
};

export type SupportClientCapturedProfile = {
  contact: {
    emailMasked: string;
    mobileMasked: string;
  };
  signIn: {
    google: {
      connected: boolean;
      linkedEmailMasked: string | null;
    };
    apple: {
      connected: boolean;
      linkedEmailMasked: string | null;
    };
  };
  identity: {
    legalFullName: string;
    dateOfBirth: string;
    panMasked: string;
    panCategory: string;
  };
  bankSlides: SupportClientCapturedSlide[];
  bankVerified: boolean;
  address: {
    permanent: string;
    correspondenceSlides: SupportClientCapturedSlide[];
  };
  detailRows: SupportClientCapturedDetailRow[];
};
