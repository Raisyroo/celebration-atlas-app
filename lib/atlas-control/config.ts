export type AtlasConfigStatus = {
  hasUrl: boolean;
  hasAnonKey: boolean;
  hasServiceRoleKey: boolean;
  hasAdminAllowlist: boolean;
  isComplete: boolean;
};

export function getAtlasConfigStatus(): AtlasConfigStatus {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasAdminAllowlist = getAdminEmails().length > 0;
  return { hasUrl, hasAnonKey, hasServiceRoleKey, hasAdminAllowlist, isComplete: hasUrl && hasAnonKey && hasServiceRoleKey && hasAdminAllowlist };
}

export function getAdminEmails(): string[] {
  return (process.env.ATLAS_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
