interface SupabaseNotConfiguredNoticeProps {
  message?: string;
}

const DEFAULT_MESSAGE =
  "This module is unavailable because Supabase is not configured in this environment.";

export const SupabaseNotConfiguredNotice = ({
  message = DEFAULT_MESSAGE,
}: SupabaseNotConfiguredNoticeProps) => (
  <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
    {message}
  </div>
);
