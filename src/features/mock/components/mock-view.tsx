import { Button } from "@/components/ui/button";

export function MockView() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-24 text-center space-y-4">
            <h1 className="text-4xl font-bold">Mock Environment</h1>
            <p className="text-xl text-muted-foreground">
                Simulate data and test components here.
            </p>
            <Button variant="outline">Generate Mock Data</Button>
        </div>
    );
}
