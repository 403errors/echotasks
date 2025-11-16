
"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Settings } from "lucide-react";

type ProTipDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

export function ProTipDialog({ isOpen, onOpenChange }: ProTipDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>🚀 Pro Tip!</AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 pt-2">
            <p>
              You can press and hold the{' '}
              <kbd className="px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">Space</kbd>{' '}
              key to talk.
            </p>
            <p>
              The default microphone mode is "Tap to Record." If you prefer holding, you can change this in the settings menu.
            </p>
            <div className="flex items-center gap-2 text-sm">
                <Settings className="h-4 w-4" />
                <span>Settings > Microphone Button Mode > Hold to Record</span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction>Got it!</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
