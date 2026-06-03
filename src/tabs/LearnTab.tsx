import { SkillTree } from '../components/learn/SkillTree';
import { LessonPlayer } from '../components/learn/LessonPlayer';
import { useUiStore } from '../store/uiStore';

export function LearnTab({ onJumpToBook }: { onJumpToBook: () => void }) {
  const activeLessonId = useUiStore((s) => s.activeLessonId);

  return activeLessonId ? (
    <LessonPlayer onJumpToBook={onJumpToBook} />
  ) : (
    <SkillTree />
  );
}
