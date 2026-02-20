import NamerGame from '@/Games/NamerGame';
import { BackButton } from '@/components/ui/back-button';

export default function NamerPage() {
  return (
    <div className="relative min-h-screen bg-[#0a0a0a]">
      <BackButton />
      <NamerGame />
    </div>
  );
}
