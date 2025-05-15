import type { FC } from 'react';
import { BookMarked } from 'lucide-react';

const AppHeader: FC = () => {
  return (
    <header className="py-6 px-4 sm:px-6 lg:px-8 border-b">
      <div className="max-w-5xl mx-auto flex items-center space-x-3">
        <BookMarked className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold text-foreground">Lexify</h1>
      </div>
    </header>
  );
};

export default AppHeader;
