import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

const leaderboardData = [
    { rank: 1, user: "Alice", score: 2500, winRate: "92%" },
    { rank: 2, user: "Bob", score: 2350, winRate: "88%" },
    { rank: 3, user: "Charlie", score: 2200, winRate: "85%" },
    { rank: 4, user: "Diana", score: 2100, winRate: "82%" },
    { rank: 5, user: "Evan", score: 2050, winRate: "80%" },
]

export function LeaderboardView() {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Top Players</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Rank</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Score</TableHead>
                                <TableHead className="text-right">Win Rate</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {leaderboardData.map((player) => (
                                <TableRow key={player.rank}>
                                    <TableCell className="font-medium">{player.rank}</TableCell>
                                    <TableCell>{player.user}</TableCell>
                                    <TableCell>{player.score}</TableCell>
                                    <TableCell className="text-right">{player.winRate}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
