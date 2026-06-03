import { ComingSoon } from '../components/ComingSoon';

export function LearnTab({ onJumpToBook: _onJumpToBook }: { onJumpToBook: () => void }) {
  return (
    <ComingSoon
      title="Learn"
      blurb="A swipeable skill tree of bite-sized lessons — concept, plain-English explanation, then 'see it live' on the Book. Modules 1–6 from foundations to mastery drills."
    />
  );
}
