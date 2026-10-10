import type { DistributorClientAddress, DistributorClientProfile } from "@/lib/distributor-types";
import type {
  SupportClientCapturedProfile,
  SupportClientCapturedSlide,
} from "@/lib/support-client-captured-profile-model";
import { formatDistributorDate } from "@/lib/format";
import { DISTRIBUTOR_CLIENT_COPY } from "@/lib/distributor-client-copy";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `${phone.slice(0, 3)}${"•".repeat(Math.max(4, digits.length - 5))}${digits.slice(-4)}`;
}

function formatAddressBlock(address: DistributorClientAddress | undefined): string {
  if (!address) return "Not captured";
  return [
    [address.line1, address.line2].filter(Boolean).join(", "),
    [address.city, address.state, address.postalCode].filter(Boolean).join(", "),
    address.country,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildBankSlide(
  profile: DistributorClientProfile,
  account: DistributorClientProfile["personalInfo"]["bankAccounts"][number],
): SupportClientCapturedSlide {
  const copy = DISTRIBUTOR_CLIENT_COPY.capturedProfile.cards;
  const verified =
    account.verificationStatus === "verified" || profile.investor.complianceStatus === "Compliant";

  return {
    id: account.id,
    verified,
    fields: [
      { label: copy.bankAccount, value: account.accountNumberMasked, mono: true },
      { label: DISTRIBUTOR_CLIENT_COPY.identity.ifsc, value: account.ifscCode ?? "—", mono: true },
      { label: copy.bankName, value: account.bankName },
      ...(account.accountType
        ? [{ label: copy.accountType, value: account.accountType }]
        : []),
    ],
  };
}

function buildCorrespondenceSlides(
  permanentText: string,
  addresses: DistributorClientProfile["personalInfo"]["addresses"],
): SupportClientCapturedSlide[] {
  const copy = DISTRIBUTOR_CLIENT_COPY.capturedProfile.cards;
  const nonPermanent = addresses.filter((row) => !row.label.toLowerCase().includes("permanent"));

  const slides: SupportClientCapturedSlide[] = [];
  const seen = new Set<string>();
  let addedSameAsPermanent = false;

  const pushSlide = (id: string, value: string, multiline: boolean) => {
    const key = value.trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    slides.push({
      id,
      fields: [{ label: copy.correspondence, value, multiline }],
    });
  };

  for (const address of nonPermanent) {
    const block = formatAddressBlock(address);
    if (block.trim() === permanentText.trim()) {
      if (!addedSameAsPermanent) {
        pushSlide(`${address.id}-same`, copy.correspondenceMatchesPermanent, false);
        addedSameAsPermanent = true;
      }
      continue;
    }
    pushSlide(address.id, block, true);
  }

  if (!addedSameAsPermanent) {
    pushSlide("correspondence-same-as-permanent", copy.correspondenceMatchesPermanent, false);
  }

  if (slides.length === 0) {
    slides.push({
      id: "correspondence-fallback",
      fields: [{ label: copy.correspondence, value: copy.correspondenceMatchesPermanent }],
    });
  }

  return slides;
}

export function buildSupportClientCapturedProfile(
  profile: DistributorClientProfile,
): SupportClientCapturedProfile {
  const { investor, displayName, emailDisplay, contactPhone, personalInfo } = profile;
  const cardCopy = DISTRIBUTOR_CLIENT_COPY.capturedProfile.cards;
  const identityCopy = DISTRIBUTOR_CLIENT_COPY.identity;

  const primaryAddress =
    personalInfo.addresses.find((row) => row.isPrimary) ??
    personalInfo.addresses.find((row) => row.label.toLowerCase().includes("permanent")) ??
    personalInfo.addresses[0];

  const emailMasked = investor.emailMasked || maskEmail(emailDisplay);
  const mobileMasked = investor.mobileMasked || maskPhone(contactPhone);

  const permanentLines = formatAddressBlock(primaryAddress);

  const bankSlides =
    personalInfo.bankAccounts.length > 0
      ? personalInfo.bankAccounts.map((account) => buildBankSlide(profile, account))
      : [
          {
            id: "bank-fallback",
            verified: investor.complianceStatus === "Compliant",
            fields: [
              { label: cardCopy.bankAccount, value: "•••• 7890", mono: true },
              { label: identityCopy.ifsc, value: "HDFC0001234", mono: true },
              { label: cardCopy.bankName, value: "HDFC Bank" },
            ],
          },
        ];

  const bankVerified = bankSlides.some((slide) => slide.verified);

  const correspondenceSlides = buildCorrespondenceSlides(permanentLines, personalInfo.addresses);

  const google = personalInfo.connectedAccounts.google;
  const apple = personalInfo.connectedAccounts.apple;

  const signIn = {
    google: {
      connected: google.connected,
      linkedEmailMasked: google.connected
        ? google.emailMasked?.trim() || maskEmail("priya.sharma@gmail.com")
        : null,
    },
    apple: {
      connected: apple.connected,
      linkedEmailMasked: apple.connected
        ? apple.emailMasked?.trim() || maskEmail("priya@privaterelay.appleid.com")
        : null,
    },
  };

  const identity = {
    legalFullName: displayName,
    dateOfBirth: "14 Aug 1992",
    panMasked: investor.panMasked,
    panCategory: "Individual",
  };

  const personal = {
    fathersName: "Ravi Nair",
    gender: "Female",
    incomeSlab: "₹10 lakhs – ₹25 lakhs",
    occupation: "Salaried",
    maritalStatus: "Married",
    spouseName: "Arjun Nair",
    pepExposed: "No",
    placeOfBirth: "Kochi",
    nationality: "India",
  };

  const detailRows: SupportClientCapturedProfile["detailRows"] = [
    { id: "full-name", label: "Full name (PAN)", value: identity.legalFullName },
    { id: "dob", label: "Date of birth", value: identity.dateOfBirth },
    { id: "pan", label: "PAN", value: identity.panMasked, mono: true },
    { id: "pan-category", label: "PAN category", value: identity.panCategory },
    { id: "email", label: "Email", value: emailMasked },
    { id: "mobile", label: "Mobile", value: mobileMasked, mono: true },
    {
      id: "google-connected",
      label: cardCopy.googleConnected,
      value: signIn.google.connected ? identityCopy.connected : identityCopy.notConnected,
    },
    {
      id: "google-email",
      label: cardCopy.googleLinkedEmail,
      value: signIn.google.linkedEmailMasked ?? cardCopy.notLinked,
    },
    {
      id: "apple-connected",
      label: cardCopy.appleConnected,
      value: signIn.apple.connected ? identityCopy.connected : identityCopy.notConnected,
    },
    {
      id: "apple-email",
      label: cardCopy.appleLinkedEmail,
      value: signIn.apple.linkedEmailMasked ?? cardCopy.notLinked,
    },
    { id: "fathers-name", label: "Father's name", value: personal.fathersName },
    { id: "gender", label: "Gender", value: personal.gender },
    { id: "income", label: "Income slab", value: personal.incomeSlab },
    { id: "occupation", label: "Occupation", value: personal.occupation },
    { id: "marital", label: "Marital status", value: personal.maritalStatus },
    ...(personal.spouseName
      ? [{ id: "spouse", label: "Spouse name", value: personal.spouseName }]
      : []),
    { id: "nationality", label: "Nationality", value: personal.nationality },
    { id: "pob", label: "Place of birth", value: personal.placeOfBirth },
    { id: "pep", label: "PEP exposed", value: personal.pepExposed },
    {
      id: "address-permanent",
      label: cardCopy.permanentAddress,
      value: permanentLines,
      multiline: true,
    },
    ...correspondenceSlides.map((slide, index) => {
      const field = slide.fields[0];
      return {
        id: `address-correspondence-${slide.id}`,
        label:
          correspondenceSlides.length > 1
            ? `${cardCopy.correspondence} (${index + 1})`
            : cardCopy.correspondence,
        value: field?.value ?? "—",
        multiline: field?.multiline,
      };
    }),
    ...bankSlides.flatMap((slide, index) => {
      const accountField = slide.fields.find((f) => f.label === cardCopy.bankAccount);
      const ifscField = slide.fields.find((f) => f.label === identityCopy.ifsc);
      const nameField = slide.fields.find((f) => f.label === cardCopy.bankName);
      const suffix = bankSlides.length > 1 ? ` (${index + 1})` : "";
      return [
        {
          id: `bank-account-${slide.id}`,
          label: `${cardCopy.bankAccount}${suffix}`,
          value: accountField?.value ?? "—",
          mono: true,
        },
        {
          id: `bank-ifsc-${slide.id}`,
          label: `IFSC${suffix}`,
          value: ifscField?.value ?? "—",
          mono: true,
        },
        {
          id: `bank-name-${slide.id}`,
          label: `${cardCopy.bankName}${suffix}`,
          value: nameField?.value ?? "—",
        },
      ];
    }),
    {
      id: "kyc-status",
      label: "KYC status",
      value: investor.complianceStatus === "Compliant" ? "Verified" : profile.kycOverallStatus,
      verified: investor.complianceStatus === "Compliant",
    },
    {
      id: "member-since",
      label: "Member since",
      value: formatDistributorDate(investor.createdAt),
    },
  ];

  return {
    contact: { emailMasked, mobileMasked },
    signIn,
    identity,
    bankSlides,
    bankVerified,
    address: {
      permanent: permanentLines,
      correspondenceSlides,
    },
    detailRows,
  };
}
