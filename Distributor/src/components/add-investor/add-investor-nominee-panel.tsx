"use client";

import { useState } from "react";
import { PencilLine, Plus, UserPlus, UserRound, X } from "lucide-react";

import { AddInvestorNomineeWizard } from "@/components/add-investor/add-investor-nominee-wizard";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getTotalNomineeShare,
  MAX_ADD_INVESTOR_NOMINEES,
  redistributeEqualNomineeShares,
  relationshipLabel,
  type AddInvestorNomineeRecord,
} from "@/lib/add-investor/add-investor-nominee";
import { cn } from "@/lib/utils";

type NomineeView = "list" | "add" | "edit";

type AddInvestorNomineePanelProps = {
  nominees: AddInvestorNomineeRecord[];
  onNomineesChange: (nominees: AddInvestorNomineeRecord[]) => void;
  onSubWizardActiveChange?: (active: boolean) => void;
};

function NomineeSlotIndicators({
  nominees,
  onSlotClick,
}: {
  nominees: AddInvestorNomineeRecord[];
  onSlotClick: (index: number) => void;
}) {
  return (
    <div className="add-investor-nominee-panel__slots">
      {Array.from({ length: MAX_ADD_INVESTOR_NOMINEES }, (_, index) => {
        const nominee = nominees[index];
        const isFilled = Boolean(nominee);
        return (
          <button
            key={index}
            type="button"
            className={cn(
              "add-investor-nominee-panel__slot",
              isFilled && "add-investor-nominee-panel__slot--filled",
            )}
            onClick={() => onSlotClick(index)}
          >
            <div className="add-investor-nominee-panel__slot-icon">
              {isFilled ? (
                <UserRound className="size-3.5" strokeWidth={2} />
              ) : (
                <Plus className="size-3.5" strokeWidth={2} />
              )}
            </div>
            <span className="add-investor-nominee-panel__slot-label">
              {isFilled ? nominee.core.fullName.split(" ")[0] : `Slot ${index + 1}`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function NomineeListCard({
  nominee,
  onEdit,
  onRemove,
}: {
  nominee: AddInvestorNomineeRecord;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="add-investor-nominee-panel__card">
      <div className="add-investor-nominee-panel__card-main">
        <div className="add-investor-nominee-panel__card-avatar">
          <UserRound className="size-4" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="add-investor-nominee-panel__card-title-row">
            <p className="add-investor-nominee-panel__card-name">{nominee.core.fullName}</p>
            <StatusBadge variant="neutral">
              {relationshipLabel(nominee.core.relationship)}
            </StatusBadge>
            <StatusBadge variant={nominee.type === "minor" ? "warning" : "info"}>
              {nominee.type === "minor" ? "Minor" : "Adult"}
            </StatusBadge>
          </div>
          <p className="add-investor-nominee-panel__card-meta">
            Age {nominee.core.age} · {nominee.core.sharePercent}% share
          </p>
        </div>
        <div className="add-investor-nominee-panel__card-actions">
          <button type="button" className="add-investor-nominee-panel__icon-btn" onClick={onEdit} aria-label="Edit nominee">
            <PencilLine className="size-4" />
          </button>
          <button
            type="button"
            className="add-investor-nominee-panel__icon-btn add-investor-nominee-panel__icon-btn--danger"
            onClick={onRemove}
            aria-label="Remove nominee"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddInvestorNomineePanel({
  nominees,
  onNomineesChange,
  onSubWizardActiveChange,
}: AddInvestorNomineePanelProps) {
  const [view, setView] = useState<NomineeView>("list");
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingNominee = editingId ? nominees.find((item) => item.id === editingId) : undefined;
  const totalShare = getTotalNomineeShare(nominees);
  const isEmpty = nominees.length === 0;

  const setViewState = (next: NomineeView) => {
    setView(next);
    onSubWizardActiveChange?.(next !== "list");
  };

  const handleSaveNominee = (nominee: AddInvestorNomineeRecord) => {
    const withoutCurrent = nominees.filter((item) => item.id !== nominee.id);
    const nextNominees = redistributeEqualNomineeShares([...withoutCurrent, nominee]);
    onNomineesChange(nextNominees);
    setEditingId(null);
    setViewState("list");
  };

  const handleRemove = (id: string) => {
    onNomineesChange(redistributeEqualNomineeShares(nominees.filter((item) => item.id !== id)));
  };

  const handleSlotClick = (index: number) => {
    const nominee = nominees[index];
    if (nominee) {
      setEditingId(nominee.id);
      setViewState("edit");
      return;
    }
    if (nominees.length < MAX_ADD_INVESTOR_NOMINEES) {
      setEditingId(null);
      setViewState("add");
    }
  };

  if (view === "add" || view === "edit") {
    return (
      <AddInvestorNomineeWizard
        existingNominees={nominees.filter((item) => item.id !== editingId)}
        editingNominee={editingNominee}
        onCancel={() => {
          setEditingId(null);
          setViewState("list");
        }}
        onSave={handleSaveNominee}
      />
    );
  }

  return (
    <div className={cn("add-investor-nominee-panel", isEmpty && "add-investor-nominee-panel--empty")}>
      {isEmpty ? (
        <div className="add-investor-nominee-panel__hero">
          <div className="add-investor-nominee-panel__hero-icon">
            <UserPlus className="size-6" strokeWidth={1.9} />
          </div>
          <h3 className="add-investor-nominee-panel__hero-title">No nominees added yet</h3>
          <p className="add-investor-nominee-panel__hero-copy">
            Nominee details are optional. Tap a slot below to add up to 3 nominees, or continue
            without adding one. Share is split equally when you save each nominee.
          </p>
          <NomineeSlotIndicators nominees={nominees} onSlotClick={handleSlotClick} />
        </div>
      ) : (
        <>
          <div className="add-investor-nominee-panel__header">
            <div>
              <p className="add-investor-nominee-panel__eyebrow">
                {nominees.length} of {MAX_ADD_INVESTOR_NOMINEES} nominees
              </p>
              <p className="add-investor-nominee-panel__share-total">
                Total share: <strong>{totalShare}%</strong>
                {totalShare !== 100 ? (
                  <span className="add-investor-nominee-panel__share-warning"> · must equal 100%</span>
                ) : null}
              </p>
            </div>
          </div>

          <NomineeSlotIndicators nominees={nominees} onSlotClick={handleSlotClick} />

          <div className="add-investor-nominee-panel__list">
            {nominees.map((nominee) => (
              <NomineeListCard
                key={nominee.id}
                nominee={nominee}
                onEdit={() => {
                  setEditingId(nominee.id);
                  setViewState("edit");
                }}
                onRemove={() => handleRemove(nominee.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
