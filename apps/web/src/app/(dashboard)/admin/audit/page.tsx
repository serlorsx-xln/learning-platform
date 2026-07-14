"use client";

import { useEffect, useMemo, useState } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Skeleton } from "@/components/ui/skeleton";
import { AUDIT_ACTION_LABELS, type AuditAction } from "@/lib/audit/types";
import { formatDate } from "@/lib/utils";

interface AuditRow {
  id: string;
  actorName: string;
  actorEmail: string;
  action: AuditAction;
  resource: string;
  resourceId: string | null;
  detailsJson: string | null;
  ipAddress: string | null;
  createdAt: string;
}

function AuditTableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/audit")
      .then((r) => r.json())
      .then((data) => setLogs(data.logs ?? []))
      .finally(() => setLoading(false));
  }, []);

  const columns = useMemo<ColumnDef<AuditRow>[]>(
    () => [
      {
        accessorKey: "createdAt",
        header: "When",
        enableSorting: true,
        sortingFn: (a, b) =>
          new Date(a.original.createdAt).getTime() - new Date(b.original.createdAt).getTime(),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>
        ),
      },
      {
        id: "actor",
        header: "Actor",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.actorName}</p>
            <p className="text-caption text-muted-foreground">{row.original.actorEmail}</p>
          </div>
        ),
      },
      {
        accessorKey: "action",
        header: "Action",
        cell: ({ row }) => (
          <Badge variant="muted">
            {AUDIT_ACTION_LABELS[row.original.action] ?? row.original.action}
          </Badge>
        ),
      },
      {
        id: "resource",
        header: "Resource",
        meta: { className: "hidden md:table-cell" },
        cell: ({ row }) => (
          <div className="text-muted-foreground">
            {row.original.resource}
            {row.original.resourceId ? (
              <span className="block text-caption">{row.original.resourceId}</span>
            ) : null}
          </div>
        ),
      },
      {
        id: "details",
        header: "Details",
        meta: { className: "hidden max-w-xs lg:table-cell" },
        cell: ({ row }) => {
          const details = row.original.detailsJson ? JSON.parse(row.original.detailsJson) : null;
          return details ? (
            <pre className="whitespace-pre-wrap break-all text-caption text-muted-foreground">
              {JSON.stringify(details, null, 0)}
            </pre>
          ) : (
            <span className="text-muted-foreground">-</span>
          );
        },
      },
    ],
    []
  );

  return (
    <div className="space-y-6">
      <PageHeader description="Complete history of admin and operator actions - who did what and when." />

      <Card>
        <CardHeader>
          <CardTitle>{loading ? "Events" : `${logs.length} events`}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <AuditTableSkeleton />
          ) : (
            <DataTable
              columns={columns}
              data={logs}
              enableSorting
              emptyMessage="No audit events recorded yet."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
