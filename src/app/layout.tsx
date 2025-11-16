
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { SettingsProvider } from '@/lib/hooks/use-settings';

export const metadata: Metadata = {
  title: 'EchoTasks',
  description: 'Create your to-do list by just speaking.',
  openGraph: {
    title: 'EchoTasks: The Intelligent Voice-Powered To-Do List',
    description: 'Manage your tasks entirely through voice commands. Fast, intuitive, and powered by AI.',
    images: [
      {
        url: 'https://studio--studio-6766374493-7e412.us-central1.hosted.app/echotasks_preview.png', // Use an absolute URL
        width: 1200,
        height: 630,
        alt: 'EchoTasks Application Preview',
      },
    ],
    locale: 'en_US',
    type: 'website',
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SettingsProvider>
      <html lang="en" className="dark">
        <head>
          <link rel="icon" href="/mic.svg" type="image/svg+xml" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap" rel="stylesheet" />
        </head>
        <body className="antialiased">
          {children}
          <Toaster />
        </body>
      </html>
    </SettingsProvider>
  );
}
