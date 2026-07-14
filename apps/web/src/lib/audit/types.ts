export type AuditAction =
  | "auth.login"
  | "auth.logout"
  | "user.create"
  | "user.role_change"
  | "user.ban"
  | "user.unban"
  | "job.create";

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "auth.login": "Signed in",
  "auth.logout": "Signed out",
  "user.create": "Created user",
  "user.role_change": "Changed role",
  "user.ban": "Disabled user",
  "user.unban": "Enabled user",
  "job.create": "Started job",
};
