import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Terminal } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-6">
      <div className="text-center space-y-6 max-w-md w-full border border-border bg-card/50 p-8 rounded-lg backdrop-blur-sm">
        <div className="p-3 bg-primary/10 rounded-full w-fit mx-auto border border-primary/20">
          <Terminal className="w-10 h-10 text-primary opacity-90" />
        </div>
        <h1 className="text-5xl font-mono font-bold tracking-tight text-foreground">404</h1>
        <div className="h-px w-full bg-border" />
        <p className="text-muted-foreground font-mono text-sm leading-relaxed">
          System error: The requested route could not be resolved in the current environment.
        </p>
        <Link href="/">
          <Button className="font-mono uppercase tracking-wider font-bold w-full mt-4 h-12">
            Return to Generator
          </Button>
        </Link>
      </div>
    </div>
  );
}