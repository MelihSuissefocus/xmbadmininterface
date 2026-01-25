"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCandidate } from "@/actions/candidates";

interface DeleteCandidateButtonProps {
  id: string;
  name: string;
}

export function DeleteCandidateButton({ id, name }: DeleteCandidateButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`Möchtest du "${name}" wirklich löschen?`)) return;

    setLoading(true);
    const result = await deleteCandidate(id);
    setLoading(false);

    if (result.success) {
      router.refresh();
    } else {
      alert(result.message);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleDelete}
      disabled={loading}
      className="text-slate-400 hover:text-red-500"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

