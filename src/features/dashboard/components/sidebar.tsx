"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Users, Trophy, MessageSquare, Settings, LogOut } from "lucide-react"
import { useUIStore } from "@/hooks/use-ui-store"

const sidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: Trophy, label: "Arena", href: "/dashboard/arena" },
    { icon: Users, label: "Leaderboard", href: "/dashboard/leaderboard" },
    { icon: MessageSquare, label: "Messaging", href: "/dashboard/messaging" },
    { icon: Settings, label: "Settings", href: "/dashboard/settings" },
]

export function Sidebar() {
    const pathname = usePathname()
    const { sidebarOpen, closeSidebar } = useUIStore()

    return (
        <div className={cn("fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
            <div className="h-full flex flex-col">
                <div className="h-16 flex items-center px-6 border-b">
                    <span className="text-xl font-bold">Neet App</span>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {sidebarItems.map((item) => (
                        <Link key={item.href} href={item.href} onClick={closeSidebar}>
                            <Button
                                variant={pathname === item.href ? "secondary" : "ghost"}
                                className="w-full justify-start gap-2"
                            >
                                <item.icon className="h-4 w-4" />
                                {item.label}
                            </Button>
                        </Link>
                    ))}
                </nav>
                <div className="p-4 border-t">
                    <form action="/auth/signout" method="post">
                        <Button variant="ghost" className="w-full justify-start gap-2 text-red-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950">
                            <LogOut className="h-4 w-4" />
                            Sign Out
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    )
}
