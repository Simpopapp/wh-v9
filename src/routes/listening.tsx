import { createFileRoute } from "@tanstack/react-router";

import { SectionPage } from "@/components/SectionPage";
import { sectionCountLabel } from "@/lib/pte";

export const Route = createFileRoute("/listening")({
  head: () => ({
    meta: [
      { title: "Listening — ditado e compreensão auditiva do PTE | Studie Plus" },
      {
        name: "description",
        content: `Write From Dictation, Fill in the Blanks e mais: treine a seção de escuta do PTE com ${sectionCountLabel("listening")} questões.`,
      },
      { property: "og:title", content: "Listening — Studie Plus" },
      { property: "og:description", content: "Ditado, lacunas e compreensão auditiva do PTE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <SectionPage section="listening" />,
});
