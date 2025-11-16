
"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/lib/hooks/use-settings";

export function SettingsSheet() {
  const { settings, setSetting } = useSettings();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
          <span className="sr-only">Settings</span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
          <SheetDescription>
            Customize your EchoTasks experience.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 py-6">
          <div className="grid gap-3">
            <Label>Temperature Unit</Label>
            <Tabs
              value={settings.temperatureUnit}
              onValueChange={(value) => setSetting("temperatureUnit", value as "celsius" | "fahrenheit")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="celsius">Celsius (°C)</TabsTrigger>
                <TabsTrigger value="fahrenheit">Fahrenheit (°F)</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label>Move Completed to Bottom</Label>
            </div>
            <Switch
              checked={settings.moveCompletedToBottom}
              onCheckedChange={(checked) => setSetting("moveCompletedToBottom", checked)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 shadow-sm">
            <div className="space-y-0.5">
              <Label>Hold Spacebar to Talk</Label>
            </div>
            <Switch
              checked={settings.spacebarToTalk}
              onCheckedChange={(checked) => setSetting("spacebarToTalk", checked)}
            />
          </div>

          <div className="grid gap-3">
            <Label>Microphone Button Mode</Label>
            <Select
              value={settings.micMode}
              onValueChange={(value) => setSetting("micMode", value as "tap" | "hold")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select mic mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tap">Tap to Start/Stop</SelectItem>
                <SelectItem value="hold">Hold to Record</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {settings.micMode === 'tap' && (
            <div className="grid gap-3">
                <Label>Intelligent Stop</Label>
                <Tabs
                    value={String(settings.intelligentStopDuration)}
                    onValueChange={(value) => setSetting("intelligentStopDuration", Number(value))}
                    className="w-full"
                >
                    <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="0">Off</TabsTrigger>
                        <TabsTrigger value="2">2s</TabsTrigger>
                        <TabsTrigger value="3">3s</TabsTrigger>
                        <TabsTrigger value="5">5s</TabsTrigger>
                    </TabsList>
                </Tabs>
                <p className="text-xs text-muted-foreground px-1">
                    Automatically stop recording after a period of silence.
                </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
