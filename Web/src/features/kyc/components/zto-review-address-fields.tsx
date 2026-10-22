"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldMessage } from "@/components/ui/ui-message";
import { KycSelectField } from "@/features/kyc/components/kyc-select-field";
import { INDIAN_STATES } from "@/features/kyc/lib/indian-states";
import { KYC_ADDRESS_LIMITS } from "@/features/kyc/lib/kyc-address-validation";
import type { ZtoReviewFields } from "@/features/kyc/lib/zto-types";
import type { ZtoReviewErrors } from "@/features/kyc/lib/zto-review-validation";
import { copy } from "@/shared/config/copy";
import { cn } from "@/lib/utils";

const ADDRESS_KEYS = [
  "address_line_1",
  "address_line_2",
  "city",
  "state",
  "pincode",
] as const satisfies ReadonlyArray<keyof ZtoReviewFields>;

type AddressKey = (typeof ADDRESS_KEYS)[number];

type ZtoReviewAddressFieldsProps = {
  values: Pick<ZtoReviewFields, AddressKey>;
  errors: ZtoReviewErrors;
  disabled?: boolean;
  onChange: (key: AddressKey, value: string) => void;
  className?: string;
};

const fieldInputClass = "h-11 bg-background";

export function ZtoReviewAddressFields({
  values,
  errors,
  disabled = false,
  onChange,
  className,
}: ZtoReviewAddressFieldsProps) {
  const labels = copy.kyc.address.fields;
  const placeholders = copy.kyc.address.placeholders;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-2">
        <Label htmlFor="zto-address_line_1">{labels.line1}</Label>
        <Input
          id="zto-address_line_1"
          value={values.address_line_1 ?? ""}
          placeholder={placeholders.line1}
          disabled={disabled}
          maxLength={KYC_ADDRESS_LIMITS.line1.max}
          aria-invalid={Boolean(errors.address_line_1)}
          className={fieldInputClass}
          autoComplete="address-line1"
          onChange={(event) =>
            onChange("address_line_1", event.target.value.slice(0, KYC_ADDRESS_LIMITS.line1.max))
          }
        />
        {errors.address_line_1 ? <FieldMessage message={errors.address_line_1} /> : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="zto-address_line_2">{labels.line2}</Label>
        <Input
          id="zto-address_line_2"
          value={values.address_line_2 ?? ""}
          placeholder={placeholders.line2}
          disabled={disabled}
          maxLength={KYC_ADDRESS_LIMITS.line2.max}
          aria-invalid={Boolean(errors.address_line_2)}
          className={fieldInputClass}
          autoComplete="address-line2"
          onChange={(event) =>
            onChange("address_line_2", event.target.value.slice(0, KYC_ADDRESS_LIMITS.line2.max))
          }
        />
        {errors.address_line_2 ? <FieldMessage message={errors.address_line_2} /> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="zto-city">{labels.city}</Label>
          <Input
            id="zto-city"
            value={values.city ?? ""}
            placeholder={placeholders.city}
            disabled={disabled}
            maxLength={KYC_ADDRESS_LIMITS.city.max}
            aria-invalid={Boolean(errors.city)}
            className={fieldInputClass}
            autoComplete="address-level2"
            onChange={(event) =>
              onChange("city", event.target.value.slice(0, KYC_ADDRESS_LIMITS.city.max))
            }
          />
          {errors.city ? <FieldMessage message={errors.city} /> : null}
        </div>
        <div className="space-y-2">
          <KycSelectField
            id="zto-state"
            label={labels.state}
            value={values.state ?? ""}
            options={[...INDIAN_STATES]}
            placeholder={labels.statePlaceholder}
            disabled={disabled}
            hasError={Boolean(errors.state)}
            triggerClassName={cn(fieldInputClass, "w-full pl-3")}
            onChange={(value) => onChange("state", value)}
          />
          {errors.state ? <FieldMessage message={errors.state} /> : null}
        </div>
      </div>

      <div className="space-y-2 sm:max-w-[50%]">
        <Label htmlFor="zto-pincode">{labels.pincode}</Label>
        <Input
          id="zto-pincode"
          inputMode="numeric"
          value={values.pincode ?? ""}
          placeholder={placeholders.pincode}
          disabled={disabled}
          aria-invalid={Boolean(errors.pincode)}
          className={fieldInputClass}
          autoComplete="postal-code"
          onChange={(event) =>
            onChange("pincode", event.target.value.replace(/\D/g, "").slice(0, KYC_ADDRESS_LIMITS.pincode.length))
          }
        />
        {errors.pincode ? <FieldMessage message={errors.pincode} /> : null}
      </div>
    </div>
  );
}
