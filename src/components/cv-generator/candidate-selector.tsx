"use client";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User } from "lucide-react";

interface CandidateOption {
  id: string;
  firstName: string;
  lastName: string;
}

interface CandidateSelectorProps {
  candidates: CandidateOption[];
  value: string;
  onChange: (candidateId: string) => void;
  loading?: boolean;
}

export function CandidateSelector({
  candidates,
  value,
  onChange,
  loading,
}: CandidateSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <User className="h-4 w-4 shrink-0 text-muted-foreground" />
      <Select value={value} onValueChange={onChange} disabled={loading}>
        <SelectTrigger className="w-72">
          <SelectValue placeholder="Kandidat auswählen…" />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.lastName}, {c.firstName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {loading && (
        <span className="text-xs text-muted-foreground animate-pulse">
          Laden…
        </span>
      )}
    </div>
  );
}
