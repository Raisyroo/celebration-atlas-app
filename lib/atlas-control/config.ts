export type AtlasConfigStatus = {
  hasUrl: boolean;
  hasPublicUrl: boolean;
  hasAnonKey: boolean;
  hasServiceRoleKey: boolean;
  hasAdminAllowlist: boolean;
  hasAccessToken: boolean;
  isComplete: boolean;
};

export function getAtlasSupabaseUrl(): string | undefined {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
}

export function getAtlasConfigStatus(): AtlasConfigStatus {
  const hasPublicUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasUrl = Boolean(getAtlasSupabaseUrl());
  const hasAnonKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasAdminAllowlist = getAdminEmails().length > 0;
  const hasAccessToken = Boolean(process.env.ATLAS_CONTROL_ACCESS_TOKEN?.trim());
  return { hasUrl, hasPublicUrl, hasAnonKey, hasServiceRoleKey, hasAdminAllowlist, hasAccessToken, isComplete: hasUrl && hasAnonKey && hasServiceRoleKey && (hasAdminAllowlist || hasAccessToken) };
}

export function getAdminEmails(): string[] {
  return (process.env.ATLAS_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
