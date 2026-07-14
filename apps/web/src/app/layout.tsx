import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "ELearning",
  description: "Internal automation control dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider delayDuration={0}>
            {children}
          </TooltipProvider>
          <Toaster
            richColors={false}
            theme="system"
            position="top-right"
            toastOptions={{
              classNames: {
                toast:
                  "group toast border border-border bg-card text-foreground shadow-none",
                title: "text-small font-medium",
                description: "text-small text-muted-foreground",
                success: "border-primary",
                error: "border-destructive",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
