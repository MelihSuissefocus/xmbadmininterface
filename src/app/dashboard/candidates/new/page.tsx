import { CandidateForm } from "@/components/candidates/candidate-form";

export default function NewCandidatePage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Neuen Kandidaten anlegen
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Erfasse alle relevanten Informationen zum Kandidaten
        </p>
      </div>
      <CandidateForm />
    </div>
  );
}

