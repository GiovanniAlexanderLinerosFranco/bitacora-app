"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { createClient } from "../lib/supabase/client";
import type { UpdateProfileInput, UserProfile } from "../types";

type ProfileRow = {
  id: string;
  display_name: string | null;
  role: UserProfile["role"];
  academic_level: string | null;
  career_or_field: string | null;
  preferred_language: string;
  timezone: string;
  onboarding_completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

const toProfile = (r: ProfileRow): UserProfile => ({
  id: r.id,
  displayName: r.display_name,
  role: r.role,
  academicLevel: r.academic_level,
  careerOrField: r.career_or_field,
  preferredLanguage: r.preferred_language,
  timezone: r.timezone,
  onboardingCompletedAt: r.onboarding_completed_at ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshProfile: () => Promise<void>;
  updateProfile: (input: UpdateProfileInput) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  const loadProfile = useCallback(
    async (userId: string | null) => {
      if (!userId) return setProfile(null);
      const { data } = await supabase.from("bitacora_profiles").select("*").eq("id", userId).maybeSingle();
      // Ignore stale responses if the user changed while fetching.
      if (userIdRef.current === userId) setProfile(data ? toProfile(data as ProfileRow) : null);
    },
    [supabase],
  );

  useEffect(() => {
    // Async work is deferred out of the callback to avoid Supabase auth-lock deadlocks.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      userIdRef.current = next?.user.id ?? null;
      setTimeout(() => {
        void loadProfile(userIdRef.current).finally(() => setIsLoading(false));
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [supabase, loadProfile]);

  const refreshProfile = useCallback(() => loadProfile(userIdRef.current), [loadProfile]);

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      const userId = userIdRef.current;
      if (!userId) return { error: "Not authenticated" };
      const { data, error } = await supabase
        .from("bitacora_profiles")
        .update({
          ...(input.displayName !== undefined && { display_name: input.displayName }),
          ...(input.role !== undefined && { role: input.role }),
          ...(input.academicLevel !== undefined && { academic_level: input.academicLevel }),
          ...(input.careerOrField !== undefined && { career_or_field: input.careerOrField }),
          ...(input.preferredLanguage !== undefined && { preferred_language: input.preferredLanguage }),
          ...(input.timezone !== undefined && { timezone: input.timezone }),
        })
        .eq("id", userId)
        .select("*")
        .single();
      if (error) return { error: error.message };
      setProfile(toProfile(data as ProfileRow));
      return { error: null };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isLoading,
      isAuthenticated: !!session,
      refreshProfile,
      updateProfile,
      signOut,
    }),
    [session, profile, isLoading, refreshProfile, updateProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
