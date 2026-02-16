import { OpenResume } from "@/components/open-resume/OpenResume";

export const runtime = "nodejs";

import { getAllCandidates } from "@/actions/candidates";

export default async function CvGeneratorPage() {
  const candidates = await getAllCandidates();

  return (
    <div className="h-full -m-6">
      <OpenResume candidates={candidates} />
    </div>
  );
}
