import crypto from "node:crypto";

function verificationSecret() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Falta AUTH_SECRET para firmar la verificación de penalidades.");
  return secret;
}

export function createPenaltyVerificationToken(penaltyId: string) {
  return crypto.createHmac("sha256", verificationSecret()).update(`penalty:${penaltyId}`).digest("base64url");
}

export function isValidPenaltyVerificationToken(penaltyId: string, token: string) {
  try {
    const expected = Buffer.from(createPenaltyVerificationToken(penaltyId));
    const received = Buffer.from(token);
    return expected.length === received.length && crypto.timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

export function getPenaltyVerificationUrl(penaltyId: string) {
  const baseUrl = (process.env.NEXTAUTH_URL || "https://sdigitalcore.vercel.app").replace(/\/$/, "");
  const params = new URLSearchParams({ id: penaltyId, token: createPenaltyVerificationToken(penaltyId) });
  return `${baseUrl}/verificar/penalidad?${params.toString()}`;
}
