/** Map Supabase/Postgres posting errors to user-facing messages. */
export function mapPostingError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: unknown }).message)
        : "Posting failed. Please try again.";

  const lower = message.toLowerCase();

  if (lower.includes("out of balance") || lower.includes("debits=")) {
    return "This entry is out of balance. Total debits must equal total credits.";
  }
  if (lower.includes("locked") || lower.includes("no open fiscal period")) {
    return "This fiscal period is locked or missing. Choose an open period or date.";
  }
  if (lower.includes("inactive") && lower.includes("account")) {
    return "One or more accounts are inactive. Select active accounts only.";
  }
  if (lower.includes("not valid for this ngo") || lower.includes("account") && lower.includes("not found")) {
    return "One or more accounts are invalid for this NGO.";
  }
  if (lower.includes("ngo not found")) {
    return "The selected NGO could not be found.";
  }
  if (lower.includes("description is required")) {
    return "A description is required before saving.";
  }
  if (lower.includes("at least two lines")) {
    return "Add at least two journal lines with debits and credits.";
  }
  if (lower.includes("only draft")) {
    return "Only draft entries can be edited or deleted.";
  }
  if (lower.includes("not authorized") || lower.includes("finance manager access required")) {
    return "You do not have permission to perform this action.";
  }
  if (lower.includes("only posted")) {
    return message;
  }

  return message;
}
