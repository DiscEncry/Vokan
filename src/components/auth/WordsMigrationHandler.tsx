"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { firestore } from "@/lib/firebase/firebaseConfig";
import { collection, getDocs, setDoc, doc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast"; // Corrected import path
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

const STORAGE_KEY = 'lexify-vocabulary';

export function WordsMigrationHandler() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [isLoadingLocalWords, setIsLoadingLocalWords] = useState(false);
  const [localWords, setLocalWords] = useState<any[]>([]);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  
  // Check if this is the first login with local words
  useEffect(() => {
    if (user) {
      const checkLocalWords = async () => {
        setIsLoadingLocalWords(true);
        
        try {
          // Try to load local words from localStorage
          const storedData = localStorage.getItem(STORAGE_KEY);
          if (!storedData) {
            setIsLoadingLocalWords(false);
            return;
          }
          
          const localWords = JSON.parse(storedData);
          
          if (Array.isArray(localWords) && localWords.length > 0) {
            // Check if we've already migrated for this user
            const migratedKey = `${STORAGE_KEY}-migrated-${user.uid}`;
            const alreadyMigrated = localStorage.getItem(migratedKey) === 'true';
            
            if (!alreadyMigrated) {
              // Check if the user already has words in Firestore
              const wordsCollection = collection(firestore, `users/${user.uid}/words`);
              const snapshot = await getDocs(wordsCollection);
              
              if (snapshot.empty) {
                // User has local words but no cloud words
                setLocalWords(localWords);
                setIsFirstLogin(true);
                setShowDialog(true);
              }
            }
          }
        } catch (error) {
          console.error("Error checking local words:", error);
        }
        
        setIsLoadingLocalWords(false);
      };
      
      checkLocalWords();
    }
  }, [user]);
  
  // Function to migrate local words to Firestore
  const migrateWords = async () => {
    if (!user || !localWords.length) return;
    
    setIsMigrating(true);
    
    try {
      // Use a batch of promises to efficiently upload all words
      const promises = localWords.map(word => {
        const wordDoc = doc(firestore, `users/${user.uid}/words/${word.id}`);
        return setDoc(wordDoc, word);
      });
      
      await Promise.all(promises);
      
      // Mark as migrated for this user
      localStorage.setItem(`${STORAGE_KEY}-migrated-${user.uid}`, 'true');
      
      toast({
        title: "Words migrated successfully",
        description: `${localWords.length} words were migrated to the cloud.`,
      });
    } catch (error) {
      console.error("Error migrating words:", error);
      toast({
        title: "Migration failed",
        description: "There was an error migrating your words. Your local words are still safe.",
        variant: "destructive",
      });
    }
    
    setIsMigrating(false);
    setShowDialog(false);
  };
  
  const skipMigration = () => {
    // Mark as migrated even if the user chooses to skip
    if (user) {
      localStorage.setItem(`${STORAGE_KEY}-migrated-${user.uid}`, 'true');
    }
    setShowDialog(false);
  };
  
  // Only render the dialog if needed
  if (!showDialog) return null;
  
  return (
    <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Migrate your words to the cloud?</AlertDialogTitle>
          <AlertDialogDescription>
            We found {localWords.length} words stored on this device. Would you like to migrate them to your account? This will make them available on all your devices.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={skipMigration} disabled={isMigrating}>Skip for now</AlertDialogCancel>
          <AlertDialogAction onClick={migrateWords} disabled={isMigrating}>
            {isMigrating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Migrating...
              </>
            ) : (
              "Migrate Words"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
