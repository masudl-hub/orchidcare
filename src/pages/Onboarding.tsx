import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LinkPhone } from '@/components/LinkPhone';
import { ProfileConfig, ProfileData } from '@/components/ProfileConfig';
import { useAuth } from '@/contexts/AuthContext';

type OnboardingStep = 'linkPhone' | 'profileConfig' | 'complete';

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, createProfile, updateProfile } = useAuth();

  // Skip phone linking — Telegram is the primary messaging channel now
  const [step, setStep] = useState<OnboardingStep>('profileConfig');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if not authenticated
  if (!user) {
    navigate('/login', { replace: true });
    return null;
  }

  const handlePhoneLinked = () => {
    // TODO: Wire to backend phone verification (new flow - iMessage based)
    console.log('Phone linked - wire to new SMS/iMessage verification');
    setStep('profileConfig');
  };

  const handleProfileComplete = async (data: ProfileData) => {
    setError(null);
    setIsLoading(true);

    try {
      // Build the full profile data from all collected fields
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
        // Existing profile — update it
        result = await updateProfile(profileData);
      } else {
        // New web signup — create profile without phone_number
        result = await createProfile(profileData);
      }

      if (result.error) {
        throw result.error;
      }

      setStep('complete');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOnboardingComplete = () => {
    navigate('/login', { replace: true });
  };

  const handleBack = () => {
    if (step === 'profileConfig') {
      // If we were at linkPhone, we'd go back there, but it's currently skipped
      // For now, go back to landing
      navigate('/');
    } else if (step === 'linkPhone') {
      navigate('/');
    }
  };

  switch (step) {
    case 'linkPhone':
      return <LinkPhone onComplete={handlePhoneLinked} onBack={handleBack} />;
    case 'profileConfig':
      return (
        <ProfileConfig 
          onComplete={handleProfileComplete}
          onBack={handleBack}
          isLoading={isLoading}
          error={error}
        />
      );
    case 'complete':
      return null;
    default:
      return <LinkPhone onComplete={handlePhoneLinked} onBack={handleBack} />;
  }
}
