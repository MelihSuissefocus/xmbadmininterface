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
import { X, UserPlus, ChevronDown } from "lucide-react";

interface CandidateAssignmentProps {
  jobId: string;
  assignments: { assignment: JobCandidate; candidate: Candidate }[];
  availableCandidates: Candidate[];
}

const assignmentStatusColors = {
  proposed: "bg-muted text-muted-foreground",
  interviewing: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  offered: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  rejected: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  placed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
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
    <section className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-3 lg:p-4">
        <h2 className="text-sm font-semibold text-foreground">
          Kandidaten ({assignments.length})
        </h2>
        <Button
          size="sm"
          onClick={() => setShowAddModal(true)}
          className="bg-accent hover:bg-accent/90 text-accent-foreground h-8 text-xs"
          disabled={availableCandidates.length === 0}
        >
          <UserPlus className="h-3.5 w-3.5 mr-1" />
          Zuweisen
        </Button>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="border-b border-border p-3 lg:p-4 bg-muted/50">
          <p className="text-xs font-medium text-foreground mb-2">
            Kandidat auswählen
          </p>
          <select
            value={selectedCandidate}
            onChange={(e) => setSelectedCandidate(e.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm mb-3"
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
              className="bg-accent hover:bg-accent/90 text-accent-foreground h-8 text-xs"
            >
              {loading ? "..." : "Hinzufügen"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowAddModal(false)} className="h-8 text-xs">
              Abbrechen
            </Button>
          </div>
        </div>
      )}

      {/* Assigned Candidates List */}
      <div className="divide-y divide-border">
        {assignments.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">
            <p className="text-sm">Keine Kandidaten zugewiesen</p>
            <p className="text-xs mt-1">
              Klicke auf &quot;Zuweisen&quot; um Kandidaten hinzuzufügen
            </p>
          </div>
        ) : (
          assignments.map(({ assignment, candidate }) => {
            const skills = (candidate.skills as string[]) ?? [];

            return (
              <div key={candidate.id} className="p-3 lg:p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/dashboard/candidates/${candidate.id}`}
                    className="flex items-center gap-3 hover:opacity-80 min-w-0"
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-accent flex-shrink-0">
                      {candidate.firstName[0]}{candidate.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {candidate.firstName} {candidate.lastName}
                      </p>
                      {candidate.targetRole && (
                        <p className="text-xs text-muted-foreground truncate">{candidate.targetRole}</p>
                      )}
                    </div>
                  </Link>
                  <button
                    onClick={() => handleRemove(candidate.id, `${candidate.firstName} ${candidate.lastName}`)}
                    className="text-muted-foreground hover:text-destructive p-1 flex-shrink-0"
                    title="Entfernen"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Status Selector */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">Status:</span>
                  <div className="relative">
                    <select
                      value={assignment.status}
                      onChange={(e) =>
                        handleStatusChange(
                          candidate.id,
                          e.target.value as "proposed" | "interviewing" | "offered" | "rejected" | "placed"
                        )
                      }
                      className={`appearance-none rounded-full pl-2.5 pr-6 py-0.5 text-[10px] font-medium cursor-pointer ${
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
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none" />
                  </div>
                </div>

                {/* Skills Preview */}
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {skills.slice(0, 3).map((skill, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                    {skills.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">+{skills.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Contact */}
                {candidate.email && (
                  <p className="text-[10px] text-muted-foreground mt-1.5 truncate">{candidate.email}</p>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
