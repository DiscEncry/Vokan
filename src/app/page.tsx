"use client"; // Top-level page with client components needs this

import AppHeader from '@/components/lexify/AppHeader';
import LibraryTabContent from '@/components/lexify/library/LibraryTabContent';
import GamesTabContent from '@/components/lexify/games/GamesTabContent';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Library, Swords } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-grow">
        <Tabs defaultValue="library" className="w-full">
          <div className="border-b sticky top-0 bg-background z-10 shadow-sm">
            <TabsList className="grid w-full grid-cols-2 md:w-auto md:mx-auto h-14 rounded-none md:rounded-md md:my-2">
              <TabsTrigger value="library" className="py-3 text-base md:px-8">
                <Library className="mr-2 h-5 w-5" />
                Library
              </TabsTrigger>
              <TabsTrigger value="games" className="py-3 text-base md:px-8">
                <Swords className="mr-2 h-5 w-5" />
                Games
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="library" className="mt-0">
            <div className="max-w-5xl mx-auto">
              <LibraryTabContent />
            </div>
          </TabsContent>
          <TabsContent value="games" className="mt-0">
            <div className="max-w-3xl mx-auto">
             <GamesTabContent />
            </div>
          </TabsContent>
        </Tabs>
      </main>
      <footer className="py-4 text-center text-sm text-muted-foreground border-t">
        © {new Date().getFullYear()} Lexify. All rights reserved.
      </footer>
    </div>
  );
}
