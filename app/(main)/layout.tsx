import { Shell } from "@/components/layout/Shell";
import { TemplateBootstrap } from "@/components/TemplateBootstrap";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TemplateBootstrap />
      <Shell>{children}</Shell>
    </>
  );
}
