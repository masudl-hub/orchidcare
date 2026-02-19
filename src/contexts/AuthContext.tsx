import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  user_id: string | null;
  phone_number: string | null;
  whatsapp_number: string | null;
  telegram_chat_id: number | null;
  telegram_username: string | null;
  location: string | null;
  timezone: string;
  notification_frequency: "off" | "daily" | "weekly" | "realtime";
  personality: "warm" | "expert" | "philosophical" | "playful";
  display_name: string | null;
  experience_level: "beginner" | "intermediate" | "expert" | null;
  primary_concerns: string[] | null;
  pets: string[] | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  linkPhone: (phoneNumber: string) => Promise<{ error: Error | null }>;
  createProfile: (data: Partial<Omit<Profile, 'id' | 'user_id'>>) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<Omit<Profile, 'id' | 'user_id' | 'phone_number'>>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }
    
    if (!data) return null;
    
    // Map database response to Profile type with proper defaults
    return {
      id: data.id,
      user_id: data.user_id,
      phone_number: data.phone_number,
      whatsapp_number: data.whatsapp_number,
      telegram_chat_id: data.telegram_chat_id || null,
      telegram_username: data.telegram_username || null,
      location: data.location,
      timezone: data.timezone || 'America/New_York',
      notification_frequency: (data.notification_frequency as Profile['notification_frequency']) || 'daily',
      personality: data.personality || 'warm',
      display_name: data.display_name,
      experience_level: (data.experience_level as Profile['experience_level']) || null,
      primary_concerns: data.primary_concerns,
      pets: data.pets || [],
    };
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer profile fetch with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id).then(setProfile);
          }, 0);
        } else {
          setProfile(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id).then((profileData) => {
          setProfile(profileData);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const linkPhone = async (phoneNumber: string) => {
    if (!user) {
      return { error: new Error("No user logged in") };
    }

    // Check if profile with this phone exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("*")
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    if (fetchError) {
      return { error: fetchError as Error };
    }

    if (existingProfile) {
      // Link existing profile to this user
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ user_id: user.id })
        .eq("id", existingProfile.id);

      if (updateError) {
        return { error: updateError as Error };
      }

      // Map to Profile type with proper defaults
      setProfile({
        id: existingProfile.id,
        user_id: user.id,
        phone_number: existingProfile.phone_number,
        whatsapp_number: existingProfile.whatsapp_number,
        telegram_chat_id: existingProfile.telegram_chat_id || null,
        telegram_username: existingProfile.telegram_username || null,
        location: existingProfile.location,
        timezone: existingProfile.timezone || 'America/New_York',
        notification_frequency: (existingProfile.notification_frequency as Profile['notification_frequency']) || 'daily',
        personality: existingProfile.personality || 'warm',
        display_name: existingProfile.display_name,
        experience_level: (existingProfile.experience_level as Profile['experience_level']) || null,
        primary_concerns: existingProfile.primary_concerns,
        pets: existingProfile.pets || [],
      });
    } else {
      // Create new profile for this user
      const { data: newProfile, error: insertError } = await supabase
        .from("profiles")
        .insert({
          phone_number: phoneNumber,
          user_id: user.id,
        })
        .select()
        .single();

      if (insertError) {
        return { error: insertError as Error };
      }

      // Map to Profile type with proper defaults
      setProfile({
        id: newProfile.id,
        user_id: newProfile.user_id,
        phone_number: newProfile.phone_number,
        whatsapp_number: newProfile.whatsapp_number,
        telegram_chat_id: newProfile.telegram_chat_id || null,
        telegram_username: newProfile.telegram_username || null,
        location: newProfile.location,
        timezone: newProfile.timezone || 'America/New_York',
        notification_frequency: (newProfile.notification_frequency as Profile['notification_frequency']) || 'daily',
        personality: newProfile.personality || 'warm',
        display_name: newProfile.display_name,
        experience_level: (newProfile.experience_level as Profile['experience_level']) || null,
        primary_concerns: newProfile.primary_concerns,
        pets: newProfile.pets || [],
      });
    }

    return { error: null };
  };

  const createProfile = async (data: Partial<Omit<Profile, 'id' | 'user_id'>>) => {
    if (!user) {
      return { error: new Error("No user logged in") };
    }

    const { data: newProfile, error } = await supabase
      .from("profiles")
      .insert({ user_id: user.id, ...data })
      .select()
      .single();

    if (error) {
      return { error: error as Error };
    }

    setProfile({
      id: newProfile.id,
      user_id: newProfile.user_id,
      phone_number: newProfile.phone_number,
      whatsapp_number: newProfile.whatsapp_number,
      telegram_chat_id: newProfile.telegram_chat_id || null,
      telegram_username: newProfile.telegram_username || null,
      location: newProfile.location,
      timezone: newProfile.timezone || 'America/New_York',
      notification_frequency: (newProfile.notification_frequency as Profile['notification_frequency']) || 'daily',
      personality: newProfile.personality || 'warm',
      display_name: newProfile.display_name,
      experience_level: (newProfile.experience_level as Profile['experience_level']) || null,
      primary_concerns: newProfile.primary_concerns,
      pets: newProfile.pets || [],
    });

    return { error: null };
  };

  const updateProfile = async (updates: Partial<Omit<Profile, 'id' | 'user_id' | 'phone_number'>>) => {
    if (!profile) {
      return { error: new Error("No profile to update") };
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profile.id)
      .select()
      .single();

    if (error) {
      return { error: error as Error };
    }

    // Map to Profile type with proper defaults
    setProfile({
      id: data.id,
      user_id: data.user_id,
      phone_number: data.phone_number,
      whatsapp_number: data.whatsapp_number,
      telegram_chat_id: data.telegram_chat_id || null,
      telegram_username: data.telegram_username || null,
      location: data.location,
      timezone: data.timezone || 'America/New_York',
      notification_frequency: (data.notification_frequency as Profile['notification_frequency']) || 'daily',
      personality: data.personality || 'warm',
      display_name: data.display_name,
      experience_level: (data.experience_level as Profile['experience_level']) || null,
      primary_concerns: data.primary_concerns,
      pets: data.pets || [],
    });
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        linkPhone,
        createProfile,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
