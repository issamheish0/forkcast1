// hooks/useReviewReports.ts — Mock stub
export type ReportReason =
  | "inappropriate_content" | "spam" | "fake_review" | "hate_speech"
  | "harassment" | "misinformation" | "privacy_violation"
  | "copyright_violation" | "off_topic" | "duplicate_review" | "other";

export const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  { value: "inappropriate_content", label: "Inappropriate Content", description: "Contains offensive material" },
  { value: "spam", label: "Spam", description: "Irrelevant content" },
  { value: "fake_review", label: "Fake Review", description: "Not a genuine experience" },
  { value: "harassment", label: "Harassment", description: "Threatening language" },
  { value: "other", label: "Other", description: "Other reason" },
];

export function useReviewReports() {
  return {
    isSubmitting: false,
    loading: false,
    reports: [] as any[],
    reportedReviews: new Set<string>(),
    submitReport: async (_reviewId: string, _reason: ReportReason, _details?: string) => {},
    checkIfReported: async (_reviewId: string) => false,
    getUserReports: async () => [],
    isAlreadyReported: (_reviewId: string) => false,
    checkMultipleReported: async (_reviewIds: string[]) => new Set<string>(),
    REPORT_REASONS,
  };
}