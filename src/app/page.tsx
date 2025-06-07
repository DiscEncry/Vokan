"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppHeader } from "@/components/lexify/AppHeader";
import LibraryTabContent from "@/components/lexify/library/LibraryTabContent"; // Changed to default import
import dynamic from "next/dynamic";

const GamesTabContent = dynamic(
  () => import("@/components/lexify/games/GamesTabContent"),
  { ssr: false }
);
const InsightsTabContent = dynamic(
  () => import("@/components/lexify/insights/InsightsTabContent"),
  { ssr: false }
);

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      <AppHeader />
      <main className="flex-1 p-4 container mx-auto max-w-5xl">
        <Tabs defaultValue="library" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8">
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="games">Games</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>
          <TabsContent value="library">
            <LibraryTabContent />
          </TabsContent>
          <TabsContent value="games">
            <GamesTabContent />
          </TabsContent>
          <TabsContent value="insights">
            <InsightsTabContent />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
