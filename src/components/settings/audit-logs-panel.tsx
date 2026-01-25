"use client";

import { History } from "lucide-react";

interface AuditLog {
  log: {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    details: unknown;
    ipAddress: string | null;
    createdAt: Date | null;
  };
  user: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface AuditLogsPanelProps {
  logs: AuditLog[];
}

export function AuditLogsPanel({ logs }: AuditLogsPanelProps) {
  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat("de-DE", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(date));
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500">
          <History className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Audit Logs
          </h2>
          <p className="text-sm text-slate-500">Letzte {logs.length} Aktivitäten</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">Zeitpunkt</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">Benutzer</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">Aktion</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">Entität</th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-slate-900 dark:text-white">IP-Adresse</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((item) => (
              <tr key={item.log.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-3 px-4 text-sm text-slate-500">
                  {formatDate(item.log.createdAt)}
                </td>
                <td className="py-3 px-4 text-sm text-slate-900 dark:text-white">
                  {item.user?.name || item.user?.email || "System"}
                </td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                    {item.log.action}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm text-slate-900 dark:text-white">
                  {item.log.entity}
                </td>
                <td className="py-3 px-4 text-sm text-slate-500">
                  {item.log.ipAddress || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            Keine Audit-Logs vorhanden
          </div>
        )}
      </div>
    </section>
  );
}

