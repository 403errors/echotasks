"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { commandExamples } from "@/app/page";

type InfoDialogProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
};

const techInfo = [
    {
        name: "Deepgram",
        reason: "For blazingly fast and accurate speech-to-text transcription. It turns your voice commands into text that the AI can understand in real-time."
    },
    {
        name: "GPT-4o-mini",
        reason: "As the AI brain of the application. It analyzes the transcribed text to understand your intent (e.g., add, delete, update) and extracts key details like task names."
    },
    {
        name: "Client-Side Heuristics",
        reason: "Fast, local models run in your browser to instantly detect priority (e.g., 'urgent') and locations from your command without a slow network request."
    },
    {
        name: "Date & Time Detection",
        reason: "Uses the 'chrono-node' library to understand natural language dates like 'tomorrow', 'next Friday', or 'in 2 weeks' and correctly sets due dates for your tasks."
    },
    {
        name: "Weather API (wttr.in)",
        reason: "To provide current weather conditions, adding a bit of useful, real-world context to your daily planning."
    },
];

export function InfoDialog({ isOpen, onOpenChange }: InfoDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>About EchoTasks</DialogTitle>
          <DialogDescription>
            This application is a demonstration of how voice and AI can create a fluid and intuitive user experience.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
            <div>
                <h3 className="font-semibold mb-2">Core Technologies</h3>
                <ul className="space-y-3 text-sm text-muted-foreground">
                    {techInfo.map((tech) => (
                        <li key={tech.name}>
                            <strong className="text-foreground">{tech.name}:</strong> {tech.reason}
                        </li>
                    ))}
                </ul>
            </div>
            <div>
                <h3 className="font-semibold mb-2">Example Commands</h3>
                <ScrollArea className="h-48 w-full rounded-md border p-4">
                    <ul className="space-y-2 text-sm">
                        {commandExamples.map((cmd, index) => (
                            <li key={index}>- "{cmd}"</li>
                        ))}
                    </ul>
                </ScrollArea>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
