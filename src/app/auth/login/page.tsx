import { LoginForm } from "@/features/auth/components/login-form";
import Link from "next/link";
import { Suspense } from "react";
import { Users, Trophy, Target, BookOpen } from "lucide-react";

export default function LoginPage() {
    return (
        <div className="min-h-screen w-full flex bg-background">
            {/* Left Side - Visuals & Context (Hidden on mobile) */}
            <div className="hidden lg:flex w-1/2 bg-slate-900 relative overflow-hidden flex-col justify-between p-12 text-white">
                <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10" />
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-purple-600/20 to-pink-600/20" />

                {/* Floating Elements Animation */}
                <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse delay-1000" />

                <div className="relative z-10">
                    <div className="flex items-center gap-2 text-2xl font-bold mb-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                            <Target className="w-5 h-5 text-white" />
                        </div>
                        NeetApp
                    </div>
                    <p className="text-slate-400">Master Your Preparation</p>
                </div>

                <div className="relative z-10 space-y-8">
                    <div className="space-y-4">
                        <h1 className="text-4xl font-bold leading-tight">
                            Evaluate performance with <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Real-time Analytics</span>
                        </h1>
                        <p className="text-lg text-slate-300 max-w-md">
                            Join thousands of students achieving their dream medical college with our AI-powered testing platform.
                        </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                            <Users className="w-6 h-6 text-indigo-400 mb-2" />
                            <div className="text-2xl font-bold">10k+</div>
                            <div className="text-sm text-slate-400">Active Students</div>
                        </div>
                        <div className="bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                            <Trophy className="w-6 h-6 text-yellow-400 mb-2" />
                            <div className="text-2xl font-bold">500+</div>
                            <div className="text-sm text-slate-400">Mock Tests</div>
                        </div>
                        <div className="bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                            <Target className="w-6 h-6 text-green-400 mb-2" />
                            <div className="text-2xl font-bold">95%</div>
                            <div className="text-sm text-slate-400">Success Rate</div>
                        </div>
                        <div className="bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                            <BookOpen className="w-6 h-6 text-pink-400 mb-2" />
                            <div className="text-2xl font-bold">24/7</div>
                            <div className="text-sm text-slate-400">AI Support</div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 text-sm text-slate-500">
                    © 2026 NeetApp Inc. • Privacy • Terms
                </div>
            </div>

            {/* Right Side - Login Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-slate-950">
                <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center lg:text-left">
                        <div className="lg:hidden flex justify-center mb-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                                <Target className="w-7 h-7 text-white" />
                            </div>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Welcome back</h2>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Enter your credentials to access your personalized dashboard.
                        </p>
                    </div>

                    <Suspense fallback={
                        <div className="space-y-4 animate-pulse">
                            <div className="h-10 bg-slate-200 rounded w-full"></div>
                            <div className="h-10 bg-slate-200 rounded w-full"></div>
                            <div className="h-10 bg-indigo-200 rounded w-full"></div>
                        </div>
                    }>
                        <LoginForm />
                    </Suspense>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-white dark:bg-slate-950 px-2 text-slate-500">
                                New to platform?
                            </span>
                        </div>
                    </div>

                    <div className="text-center">
                        <Link
                            href="/auth/signup"
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-8 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900 transition-all hover:scale-105"
                        >
                            Create an account
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
