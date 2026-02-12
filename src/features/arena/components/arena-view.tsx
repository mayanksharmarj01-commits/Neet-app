import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

// Mock Data for Arena
const battles = [
    { id: 1, title: "Algorithm Challenge #1", difficulty: "Hard", participants: 120, status: "Active" },
    { id: 2, title: "Speed Coding Round", difficulty: "Medium", participants: 45, status: "Starting Soon" },
    { id: 3, title: "UI Design Sprint", difficulty: "Easy", participants: 200, status: "Active" },
]

export function ArenaView() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Arena</h1>
                <Button>Create Battle</Button>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {battles.map((battle) => (
                    <Card key={battle.id}>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                {battle.title}
                                <span className="text-xs px-2 py-1 bg-primary/10 rounded-full text-primary">{battle.status}</span>
                            </CardTitle>
                            <CardDescription>Difficulty: {battle.difficulty}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{battle.participants} Participants battling right now.</p>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full">Join Battle</Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    )
}
