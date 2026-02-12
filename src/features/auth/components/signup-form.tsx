'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, AlertCircle, User, Mail, Lock, CheckCircle2 } from 'lucide-react';

export function SignupForm() {
    const router = useRouter();

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [ageConfirmation, setAgeConfirmation] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMessage('');
        setSuccessMessage('');

        // Basic Validations
        if (formData.password !== formData.confirmPassword) {
            setErrorMessage('Passwords do not match');
            setLoading(false);
            return;
        }

        if (formData.password.length < 8) {
            setErrorMessage('Password must be at least 8 characters');
            setLoading(false);
            return;
        }

        if (!acceptTerms || !ageConfirmation) {
            setErrorMessage('Please accept the terms and age confirmation');
            setLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password,
                    fullName: formData.fullName,
                    acceptTerms,
                    ageConfirmation,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                let msg = data.error || 'Signup failed';
                if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('limit reached')) {
                    msg = 'Too many signup attempts. Please wait a moment before trying again.';
                }
                setErrorMessage(msg);
                return;
            }

            setSuccessMessage('Account created successfully! Redirecting...');
            router.push('/dashboard');
            router.refresh();
        } catch (error) {
            console.error('Signup error:', error);
            setErrorMessage('An unexpected error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && (
                <div className="flex items-center gap-2 p-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/30 dark:text-red-200 dark:border-red-800 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <p>{errorMessage}</p>
                </div>
            )}

            {successMessage && (
                <div className="flex items-center gap-2 p-3 text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/30 dark:text-green-200 dark:border-green-800 animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <p>{successMessage}</p>
                </div>
            )}

            <div className="space-y-4">
                {/* Full Name */}
                <div className="space-y-2">
                    <label htmlFor="fullName" className="text-sm font-medium leading-none text-slate-700 dark:text-slate-200">
                        Full Name
                    </label>
                    <div className="relative">
                        <User className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                        <input
                            id="fullName"
                            type="text"
                            value={formData.fullName}
                            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                            required
                            className="flex h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:text-slate-50 transition-all font-medium"
                            placeholder="John Doe"
                        />
                    </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-medium leading-none text-slate-700 dark:text-slate-200">
                        Email Address
                    </label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                        <input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                            className="flex h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:text-slate-50 transition-all font-medium"
                            placeholder="you@example.com"
                        />
                    </div>
                </div>

                {/* Password */}
                <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium leading-none text-slate-700 dark:text-slate-200">
                        Password
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                        <input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                            className="flex h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:text-slate-50 transition-all font-medium"
                            placeholder="••••••••"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="text-sm font-medium leading-none text-slate-700 dark:text-slate-200">
                        Confirm Password
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                        <input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            required
                            className="flex h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400 dark:text-slate-50 transition-all font-medium"
                            placeholder="••••••••"
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                        >
                            {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Checkboxes */}
            <div className="space-y-3 pt-2">
                <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={ageConfirmation}
                        onChange={(e) => setAgeConfirmation(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                        required
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400 leading-tight">
                        I confirm that I am <span className="font-semibold text-slate-900 dark:text-slate-200">18 years or older</span>
                    </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                    <input
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-950"
                        required
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400 leading-tight">
                        I agree to the{' '}
                        <Link href="/terms" className="text-indigo-600 hover:underline dark:text-indigo-400 font-medium">Terms</Link>
                        {' '}and{' '}
                        <Link href="/privacy" className="text-indigo-600 hover:underline dark:text-indigo-400 font-medium">Privacy Policy</Link>
                    </span>
                </label>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center w-full h-11 rounded-lg bg-indigo-600 px-8 text-sm font-medium text-white transition-all hover:bg-indigo-700 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/25 mt-6"
            >
                {loading ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                    </>
                ) : (
                    'Create Account'
                )}
            </button>
        </form>
    );
}
