declare global {
  type RegistrationResponseJSON = {
    id: string;
    rawId: string;
    type: PublicKeyCredentialType;
    authenticatorAttachment?: AuthenticatorAttachment;
    clientExtensionResults: AuthenticationExtensionsClientOutputs;
    response: {
      clientDataJSON: string;
      attestationObject: string;
      transports?: AuthenticatorTransport[];
    };
  };

  type AuthenticationResponseJSON = {
    id: string;
    rawId: string;
    type: PublicKeyCredentialType;
    authenticatorAttachment?: AuthenticatorAttachment;
    clientExtensionResults: AuthenticationExtensionsClientOutputs;
    response: {
      clientDataJSON: string;
      authenticatorData: string;
      signature: string;
      userHandle?: string;
    };
  };

  type PublicKeyCredentialCreationOptionsJSON = Omit<
    PublicKeyCredentialCreationOptions,
    "challenge" | "user" | "excludeCredentials"
  > & {
    challenge: string;
    user: Omit<PublicKeyCredentialUserEntity, "id"> & { id: string };
    excludeCredentials?: Array<Omit<PublicKeyCredentialDescriptor, "id"> & { id: string }>;
  };

  type PublicKeyCredentialRequestOptionsJSON = Omit<
    PublicKeyCredentialRequestOptions,
    "challenge" | "allowCredentials"
  > & {
    challenge: string;
    allowCredentials?: Array<Omit<PublicKeyCredentialDescriptor, "id"> & { id: string }>;
  };
}

export {};
