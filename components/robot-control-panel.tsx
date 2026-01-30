"use client";

import { Sliders, Camera, Power, RefreshCw, Cpu, Activity, Video, AlertTriangle, Check } from "lucide-react";
import { RobotBridge } from "@/components/robot-bridge";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { useRobot } from "@/components/robot-context";

export function RobotControlPanel() {
    const {
        connected,
        calibrationState,
        jointVals,
        logs,
        connect,
        startCalibration,
        finishCalibration,
        moveJoint,
        moveJointRel
    } = useRobot();

    const videoRef = useRef<HTMLVideoElement>(null);
    const [cameraActive, setCameraActive] = useState(false);

    const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

    // Attach stream when video element mounts
    useEffect(() => {
        if (activeStream && videoRef.current) {
            videoRef.current.srcObject = activeStream;
            videoRef.current.play().catch(console.error);
        }
    }, [activeStream, cameraActive]);

    const toggleCamera = async () => {
        if (cameraActive) {
            // Stop Camera
            if (activeStream) {
                activeStream.getTracks().forEach(t => t.stop());
            }
            setActiveStream(null);
            setCameraActive(false);
        } else {
            // Start Camera
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn("Media Devices API not available");
                return;
            }
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 640 }, height: { ideal: 480 } }
                });
                setActiveStream(stream);
                setCameraActive(true);
            } catch (e) {
                console.error("Camera access failed:", e);
                setCameraActive(false);
                setActiveStream(null);
            }
        }
    };

    const handleStartCalibration = () => {
        startCalibration();
    };

    const handleFinishCalibration = () => {
        finishCalibration();
    };

    const handleJointChange = (jointIdx: number, val: number) => {
        if (calibrationState !== 'rdy') return;
        moveJoint(jointIdx, val);
    };

    // Keyboard Control Logic
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!connected || calibrationState !== 'rdy') return;
            // Prevent scrolling for arrows/space
            if (["ArrowUp", "ArrowDown", " "].includes(e.key)) {
                e.preventDefault();
            }

            // Helper to move relative (5%)
            const moveRel = (idx: number, dir: number) => {
                moveJointRel(idx, 5 * dir);
            };

            switch (e.key.toLowerCase()) {
                case 'a': moveRel(0, -1); break;
                case 'd': moveRel(0, 1); break;
                case 'w': moveRel(1, 1); break;
                case 's': moveRel(1, -1); break;
                case 'arrowup': moveRel(2, 1); break;
                case 'arrowdown': moveRel(2, -1); break;
                case 'q': moveRel(3, -1); break;
                case 'e': moveRel(3, 1); break;
                case 'z': moveRel(4, -1); break;
                case 'c': moveRel(4, 1); break;
                case ' ': moveRel(5, 1); break;
                case 'shift': moveRel(5, -1); break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [connected, calibrationState, jointVals, moveJointRel]);

    const isControlsEnabled = connected && calibrationState === 'rdy';

    // Helper for buttons (5%)
    const manualMove = (idx: number, dir: number) => {
        moveJointRel(idx, 5 * dir);
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 bg-zinc-950/50 rounded-2xl border border-zinc-800 backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight mb-2 text-white">Live Control</h2>
                    <p className="text-zinc-400">Web Serial Robot Teleoperation</p>
                </div>
                <div className="flex gap-3 items-center">
                    <RobotBridge />

                    <Button
                        onClick={toggleCamera}
                        variant={cameraActive ? "outline" : "secondary"}
                        className={cameraActive ? "border-red-500/50 text-red-500 hover:bg-red-500/10" : "bg-zinc-800 hover:bg-zinc-700"}
                    >
                        <Camera className="mr-2 h-4 w-4" />
                        {cameraActive ? "Stop Camera" : "Connect Camera"}
                    </Button>

                    <Button
                        onClick={connect}
                        disabled={connected}
                        className={connected ? "bg-green-600 hover:bg-green-700 cursor-default" : "bg-primary hover:bg-primary/90"}
                    >
                        <Power className="mr-2 h-4 w-4" />
                        {connected ? "Robot Connected" : "Connect Robot"}
                    </Button>
                </div>
            </div>

            {/* Calibration Status Banner */}
            {connected && calibrationState === 'unc' && (
                <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-lg">
                            <AlertTriangle className="w-6 h-6 text-amber-500" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-amber-500">Calibration Required</h4>
                            <p className="text-xs text-amber-200/60">Controls are disabled until calibrated.</p>
                        </div>
                    </div>
                    <Button onClick={handleStartCalibration} variant="outline" className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10">
                        Begin Calibration
                    </Button>
                </div>
            )}

            {connected && calibrationState === 'cal' && (
                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                            <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                        </div>
                        <div>
                            <h4 className="font-semibold text-blue-500">Calibrating...</h4>
                            <p className="text-xs text-blue-200/60">Move all robot joints to their limits manually.</p>
                        </div>
                    </div>
                    <Button onClick={handleFinishCalibration} className="bg-blue-600 hover:bg-blue-700">
                        <Check className="mr-2 h-4 w-4" />
                        Finish Calibration
                    </Button>
                </div>
            )}

            <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 transition-all duration-500 ${!isControlsEnabled ? "opacity-80" : ""}`}>
                <div className="col-span-1 lg:col-span-2 rounded-xl border border-primary/20 bg-black/40 overflow-hidden shadow-2xl shadow-black/50 relative">

                    {/* Disabled Overlay */}
                    {!isControlsEnabled && connected && calibrationState !== 'cal' && (
                        <div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center backdrop-blur-[2px]">
                            <div className="flex flex-col items-center gap-3">
                                <AlertTriangle className="w-12 h-12 text-zinc-500" />
                                <span className="text-zinc-400 font-mono text-sm">CONTROLS LOCKED</span>
                            </div>
                        </div>
                    )}

                    <div className="h-12 bg-zinc-900/50 border-b border-zinc-800 flex items-center px-4 justify-between">
                        <div className="flex items-center gap-2">
                            <Activity className={`w-4 h-4 ${connected ? "text-green-500" : "text-zinc-600"} animate-pulse`} />
                            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">so-100-arm-01</span>
                        </div>
                        {calibrationState === 'rdy' && <span className="text-[10px] bg-green-500/20 text-green-500 px-2 py-0.5 rounded">READY</span>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 h-[600px]">
                        {/* Video Feed (Local Webcam) */}
                        <div className="md:col-span-2 bg-black relative border-r border-zinc-800 group overflow-hidden flex items-center justify-center">
                            {cameraActive ? (
                                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-center text-zinc-600 font-mono p-8">
                                    <Camera className="w-16 h-16 mb-4 mx-auto opacity-20" />
                                    <span className="block mb-2">NO CAMERA</span>
                                    <span className="text-xs opacity-50">Connect hardware to attempt camera access</span>
                                </div>
                            )}
                        </div>

                        {/* Control Panel */}
                        <div className="p-6 bg-zinc-900/30 flex flex-col gap-6 overflow-y-auto border-l border-zinc-800/50">
                            <div>
                                <h4 className="text-sm font-medium mb-4 flex items-center gap-2 text-zinc-300">
                                    <Sliders className="w-4 h-4" /> Joint Control (Teleop)
                                </h4>
                                <div className="space-y-6">
                                    {[0, 1, 2, 3, 4, 5].map((joint) => (
                                        <div key={joint} className="space-y-2">
                                            <div className="flex justify-between text-xs text-zinc-500">
                                                <span>Joint {joint + 1}</span>
                                                <span className="font-mono text-zinc-300">{jointVals[joint]?.toFixed(0)}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="-100" max="100"
                                                value={jointVals[joint]}
                                                disabled={!isControlsEnabled && calibrationState !== 'cal'}
                                                onChange={(e) => handleJointChange(joint, Number(e.target.value))}
                                                className={`w-full h-2 rounded-lg appearance-none cursor-pointer transition-all ${isControlsEnabled ? "bg-zinc-800 accent-primary hover:accent-primary/80" : "bg-zinc-800/50 accent-zinc-600 cursor-not-allowed"}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-auto pt-4 border-t border-zinc-800 space-y-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">Console Logs</p>
                                    <div className="p-3 bg-black/60 rounded-lg text-[10px] font-mono text-green-400/90 h-32 overflow-y-auto border border-zinc-800/50 shadow-inner">
                                        {logs.length === 0 && <span className="opacity-30 italic">System ready...</span>}
                                        {logs.map((l, i) => <div key={i} className="mb-0.5 whitespace-nowrap">&gt; {l}</div>)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`mt-8 transition-opacity duration-300 ${!isControlsEnabled ? "opacity-50 pointer-events-none grayscale" : ""}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Base & Shoulder Controls (WASD) */}
                    <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800 flex flex-col items-center gap-4">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Base & Shoulder</span>
                        <div className="grid grid-cols-3 gap-2">
                            <div />
                            <Button
                                variant="outline"
                                className="w-12 h-12 p-0 font-mono text-lg border-zinc-700 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95"
                                onMouseDown={() => manualMove(1, 1)}
                                title="Shoulder Up (W)"
                            >W</Button>
                            <div />
                            <Button
                                variant="outline"
                                className="w-12 h-12 p-0 font-mono text-lg border-zinc-700 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95"
                                onMouseDown={() => manualMove(0, -1)}
                                title="Base Left (A)"
                            >A</Button>
                            <Button
                                variant="outline"
                                className="w-12 h-12 p-0 font-mono text-lg border-zinc-700 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95"
                                onMouseDown={() => manualMove(1, -1)}
                                title="Shoulder Down (S)"
                            >S</Button>
                            <Button
                                variant="outline"
                                className="w-12 h-12 p-0 font-mono text-lg border-zinc-700 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95"
                                onMouseDown={() => manualMove(0, 1)}
                                title="Base Right (D)"
                            >D</Button>
                        </div>
                    </div>

                    {/* Elbow & Gripper Controls */}
                    <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800 flex flex-col items-center gap-4">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Elbow & Gripper</span>
                        <div className="grid grid-cols-3 gap-2">
                            <div />
                            <Button
                                variant="outline"
                                className="w-12 h-12 p-0 font-mono text-lg border-zinc-700 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95"
                                onMouseDown={() => manualMove(2, 1)}
                                title="Elbow Up (ArrowUp)"
                            >↑</Button>
                            <div />
                            <Button
                                variant="outline"
                                className="w-12 h-12 p-0 font-mono text-xs border-zinc-700 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95"
                                onMouseDown={() => manualMove(5, -1)}
                                title="Open Gripper (Shift)"
                            >OPEN</Button>
                            <Button
                                variant="outline"
                                className="w-12 h-12 p-0 font-mono text-lg border-zinc-700 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95"
                                onMouseDown={() => manualMove(2, -1)}
                                title="Elbow Down (ArrowDown)"
                            >↓</Button>
                            <Button
                                variant="outline"
                                className="w-12 h-12 p-0 font-mono text-xs border-zinc-700 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95"
                                onMouseDown={() => manualMove(5, 1)}
                                title="Close Gripper (Space)"
                            >CLOSE</Button>
                        </div>
                    </div>

                    {/* Wrist Controls */}
                    <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800 flex flex-col items-center gap-4 md:col-span-2">
                        <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Wrist Controls</span>
                        <div className="flex gap-8">
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-[10px] text-zinc-500 uppercase">Pitch</span>
                                <div className="flex gap-2">
                                    <Button variant="outline" className="h-10 w-12" onMouseDown={() => manualMove(3, -1)}>Q</Button>
                                    <Button variant="outline" className="h-10 w-12" onMouseDown={() => manualMove(3, 1)}>E</Button>
                                </div>
                            </div>
                            <div className="flex flex-col items-center gap-2">
                                <span className="text-[10px] text-zinc-500 uppercase">Roll</span>
                                <div className="flex gap-2">
                                    <Button variant="outline" className="h-10 w-12" onMouseDown={() => manualMove(4, -1)}>Z</Button>
                                    <Button variant="outline" className="h-10 w-12" onMouseDown={() => manualMove(4, 1)}>C</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
