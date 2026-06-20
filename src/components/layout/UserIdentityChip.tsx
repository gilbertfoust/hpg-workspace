import { Link } from "react-router-dom";
import { UserAvatar, getUserDisplayName } from "@/components/common/UserAvatar";
import { getRoleLabel } from "@/lib/accessControl";
import { cn } from "@/lib/utils";

interface UserIdentityChipProps {
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
  showRole?: boolean;
  className?: string;
  settingsHref?: string;
}

export function UserIdentityChip({
  fullName,
  email,
  avatarUrl,
  role,
  showRole = false,
  className,
  settingsHref = "/admin",
}: UserIdentityChipProps) {
  const displayName = getUserDisplayName(fullName, email);

  return (
    <Link
      to={settingsHref}
      className={cn(
        "hidden sm:flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent transition-colors max-w-[220px]",
        className
      )}
      title={displayName}
    >
      <UserAvatar name={fullName} email={email} avatarUrl={avatarUrl} />
      <div className="min-w-0 text-left">
        <p className="text-sm font-medium truncate">{displayName}</p>
        {showRole && (
          <p className="text-xs text-muted-foreground truncate">{getRoleLabel(role)}</p>
        )}
      </div>
    </Link>
  );
}
