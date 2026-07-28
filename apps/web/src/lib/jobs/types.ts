export type Platform = "andrewbiggs" | "edlearning" | "speexx";

export type JobStatus =
  | "queued"
  | "running"
  | "success"
  | "partial"
  | "failed"
  | "cancelled";

export type EventLevel = "info" | "warn" | "error";

export interface JobCredentials {
  username?: string;
  email?: string;
  password?: string;
  cookies?: Record<string, string>;
  school?: string;
  educationId?: string;
}

export interface AndrewBiggsConfig {
  courses: string[];
  delay: number;
}

export interface EdLearningConfig {
  school: string;
  educationId: string;
  moduleIds: number[];
  minutesToAdd?: number;
  mode?: "full" | "time_only";
}

export interface SpeexxConfig {
  authMode: "password" | "cookie";
  doActivity: boolean;
  test: boolean;
  targetPercent: number;
  delayPerFolder: number;
}

export type JobConfig = AndrewBiggsConfig | EdLearningConfig | SpeexxConfig;

export interface WorkerRunPayload {
  jobId: string;
  credentials: JobCredentials;
  config: JobConfig;
  callbackUrl: string;
  callbackKey: string;
}

export interface WorkerEventPayload {
  level?: EventLevel;
  message: string;
  payload?: unknown;
  status?: JobStatus;
  summary?: Record<string, unknown>;
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  andrewbiggs: "Andrew Biggs",
  edlearning: "EdLearning",
  speexx: "Speexx",
};

export const STATUS_LABELS: Record<JobStatus, string> = {
  queued: "Queued",
  running: "Running",
  success: "Success",
  partial: "Partial",
  failed: "Failed",
  cancelled: "Cancelled",
};

export type StatusBadgeVariant = "success" | "warning" | "destructive" | "muted";

export const STATUS_BADGE_VARIANTS: Record<JobStatus, StatusBadgeVariant> = {
  queued: "muted",
  running: "warning",
  success: "success",
  partial: "warning",
  failed: "destructive",
  cancelled: "muted",
};
