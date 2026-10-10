export type KycPayloadScalarField = {
  id: string;
  label: string;
  value: string;
  mono?: boolean;
};

export type KycPayloadObjectGroup = {
  id: string;
  title: string;
  fields: KycPayloadScalarField[];
};

export type KycPayloadListGroup = {
  id: string;
  title: string;
  items: KycPayloadScalarField[][];
};

export type KycPayloadDisplay = {
  fields: KycPayloadScalarField[];
  groups: KycPayloadObjectGroup[];
  lists: KycPayloadListGroup[];
};

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatScalar(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return null;
}

const MONO_KEY_PATTERN = /(^id$|_id$|ifsc|pan|code|ref|token|email|mobile|phone)/i;

function fieldId(prefix: string, key: string): string {
  return prefix ? `${prefix}.${key}` : key;
}

function scalarFieldsFromObject(
  obj: Record<string, unknown>,
  prefix: string,
): KycPayloadScalarField[] {
  const fields: KycPayloadScalarField[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const formatted = formatScalar(value);
    if (formatted == null) continue;
    fields.push({
      id: fieldId(prefix, key),
      label: humanizeKey(key),
      value: formatted,
      mono: MONO_KEY_PATTERN.test(key),
    });
  }
  return fields;
}

export function buildKycPayloadDisplay(payload: Record<string, unknown>): KycPayloadDisplay {
  const fields: KycPayloadScalarField[] = [];
  const groups: KycPayloadObjectGroup[] = [];
  const lists: KycPayloadListGroup[] = [];

  for (const [key, value] of Object.entries(payload)) {
    if (value == null) continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      const items = value
        .map((entry, index) => {
          if (!isPlainObject(entry)) {
            const scalar = formatScalar(entry);
            return scalar ? [{ id: `${key}.${index}`, label: "Value", value: scalar }] : [];
          }
          return scalarFieldsFromObject(entry, `${key}.${index}`);
        })
        .filter((item) => item.length > 0);
      if (items.length > 0) {
        lists.push({
          id: key,
          title: humanizeKey(key),
          items,
        });
      }
      continue;
    }

    if (isPlainObject(value)) {
      const nested = scalarFieldsFromObject(value, key);
      if (nested.length > 0) {
        groups.push({
          id: key,
          title: humanizeKey(key),
          fields: nested,
        });
      }
      continue;
    }

    const formatted = formatScalar(value);
    if (formatted != null) {
      fields.push({
        id: key,
        label: humanizeKey(key),
        value: formatted,
        mono: MONO_KEY_PATTERN.test(key),
      });
    }
  }

  return { fields, groups, lists };
}

export function kycPayloadPreviewSummary(payload: Record<string, unknown>, maxItems = 3): string[] {
  const display = buildKycPayloadDisplay(payload);
  const chips: string[] = [];

  for (const field of display.fields) {
    if (chips.length >= maxItems) break;
    chips.push(`${field.label}: ${field.value}`);
  }

  if (chips.length < maxItems) {
    for (const group of display.groups) {
      if (chips.length >= maxItems) break;
      const first = group.fields[0];
      if (first) chips.push(`${group.title}: ${first.value}`);
    }
  }

  if (chips.length === 0) {
    const objectLabel = formatScalar(payload.object) ?? formatScalar(payload.status);
    if (objectLabel) chips.push(objectLabel);
  }

  return chips;
}
