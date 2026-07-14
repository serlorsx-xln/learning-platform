"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { PLATFORM_LABELS, STATUS_LABELS, STATUS_BADGE_VARIANTS, type JobStatus } from "@/lib/jobs/types";
import { formatDate } from "@/lib/utils";

export interface RecentJobRow {
  id: string;
  platform: keyof typeof PLATFORM_LABELS;
  status: JobStatus;
  accountLabel: string;
  createdAt: Date | string;
}

const columns: ColumnDef<RecentJobRow>[] = [
  {
    accessorKey: "platform",
    header: "Platform",
    cell: ({ row }) => (
      <span className="font-medium">{PLATFORM_LABELS[row.original.platform]}</span>
    ),
  },
  {
    accessorKey: "accountLabel",
    header: "Account",
    cell: ({ row }) => <span className="text-muted-foreground">{row.original.accountLabel}</span>,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={STATUS_BADGE_VARIANTS[row.original.status]}>{STATUS_LABELS[row.original.status]}</Badge>
    ),
  },
  {
    accessorKey: "createdAt",
    header: "Created",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>
    ),
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <Button variant="link" size="sm" className="h-auto p-0" asChild>
        <Link href={`/jobs/${row.original.id}`}>View</Link>
      </Button>
    ),
  },
];

export function RecentJobsTable({ jobs }: { jobs: RecentJobRow[] }) {
  return (
    <DataTable columns={columns} data={jobs} emptyMessage="No jobs yet. Start from Run." />
  );
}
