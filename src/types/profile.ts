export type Locale = "en" | "es";
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
