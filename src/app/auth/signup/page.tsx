import { SignupForm } from "@/features/auth/components/signup-form"
import Link from "next/link"
import { Suspense } from "react"

export default function SignupPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
            <div className="flex flex-col items-center gap-4">
                <Suspense fallback={<div className="text-white">Loading...</div>}>
                    <SignupForm />
                </Suspense>
                <p className="text-sm text-white/90">
                    Already have an account?{" "}
                    <Link href="/auth/login" className="font-semibold hover:underline">
                        Login
                    </Link>
                </p>
            </div>
        </div>
    )
}
