import { LoginForm } from "@/features/auth/components/login-form"
import Link from "next/link"

export default function LoginPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4">
            <div className="flex flex-col items-center gap-4">
                <LoginForm />
                <p className="text-sm text-white/90">
                    Don&apos;t have an account?{" "}
                    <Link href="/auth/signup" className="font-semibold hover:underline">
                        Sign up
                    </Link>
                </p>
            </div>
        </div>
    )
}
