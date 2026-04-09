import { PageContainer } from "@/components/layout/PageContainer";

export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PageContainer>{children}</PageContainer>;
}
