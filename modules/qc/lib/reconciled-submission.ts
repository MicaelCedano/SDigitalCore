type Audit = { entityId: string | null; createdAt: Date; afterData: unknown };

// Una reparación pagada cubre los envíos anteriores del mismo revisor y
// los dos lotes reconciliados; nunca cubre una entrega posterior.
export function isReconciledSubmission(submission: Audit, repairs: Audit[]): boolean {
  const data = submission.afterData as Record<string, unknown> | null;
  if (!data || typeof data.reviewerId !== "string" || !submission.entityId) return false;
  return repairs.some((repair) => {
    const paid = repair.afterData as Record<string, unknown> | null;
    return paid?.paidReviewers === 1 && paid.reviewerId === data.reviewerId
      && Number(paid.amount) > 0
      && (repair.entityId === submission.entityId || paid.duplicateBatchId === submission.entityId)
      && repair.createdAt > submission.createdAt
      && Number(paid.devicesMoved) === Number(data.reviewedDevices);
  });
}
