"use client";

import type {
  KycPayloadDisplay,
  KycPayloadScalarField,
} from "@/lib/kyc-payload-fields";
import { cn } from "@/lib/utils";

function PayloadFieldCard({ field }: { field: KycPayloadScalarField }) {
  return (
    <article className="support-kyc-payload-field-card">
      <p className="support-kyc-payload-field-card__label">{field.label}</p>
      <p
        className={cn(
          "support-kyc-payload-field-card__value",
          field.mono && "support-kyc-payload-field-card__value--mono",
        )}
      >
        {field.value}
      </p>
    </article>
  );
}

function PayloadFieldGrid({ fields }: { fields: KycPayloadScalarField[] }) {
  if (fields.length === 0) return null;
  return (
    <div className="support-kyc-payload-field-grid">
      {fields.map((field) => (
        <PayloadFieldCard key={field.id} field={field} />
      ))}
    </div>
  );
}

type ClientKycPayloadFieldCardsProps = {
  display: KycPayloadDisplay;
  className?: string;
};

export function ClientKycPayloadFieldCards({ display, className }: ClientKycPayloadFieldCardsProps) {
  const hasContent =
    display.fields.length > 0 || display.groups.length > 0 || display.lists.length > 0;

  if (!hasContent) {
    return (
      <p className="text-compact text-muted-foreground">No fields recorded for this snapshot.</p>
    );
  }

  return (
    <div className={cn("support-kyc-payload-field-cards", className)}>
      <PayloadFieldGrid fields={display.fields} />
      {display.groups.map((group) => (
        <section key={group.id} className="support-kyc-payload-field-group">
          <h4 className="support-kyc-payload-field-group__title">{group.title}</h4>
          <PayloadFieldGrid fields={group.fields} />
        </section>
      ))}
      {display.lists.map((list) => (
        <section key={list.id} className="support-kyc-payload-field-group">
          <h4 className="support-kyc-payload-field-group__title">{list.title}</h4>
          <div className="support-kyc-payload-field-list">
            {list.items.map((itemFields, index) => (
              <article key={`${list.id}-${index}`} className="support-kyc-payload-field-list__item">
                <p className="support-kyc-payload-field-list__item-title">
                  {list.title.replace(/s$/, "")} {index + 1}
                </p>
                <PayloadFieldGrid fields={itemFields} />
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
