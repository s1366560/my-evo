import { AuthLayout } from "@/components/auth/AuthLayout";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: "Reset password — EvoMap Hub",
};

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Choose a new password" subtitle="Your new password must be at least 8 characters">
      <ResetPasswordForm />
    </AuthLayout>
  );
}
