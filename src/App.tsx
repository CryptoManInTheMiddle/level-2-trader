import { useEffect, useState } from 'react';
import { BottomNav, type TabId } from './components/BottomNav';
import { DisclaimerBar } from './components/DisclaimerBar';
import { BookTab } from './tabs/BookTab';
import { LearnTab } from './tabs/LearnTab';
import { DrillsTab } from './tabs/DrillsTab';
import { PracticeTab } from './tabs/PracticeTab';
import { ProgressTab } from './tabs/ProgressTab';
import { useProgressStore } from './store/progressStore';

export default function App() {
  const [tab, setTab] = useState<TabId>('book');
  const touchStreak = useProgressStore((s) => s.touchStreak);

  useEffect(() => {
    touchStreak();
  }, [touchStreak]);

  return (
    <div className="flex h-full flex-col bg-base text-ink">
      <DisclaimerBar />
      <main className="relative flex-1 overflow-hidden">
        {tab === 'learn' && <LearnTab onJumpToBook={() => setTab('book')} />}
        {tab === 'book' && <BookTab />}
        {tab === 'drills' && <DrillsTab />}
        {tab === 'practice' && <PracticeTab />}
        {tab === 'progress' && <ProgressTab />}
      </main>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  );
}
