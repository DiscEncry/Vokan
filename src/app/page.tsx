
"use client"; // Top-level page with client components needs this

import AppHeader from '@/components/lexify/AppHeader';
import LibraryTabContent from '@/components/lexify/library/LibraryTabContent';
import GamesTabContent from '@/components/lexify/games/GamesTabContent';
import InsightsTabContent from '@/components/lexify/insights/InsightsTabContent'; // New Import
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Library, Swords, BarChart3 } from 'lucide-react'; // Added BarChart3

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <main className="flex-grow">
        <Tabs defaultValue="library" className="w-full">
          <div className="border-b sticky top-0 bg-background z-10 shadow-sm">
            <TabsList className="grid w-full grid-cols-3 md:w-auto md:mx-auto h-14 rounded-none md:rounded-md md:my-2"> {/* Updated grid-cols-2 to grid-cols-3 */}
              <TabsTrigger value="library" className="py-3 text-base md:px-8">
                <Library className="mr-2 h-5 w-5" />
                Library
              </TabsTrigger>
              <TabsTrigger value="games" className="py-3 text-base md:px-8">
                <Swords className="mr-2 h-5 w-5" />
                Games
              </TabsTrigger>
              <TabsTrigger value="insights" className="py-3 text-base md:px-8"> {/* New Trigger */}
                <BarChart3 className="mr-2 h-5 w-5" />
                Insights
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
          <TabsContent value="insights" className="mt-0"> {/* New Content */}
            <div className="max-w-5xl mx-auto">
              <InsightsTabContent />
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
