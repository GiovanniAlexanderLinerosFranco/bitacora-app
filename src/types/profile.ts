export const LOCALES = ["en", "es", "pt", "fr", "de", "it", "ru", "zh", "ja", "ko", "hi", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const RTL_LOCALES: readonly Locale[] = ["ar"];
export const LOCALE_COOKIE = "bitacora_locale";
export type UserRole = "student" | "professional";

export interface UserProfile {
  id: string;
  displayName: string | null;
  role: UserRole;
  academicLevel: string | null;
  careerOrField: string | null;
  preferredLanguage: Locale | (string & {});
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export type UpdateProfileInput = Partial<
  Pick<UserProfile, "displayName" | "role" | "academicLevel" | "careerOrField" | "preferredLanguage" | "timezone">
>;
