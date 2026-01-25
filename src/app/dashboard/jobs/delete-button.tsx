"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteJob } from "@/actions/jobs";

interface DeleteJobButtonProps {
  id: string;
  title: string;
}

export function DeleteJobButton({ id, title }: DeleteJobButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm(`Möchtest du "${title}" wirklich löschen?`)) return;

    setLoading(true);
    const result = await deleteJob(id);
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

