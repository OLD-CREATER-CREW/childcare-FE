import { AuthGate } from "@/components/AuthGate";
import { Shell } from "@/components/layout/Shell";
import { TemplateBootstrap } from "@/components/TemplateBootstrap";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <TemplateBootstrap />
      <Shell>{children}</Shell>
    </AuthGate>
  );
}
