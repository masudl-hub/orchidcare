import PvpGame from '@/Games/PvpGame';
import { BackButton } from '@/components/ui/back-button';

export default function PvpPage() {
  return (
    <div className="relative min-h-screen bg-[#0a0a0a]">
      <BackButton />
      <PvpGame />
    </div>
  );
}
