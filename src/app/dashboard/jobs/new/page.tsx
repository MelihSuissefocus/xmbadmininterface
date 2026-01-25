import { JobForm } from "@/components/jobs/job-form";

export default function NewJobPage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Neue Stelle anlegen
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Erfasse alle Details zur Vakanz
        </p>
      </div>
      <JobForm />
    </div>
  );
}

