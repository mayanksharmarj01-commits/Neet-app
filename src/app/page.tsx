import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart2, GraduationCap, LayoutDashboard, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">

      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/80">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">NeetApp</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
            <Link href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Features</Link>
            <Link href="#pricing" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Pricing</Link>
            <Link href="#testimonials" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Stories</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/auth/login" className="hidden sm:block text-sm font-medium text-slate-600 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors">
              Log in
            </Link>
            <Link href="/auth/signup">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 sm:py-32 bg-white dark:bg-slate-950">
          <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
            <div className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
          </div>

          <div className="container px-4 md:px-6 mx-auto text-center space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300 backdrop-blur-sm">
              <span className="flex h-2 w-2 rounded-full bg-indigo-600 mr-2 animate-pulse"></span>
              New: AI-Powered Performance Analysis
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-indigo-800 to-slate-900 dark:from-white dark:via-indigo-200 dark:to-white pb-2 relative z-10">
              Master Physics, Chemistry <br className="hidden sm:block" />
              & Biology for NEET
            </h1>

            <p className="mx-auto max-w-[700px] text-lg text-slate-600 dark:text-slate-400 md:text-xl leading-relaxed relative z-10">
              Experience the most realistic mock tests designed by experts. Get instant feedback, detailed solutions, and track your progress with advanced analytics.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 relative z-10">
              <Link href="/auth/signup">
                <Button size="lg" className="h-12 px-8 text-base bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-xl shadow-indigo-500/25 transition-all hover:scale-105">
                  Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" size="lg" className="h-12 px-8 text-base border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 transition-all">
                  View Features
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="pt-12 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto border-t border-slate-200 dark:border-slate-800 mt-12 relative z-10">
              {[
                { label: "Active Students", value: "10k+" },
                { label: "Questions Solved", value: "2M+" },
                { label: "Success Rate", value: "94%" },
                { label: "Expert Faculty", value: "50+" },
              ].map((stat, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-3xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-20 bg-slate-50 dark:bg-slate-900/50">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="text-center mb-16 space-y-4">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-slate-900 dark:text-white">Everything you need to succeed</h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Our platform replicates the exact NTA exam environment so you're always prepared for the big day.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: LayoutDashboard,
                  title: "Realistic Mock Tests",
                  desc: "Practice with the exact same interface as the real NEET exam to build confidence and speed.",
                  color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30"
                },
                {
                  icon: BarChart2,
                  title: "Smart Analytics",
                  desc: "Get deep insights into your weak areas, time management, and accuracy with AI-driven reports.",
                  color: "text-purple-500 bg-purple-50 dark:bg-purple-950/30"
                },
                {
                  icon: Zap,
                  title: "Instant Doubts Solving",
                  desc: "Stuck on a question? Get detailed step-by-step solutions instantly after every test.",
                  color: "text-yellow-500 bg-yellow-50 dark:bg-yellow-950/30"
                }
              ].map((feature, i) => (
                <div key={i} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-8 hover:shadow-2xl transition-all hover:-translate-y-1 dark:border-slate-800 dark:bg-slate-950 cursor-pointer">
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl mb-6 ${feature.color}`}>
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{feature.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {feature.desc}
                  </p>
                  <div className="absolute bottom-0 left-0 h-1 w-0 bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 group-hover:w-full"></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 bg-slate-900 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />
          <div className="container px-4 md:px-6 mx-auto relative z-10 text-center space-y-8">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">Ready to start your journey?</h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Join thousands of successful students today. It takes less than a minute to get started.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link href="/auth/signup">
                <Button size="lg" className="h-14 px-8 text-lg bg-white text-slate-900 hover:bg-slate-100 hover:scale-105 transition-all shadow-xl font-bold">
                  Create Free Account
                </Button>
              </Link>
            </div>
            <p className="text-sm text-slate-400 mt-4">No credit card required • 14-day free trial</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-12 dark:border-slate-800 dark:bg-slate-950">
        <div className="container px-4 md:px-6 mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold text-slate-900 dark:text-white">NeetApp</span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} NeetApp Inc. All rights reserved.
          </p>
          <div className="flex gap-6">
            <Link href="#" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Privacy</Link>
            <Link href="#" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Terms</Link>
            <Link href="#" className="text-sm text-slate-500 hover:text-indigo-600 transition-colors">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
