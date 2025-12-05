import { notFound } from "next/navigation";
import { getCandidateById } from "@/actions/candidates";
import { CandidateForm } from "@/components/candidates/candidate-form";

interface EditCandidatePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCandidatePage({ params }: EditCandidatePageProps) {
  const { id } = await params;
  const candidate = await getCandidateById(id);

  if (!candidate) {
    notFound();
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Kandidat bearbeiten
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {candidate.name}
        </p>
      </div>
      <CandidateForm candidate={candidate} />
    </div>
  );
}

