"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { useUIStore } from "@/hooks/use-ui-store"

export function DashboardHeader() {
    const { toggleSidebar } = useUIStore()

    return (
        <header className="h-16 border-b bg-card flex items-center px-4 justify-between md:justify-end">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={toggleSidebar}>
                <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
                <ModeToggle />
                {/* User dropdown can go here */}
            </div>
        </header>
    )
}
