import { useState } from 'react';
import { ProfileConfig, ProfileData } from '@/components/ProfileConfig';
import { useAuth } from '@/contexts/AuthContext';

interface PwaOnboardingProps {
  onComplete: () => void;
}

export function PwaOnboarding({ onComplete }: PwaOnboardingProps) {
  const { profile, createProfile, updateProfile } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleProfileComplete = async (data: ProfileData) => {
    setError(null);
    setIsLoading(true);

    try {
      const profileData: Record<string, any> = {
        personality: data.personality,
        experience_level: data.experience_level,
        notification_frequency: data.notification_frequency === 'none' ? 'off' : data.notification_frequency,
      };
      if (data.location) profileData.location = data.location;
      if (data.display_name) profileData.display_name = data.display_name;
      if (data.primary_concerns?.length) profileData.primary_concerns = data.primary_concerns;
      if (data.pets?.length) profileData.pets = data.pets;

      let result;
      if (profile) {
        result = await updateProfile(profileData);
      } else {
        result = await createProfile(profileData);
      }

      if (result.error) throw result.error;

      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    // In PWA onboarding, back doesn't make sense — they must complete it
    // But ProfileConfig requires it, so we'll make it a no-op
  };

  return (
    <ProfileConfig
      onComplete={handleProfileComplete}
      onBack={handleBack}
      isLoading={isLoading}
      error={error}
    />
  );
}
