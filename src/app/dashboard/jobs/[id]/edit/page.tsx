import { notFound } from "next/navigation";
import { getJobById } from "@/actions/jobs";
import { JobForm } from "@/components/jobs/job-form";

interface EditJobPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditJobPage({ params }: EditJobPageProps) {
  const { id } = await params;
  const job = await getJobById(id);

  if (!job) {
    notFound();
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Stelle bearbeiten
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{job.title}</p>
      </div>
      <JobForm job={job} />
    </div>
  );
}

