"use client";

import { Sliders, Camera, Power, RefreshCw, Cpu, Activity, Video } from "lucide-react";
import { RobotBridge } from "@/components/robot-bridge";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export default function RobotsPage() {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [videoFrame, setVideoFrame] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [jointVals, setJointVals] = useState<number[]>([0, 0, 0, 0, 0, 0]);

    useEffect(() => {
        const s = io('http://localhost:8000', { transports: ['websocket'] });

        s.on('connect', () => addLog('Connected to Bridge'));
        s.on('video_frame', (data) => setVideoFrame(`data:image/jpeg;base64,${data}`));
        s.on('log', (data) => addLog(data.msg));
        s.on('joint_update', (data) => {
            setJointVals(prev => {
                const n = [...prev];
                n[data.joint] = data.value;
                return n;
            });
        });

        setSocket(s);

        return () => { s.disconnect(); };
    }, []);

    const addLog = (msg: string) => setLogs(p => [msg, ...p].slice(0, 10));

    const handleCalibrate = () => {
        socket?.emit('calibrate');
    };

    const handleJointChange = (jointIdx: number, val: number) => {
        // Send command
        socket?.emit('teleop_joint', { joint: jointIdx, value: val });
        // Optimistic update
        setJointVals(prev => {
            const n = [...prev];
            n[jointIdx] = val;
            return n;
        });
    };

    // Use ref to avoid re-binding listener constantly
    const jointValsRef = useRef(jointVals);
    useEffect(() => { jointValsRef.current = jointVals; }, [jointVals]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!socket) return;
            const step = 5;
            let jIdx = -1;
            let dir = 0;

            switch (e.key.toLowerCase()) {
                case 'a': jIdx = 0; dir = -1; break;
                case 'd': jIdx = 0; dir = 1; break;
                case 'w': jIdx = 1; dir = 1; break;
                case 's': jIdx = 1; dir = -1; break;
                case 'ArrowUp': jIdx = 2; dir = 1; break;
                case 'ArrowDown': jIdx = 2; dir = -1; break;
                case 'q': jIdx = 3; dir = -1; break; // Wrist Pitch
                case 'e': jIdx = 3; dir = 1; break;
                case 'z': jIdx = 4; dir = -1; break; // Wrist Roll
                case 'c': jIdx = 4; dir = 1; break;
                case ' ': jIdx = 5; dir = 1; break; // Gripper
                case 'shift': jIdx = 5; dir = -1; break;
            }

            if (jIdx !== -1) {
                const current = jointValsRef.current[jIdx];
                const next = Math.min(Math.max(current + (step * dir), -100), 100);
                // We manually call the emitter logic here to avoid stale closures
                socket.emit('teleop_joint', { joint: jIdx, value: next });

                setJointVals(prev => {
                    const n = [...prev];
                    n[jIdx] = next;
                    return n;
                });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [socket]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2">My Robots</h1>
                    <p className="text-muted-foreground">Manage and teleoperate your robots.</p>
                </div>
                <div className="flex gap-3 items-center">
                    <RobotBridge />
                    <Button onClick={() => socket?.emit('connect_robot', { type: 'so_100' })}>
                        <Power className="mr-2 h-4 w-4" />
                        Connect Hardware
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Active Robot Card */}
                <div className="col-span-1 lg:col-span-2 rounded-xl border border-primary/20 bg-card/50 backdrop-blur-sm overflow-hidden shadow-xl shadow-black/20">
                    <div className="h-10 bg-gradient-to-r from-primary/10 to-blue-500/10 border-b border-border flex items-center px-4 justify-between">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-green-500 animate-pulse" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">so-100-arm-01</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 h-[500px]">
                        {/* Video Feed */}
                        <div className="md:col-span-2 bg-black relative border-r border-border group overflow-hidden">
                            {videoFrame ? (
                                <img src={videoFrame} className="w-full h-full object-cover" alt="Robot Feed" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-white/20 font-mono">
                                    <Camera className="w-12 h-12 mb-4 opacity-50" />
                                    <span className="block">WAITING FOR VIDEO...</span>
                                </div>
                            )}
                        </div>

                        {/* Control Panel */}
                        <div className="p-6 bg-card/30 flex flex-col gap-6 overflow-y-auto">
                            <div>
                                <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
                                    <Sliders className="w-4 h-4" /> Joint Control (Teleop)
                                </h4>
                                <div className="space-y-6">
                                    {[0, 1, 2, 3, 4, 5].map((joint) => (
                                        <div key={joint} className="space-y-2">
                                            <div className="flex justify-between text-xs text-muted-foreground">
                                                <span>Joint {joint + 1}</span>
                                                <span>{jointVals[joint].toFixed(2)}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="-100" max="100"
                                                value={jointVals[joint]}
                                                onChange={(e) => handleJointChange(joint, Number(e.target.value))}
                                                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-auto pt-4 border-t border-border space-y-4">
                                <Button variant="outline" className="w-full justify-start" onClick={handleCalibrate}>
                                    <RefreshCw className="mr-2 h-4 w-4" /> Run Calibration
                                </Button>
                                <div className="p-2 bg-black/40 rounded text-[10px] font-mono text-green-400 h-24 overflow-y-auto">
                                    {logs.map((l, i) => <div key={i}>&gt; {l}</div>)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
