import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24 text-center space-y-8">
      <h1 className="text-6xl font-bold tracking-tighter">
        Neet App
      </h1>
      <p className="text-xl text-muted-foreground max-w-[600px]">
        The ultimate platform for ... something amazing.
        Start your journey today.
      </p>
      <div className="flex gap-4">
        <Link href="/auth/login">
          <Button size="lg">Login</Button>
        </Link>
        <Link href="/auth/signup">
          <Button variant="outline" size="lg">Sign Up</Button>
        </Link>
      </div>
    </div>
  );
}
