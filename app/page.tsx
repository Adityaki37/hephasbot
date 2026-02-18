"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Globe, Zap, Cpu, Gamepad } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { RobotControlPanel } from "@/components/robot-control-panel";
import { cn } from "@/lib/utils";
import { useUser } from "@/components/user-session";

export default function Home() {
  const { user } = useUser();
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/30">

      {/* Background Elements */}
      <div className="fixed inset-0 z-0 pointer-events-none hidden md:block">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] hidden md:block" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] hidden md:block" />
        <div className="absolute top-[20%] left-[50%] -translate-x-1/2 w-[30%] h-[30%] bg-primary/5 rounded-full blur-[100px] hidden md:block" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8">
            <Image src="/logo.svg" alt="Hephas Logo" fill className="object-contain" />
          </div>
          <span className="text-xl font-bold tracking-tight">
            Hephasbot
          </span>
        </div>
        <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-8 text-sm font-medium text-muted-foreground">
          <Link
            href="#features"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="hover:text-foreground transition-colors"
          >
            Features
          </Link>
          <Link
            href="#control"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("control")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="hover:text-foreground transition-colors"
          >
            Start Control
          </Link>
          {/* <Link href="https://github.com" className="hover:text-foreground transition-colors">GitHub</Link> */}
        </div>
        <div className="flex items-center gap-4">
          {/* <Button variant="outline" className="hidden sm:flex">
            Docs
          </Button> */}
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">
                Hello, {user.firstName || user.name || "User"}
              </span>
              <Link
                href="/auth/logout"
                className={cn(buttonVariants({ variant: "outline" }), "text-zinc-500 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/20")}
              >
                Log Out
              </Link>
            </div>
          ) : (
            <Link
              href="/auth/login"
              className={cn(buttonVariants({ variant: "default" }), "bg-primary text-primary-foreground hover:bg-primary/90")}
            >
              Log In
            </Link>
          )}
        </div>
      </nav>

      <main className="relative z-10 flex flex-col items-center">

        {/* Hero Section */}
        <section className="pt-24 pb-12 md:pt-32 md:pb-20 px-6 max-w-5xl mx-auto text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted border border-border mb-8 backdrop-blur-md animate-fade-in-up">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs font-medium text-muted-foreground">System Online v1.0</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 animate-fade-in-up delay-100">
            Robotics for <br className="hidden md:block" />
            <span className="text-primary">Everyone.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in-up delay-200">
            Control advanced manipulators directly from your browser. <br />
            No drivers. No terminal. Just plug and play.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
            {/* Fixed: Use Link directly with buttonVariants to avoid asChild error */}
            <Link
              href="#control"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("control")?.scrollIntoView({ behavior: "smooth" });
              }}
              className={cn(buttonVariants({ size: "lg" }), "h-12 px-8 text-base shadow-lg shadow-primary/20")}
            >
              Start Controlling Now <ArrowRight className="ml-2 w-4 h-4" />
            </Link>

            {/* <Button size="lg" variant="outline" className="h-12 px-8 text-base border-border bg-background/50 backdrop-blur-sm hover:bg-accent hover:text-accent-foreground">
              View Documentation
            </Button> */}
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 px-6 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-8 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors group">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6 text-primary group-hover:scale-110 transition-transform">
              <Globe className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">Browser Native</h3>
            <p className="text-muted-foreground leading-relaxed">
              Zero install. Access your robot from any device with a modern web browser. WebRTC low-latency streaming built-in.
            </p>
          </div>
          <div className="p-8 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors group">
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-6 text-blue-500 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">Instant Connect</h3>
            <p className="text-muted-foreground leading-relaxed">
              Automatic device discovery for SO-100 and SO-101. Built on LeRobot for seamless integration.
            </p>
          </div>
          <div className="p-8 rounded-xl border border-border bg-card hover:bg-accent/50 transition-colors group">
            <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-6 text-green-500 group-hover:scale-110 transition-transform">
              <Gamepad className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">Teleoperation Types</h3>
            <p className="text-muted-foreground leading-relaxed">
              Multiple control modes available: Leader-Follower, Gamepad, Keyboard, and direct Joint Control.
            </p>
          </div>
        </section>

        {/* Robot Control Section (Command Center) */}
        <section id="control" className="w-full py-20 px-4 border-t border-border bg-card/30 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4 tracking-tight">Command Center</h2>
              <p className="text-muted-foreground">
                Direct interface to your local robot hardware <br className="hidden sm:block" />
                Login to save your robot calibrations
              </p>
            </div>

            <RobotControlPanel />
          </div>
        </section>

      </main>
    </div>
  );
}
