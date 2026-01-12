"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Candidate, JobCandidate } from "@/db/schema";
import {
  assignCandidateToJob,
  updateAssignmentStatus,
  removeAssignment,
} from "@/actions/jobs";
import { Plus, X, UserPlus, ChevronDown } from "lucide-react";

interface CandidateAssignmentProps {
  jobId: string;
  assignments: { assignment: JobCandidate; candidate: Candidate }[];
  availableCandidates: Candidate[];
}

const assignmentStatusColors = {
  proposed: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
  interviewing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  offered: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  placed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const assignmentStatusLabels = {
  proposed: "Vorgeschlagen",
  interviewing: "Im Interview",
  offered: "Angebot",
  rejected: "Abgelehnt",
  placed: "Platziert",
};

export function CandidateAssignment({
  jobId,
  assignments,
  availableCandidates,
}: CandidateAssignmentProps) {
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAssign = async () => {
    if (!selectedCandidate) return;
    setLoading(true);
    const result = await assignCandidateToJob(jobId, selectedCandidate);
    setLoading(false);

    if (result.success) {
      setShowAddModal(false);
      setSelectedCandidate("");
      router.refresh();
    } else {
      alert(result.message);
    }
  };

  const handleStatusChange = async (
    candidateId: string,
    newStatus: "proposed" | "interviewing" | "offered" | "rejected" | "placed"
  ) => {
    const result = await updateAssignmentStatus(jobId, candidateId, newStatus);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.message);
    }
  };

  const handleRemove = async (candidateId: string, name: string) => {
    if (!confirm(`"${name}" wirklich von dieser Stelle entfernen?`)) return;
    const result = await removeAssignment(jobId, candidateId);
    if (result.success) {
      router.refresh();
    } else {
      alert(result.message);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          Kandidaten ({assignments.length})
        </h2>
        <Button
          size="sm"
          onClick={() => setShowAddModal(true)}
          className="bg-amber-500 hover:bg-amber-400 text-black"
          disabled={availableCandidates.length === 0}
        >
          <UserPlus className="h-4 w-4 mr-1" />
          Zuweisen
        </Button>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="border-b border-slate-200 p-4 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            Kandidat auswählen
          </p>
          <select
            value={selectedCandidate}
            onChange={(e) => setSelectedCandidate(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 mb-3"
          >
            <option value="">-- Auswählen --</option>
            {availableCandidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.firstName} {c.lastName} {c.targetRole ? `(${c.targetRole})` : ""}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAssign}
              disabled={!selectedCandidate || loading}
              className="bg-amber-500 hover:bg-amber-400 text-black"
            >
              {loading ? "..." : "Hinzufügen"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddModal(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {/* Assigned Candidates List */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {assignments.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <p>Keine Kandidaten zugewiesen</p>
            <p className="text-sm mt-1">
              Klicke auf &quot;Zuweisen&quot; um Kandidaten hinzuzufügen
            </p>
          </div>
        ) : (
          assignments.map(({ assignment, candidate }) => {
            const skills = (candidate.skills as string[]) ?? [];

            return (
              <div key={candidate.id} className="p-4">
                <div className="flex items-start justify-between">
                  <Link
                    href={`/dashboard/candidates/${candidate.id}`}
                    className="flex items-center gap-3 hover:opacity-80"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-amber-400">
                      {candidate.firstName[0]}{candidate.lastName[0]}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {candidate.firstName} {candidate.lastName}
                      </p>
                      {candidate.targetRole && (
                        <p className="text-sm text-slate-500">{candidate.targetRole}</p>
                      )}
                    </div>
                  </Link>
                  <button
                    onClick={() => handleRemove(candidate.id, `${candidate.firstName} ${candidate.lastName}`)}
                    className="text-slate-400 hover:text-red-500 p-1"
                    title="Entfernen"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Status Selector */}
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Status:</span>
                  <div className="relative">
                    <select
                      value={assignment.status}
                      onChange={(e) =>
                        handleStatusChange(
                          candidate.id,
                          e.target.value as "proposed" | "interviewing" | "offered" | "rejected" | "placed"
                        )
                      }
                      className={`appearance-none rounded-full pl-3 pr-7 py-1 text-xs font-medium cursor-pointer ${
                        assignmentStatusColors[assignment.status]
                      }`}
                    >
                      {(
                        ["proposed", "interviewing", "offered", "rejected", "placed"] as const
                      ).map((status) => (
                        <option key={status} value={status}>
                          {assignmentStatusLabels[status]}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none" />
                  </div>
                </div>

                {/* Skills Preview */}
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {skills.slice(0, 4).map((skill, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      >
                        {skill}
                      </span>
                    ))}
                    {skills.length > 4 && (
                      <span className="text-xs text-slate-400">+{skills.length - 4}</span>
                    )}
                  </div>
                )}

                {/* Contact */}
                {candidate.email && (
                  <p className="text-xs text-slate-500 mt-2">{candidate.email}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

