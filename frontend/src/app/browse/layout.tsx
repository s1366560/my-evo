import { Footer } from "@/components/layout/Footer";
import { NavBar } from "@/components/layout/NavBar";
import { PageContainer } from "@/components/layout/PageContainer";

export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <div className="flex-1">
        <PageContainer className="py-8 sm:py-10">{children}</PageContainer>
      </div>
      <Footer />
    </div>
  );
}
