import { getCandidateList } from "@/actions/cv-generator";
import { CvEditorShell } from "@/components/cv-generator/cv-editor-shell";

export const runtime = "nodejs";

export default async function CvGeneratorPage() {
  const candidates = await getCandidateList();

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      <CvEditorShell candidates={candidates} />
    </div>
  );
}
