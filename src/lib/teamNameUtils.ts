// Utility to clean/normalize team names for match_id generation
export function cleanTeamNameForMatchId(name: string): string {
  if (!name) return '';
  // Convert to lowercase
  let cleaned = name.toLowerCase();
  // Replace spaces, dots, apostrophes with hyphens
  cleaned = cleaned.replace(/[\s\.']+/g, "-");
  // Remove any non-alphanumeric characters except hyphens
  cleaned = cleaned.replace(/[^a-z0-9-]/g, "");
  // Remove multiple consecutive hyphens
  cleaned = cleaned.replace(/-+/g, "-");
  // Trim hyphens from start and end
  cleaned = cleaned.replace(/^-|-$/g, "");
  return cleaned;
}
