"use client";

import { useRobot } from '@/components/robot-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Power, Radio, RefreshCw } from 'lucide-react';

export function RobotBridge() {
    const { connected, connect, disconnect } = useRobot();

    const toggleConnection = () => {
        if (connected) {
            disconnect();
        } else {
            connect();
        }
    };

    return (
        <div className="flex items-center gap-4 bg-card border border-border p-2 rounded-lg shadow-sm">
            <div className="flex items-center gap-2">
                <Radio className={`w-4 h-4 ${connected ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">Bridge:</span>
                <Badge variant={connected ? "default" : "secondary"} className={connected ? "bg-green-600 hover:bg-green-600" : ""}>
                    {connected ? "Online" : "Disconnected"}
                </Badge>
            </div>

            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleConnection}>
                {connected ? <Power className="w-4 h-4 text-red-500" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
        </div>
    );
}
