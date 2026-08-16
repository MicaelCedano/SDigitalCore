import { PasswordResetForm } from "./PasswordResetForm";

export default async function RecuperarPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return <PasswordResetForm token={params.token} />;
}
