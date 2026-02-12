import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function MessagingView() {
    return (
        <div className="flex h-[calc(100vh-10rem)] flex-col gap-4">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Messaging</h1>
            </div>
            <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="border-b">
                    <CardTitle>Chat Room: General</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-auto p-4 space-y-4">
                    <div className="flex gap-2">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">A</div>
                        <div className="bg-muted p-2 rounded-lg text-sm max-w-[80%]">
                            <p className="font-semibold text-xs mb-1">Alice</p>
                            Hey everyone! Ready for the arena battle?
                        </div>
                    </div>
                    <div className="flex gap-2 flex-row-reverse">
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground">You</div>
                        <div className="bg-primary text-primary-foreground p-2 rounded-lg text-sm max-w-[80%]">
                            Can&apos;t wait!
                        </div>
                    </div>
                </CardContent>
                <div className="p-4 border-t flex gap-2">
                    <Input placeholder="Type a message..." />
                    <Button>Send</Button>
                </div>
            </Card>
        </div>
    )
}
