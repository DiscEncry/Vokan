"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen } from "lucide-react";

const guideText = `
Lexify uses a Spaced Repetition System (SRS) called FSRS to help you remember vocabulary efficiently.

- **What is Spaced Repetition?**
  Spaced repetition is a learning technique that schedules reviews of words at increasing intervals. Words you know well appear less often, while difficult words are shown more frequently until you master them.

- **How does Lexify decide when to show a word?**
  Each word has a "due" date. If a word is due (or overdue), it will appear in your next review session. The system adapts based on your answers: correct answers push the next review further out, while mistakes bring the word back sooner.

- **Game Modes:**
  - *Text Input:* Harder, rewards more progress for correct answers.
  - *Multiple Choice:* Easier, but may not increase intervals as quickly.

- **Tips:**
  - Review words when they are due for best results.
  - You can see which words are due by using the "Due for review" filter in your library.
  - The system supports fast-paced learning and will sometimes re-show words within the same day if needed.

- **Want to learn more?**
  See the full guide in the app's /guide/FSRSv5 Implementation Guide.txt file for advanced details.
`;

export const GuideDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" className="flex items-center gap-2" onClick={() => setOpen(true)} aria-label="Open Guide">
        <BookOpen className="h-4 w-4" /> Guide
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>How Spaced Repetition Works in Lexify</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-2 pt-2">
            <section className="mb-4">
              <h2 className="font-semibold text-base mb-1">What is Spaced Repetition?</h2>
              <p className="mb-2 text-sm text-muted-foreground">Spaced repetition is a learning technique that schedules reviews of words at increasing intervals. Words you know well appear less often, while difficult words are shown more frequently until you master them.</p>
            </section>
            <section className="mb-4">
              <h2 className="font-semibold text-base mb-1">How does Lexify decide when to show a word?</h2>
              <ul className="list-disc pl-5 text-sm text-muted-foreground mb-2">
                <li>Each word has a <span className="font-semibold text-primary">due date</span>. If a word is due (or overdue), it will appear in your next review session.</li>
                <li>The system adapts based on your answers: <span className="font-semibold text-green-700 dark:text-green-400">correct answers</span> push the next review further out, while <span className="font-semibold text-red-700 dark:text-red-400">mistakes</span> bring the word back sooner.</li>
              </ul>
            </section>
            <section className="mb-4">
              <h2 className="font-semibold text-base mb-1">Game Modes</h2>
              <ul className="list-disc pl-5 text-sm text-muted-foreground mb-2">
                <li><span className="font-semibold text-primary">Text Input:</span> Harder, rewards more progress for correct answers.</li>
                <li><span className="font-semibold text-primary">Multiple Choice:</span> Easier, but may not increase intervals as quickly.</li>
              </ul>
            </section>
            <section className="mb-4">
              <h2 className="font-semibold text-base mb-1">Tips</h2>
              <ul className="list-disc pl-5 text-sm text-muted-foreground mb-2">
                <li>Review words when they are <span className="font-semibold text-primary">due</span> for best results.</li>
                <li>You can see which words are due by using the <span className="font-semibold text-primary">"Due for review"</span> filter in your library.</li>
                <li>The system supports fast-paced learning and will sometimes re-show words within the same day if needed.</li>
              </ul>
            </section>
            <section className="mb-2">
              <h2 className="font-semibold text-base mb-1">Want to learn more?</h2>
              <p className="text-sm text-muted-foreground">See the full guide in <span className="font-mono">/guide/FSRSv5 Implementation Guide.txt</span> for advanced details.</p>
            </section>
          </div>
          <DialogFooter className="px-6 pb-4 pt-2">
            <Button onClick={() => setOpen(false)} autoFocus>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GuideDialog;
