"use client";

import { ArrowRight, Bot, Keyboard, Server, Ear } from 'lucide-react';

const FlowStep = ({ icon: Icon, title, description }: { icon: React.ElementType, title: string, description: string }) => (
    <div className="flex flex-col items-center text-center">
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="h-6 w-6" />
        </div>
        <h4 className="font-semibold">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
    </div>
);

const FlowArrow = () => (
    <div className="flex items-center text-muted-foreground/50">
        <ArrowRight className="h-5 w-5" />
    </div>
);

export function Flowchart() {
    return (
        <div className="p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-start">
                <FlowStep
                    icon={Ear}
                    title="1. Voice Capture"
                    description="User speaks. Audio is captured in the browser."
                />
                <FlowArrow />
                <FlowStep
                    icon={Server}
                    title="2. Server-Side AI Chain"
                    description="Audio is sent to a Next.js Server Action. It calls Deepgram for transcription, then immediately sends the text to Groq for analysis."
                />
                <FlowArrow />
                <FlowStep
                    icon={Bot}
                    title="3. Client Processing"
                    description="The client receives both the transcript and the AI's intent. It runs local heuristics for priority/dates and updates the UI."
                />
            </div>
             <div className="mt-4 text-center text-xs text-muted-foreground">
                This optimized server-side flow eliminates extra network trips, significantly reducing latency.
            </div>
        </div>
    );
}
