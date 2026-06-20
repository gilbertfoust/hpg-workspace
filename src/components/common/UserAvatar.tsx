import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface UserAvatarProps {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export function getUserDisplayName(
  fullName?: string | null,
  email?: string | null
): string {
  if (fullName?.trim()) return fullName.trim();
  if (email?.trim()) return email.trim();
  return "User";
}

export function getUserInitials(
  fullName?: string | null,
  email?: string | null
): string {
  if (fullName?.trim()) {
    return fullName
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  if (email?.trim()) return email.slice(0, 2).toUpperCase();
  return "U";
}

export function UserAvatar({
  name,
  email,
  avatarUrl,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const initials = getUserInitials(name, email);

  return (
    <Avatar className={cn("h-8 w-8", className)}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={getUserDisplayName(name, email)} /> : null}
      <AvatarFallback className={cn("text-xs font-medium", fallbackClassName)}>{initials}</AvatarFallback>
    </Avatar>
  );
}
