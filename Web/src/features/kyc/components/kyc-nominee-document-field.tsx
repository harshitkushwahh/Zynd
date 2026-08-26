"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import {
  getNomineeDocumentMaxLength,
  getNomineeDocumentPlaceholder,
  normalizeNomineeDocumentNumber,
  nomineeDocumentUsesUppercaseInput,
  validateKycNomineeDocument,
} from "@/features/kyc/lib/kyc-nominee-document";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

type KycNomineeDocumentNumberFieldProps = {
  id: string;
  documentType: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onErrorChange: (message?: string) => void;
};

export function KycNomineeDocumentNumberField({
  id,
  documentType,
  value,
  error,
  onChange,
  onErrorChange,
}: KycNomineeDocumentNumberFieldProps) {
  const maxLength = documentType ? getNomineeDocumentMaxLength(documentType) : undefined;
  const placeholder = documentType
    ? getNomineeDocumentPlaceholder(documentType)
    : copy.kyc.nominee.selectDocumentTypeFirst;

  const handleChange = (rawValue: string) => {
    const normalized = documentType
      ? normalizeNomineeDocumentNumber(documentType, rawValue)
      : rawValue;
    onChange(normalized);

    if (error && documentType) {
      const nextError = validateKycNomineeDocument(documentType, normalized);
      onErrorChange(nextError);
    }
  };

  const handleBlur = () => {
    if (!documentType || !value.trim()) return;
    onErrorChange(validateKycNomineeDocument(documentType, value));
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{copy.kyc.nominee.fields.documentNumber} *</Label>
      <Input
        id={id}
        value={value}
        disabled={!documentType}
        inputMode={documentType === "aadhaar" || documentType === "Aadhaar" ? "numeric" : "text"}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={Boolean(error)}
        className={cn(
          documentType &&
            nomineeDocumentUsesUppercaseInput(documentType) &&
            "font-mono uppercase tracking-[0.08em]",
        )}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
      />
      {error ? <FieldMessage message={error} /> : null}
    </div>
  );
}
