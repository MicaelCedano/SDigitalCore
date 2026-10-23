type InspectionAuthor = {
  reviewerId: string | null;
  reviewerNameSnapshot: string;
  reviewer?: { roleCode: string } | null;
  functionalityNotes?: string | null;
};

/** Administrative recovery checks are history, not the employee's QC review. */
export function isAdministrativeQcReview(inspection: InspectionAuthor): boolean {
  const snapshotName = inspection.reviewerNameSnapshot.trim().toLocaleLowerCase("es");
  return inspection.reviewer?.roleCode === "ADMIN"
    || (!inspection.reviewerId && ["admin", "administrador", "administración"].includes(snapshotName))
    || inspection.functionalityNotes?.trim() === "Marcado funcional por administración (verificación física)";
}
