import DogerGame from '@/Games/DogerGame';
import { BackButton } from '@/components/ui/back-button';

export default function DogerPage() {
  return (
    <div className="relative">
      <BackButton />
      <DogerGame />
    </div>
  );
}
