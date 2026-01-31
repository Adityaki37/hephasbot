import { Sliders, Camera, Power, RefreshCw, Cpu, Activity, Video, AlertTriangle, Check, RotateCcw, Unlock, Lock, Disc, Play, Square, Settings, Gamepad2, Keyboard, Hand, ChevronRight, Info, Plus, Users, Link as LinkIcon, Unlink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRobot } from "@/components/robot-context";
import { useGamepad } from "@/hooks/use-gamepad";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { VisualKeyboard } from "@/components/visual-keyboard";
import { GamepadVisualizer } from "@/components/gamepad-visualizer";

export function RobotControlPanel() {
    const {
        // Multi-Robot State
        robots,
        activeRobotId,
        setActiveRobot,
        addRobot,
        syncControl,
        setSyncControl,
        disconnectRobot,

        // Active State (Mapped by useRobot)
        connected,
        calibrationState,
        jointVals,
        logs,
        startCalibration,
        finishCalibration,
        moveJoint,
        moveJointRel,
        startManualMove,
        stopManualMove,
        calibrationLimits,
        freeMode,
        isRecording,
        isPlaying,
        setFreeMode,
        toggleRecording,
        playRecording,

        speedMultiplier,
        setSpeedMultiplier
    } = useRobot();

    const videoRef = useRef<HTMLVideoElement>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
    const [activeTab, setActiveTab] = useState("teleop");

    // --- LOGIC: Active Tab determines Active Interaction Mode ---

    // 1. Free Mode Logic
    useEffect(() => {
        if (!connected) return;
        if (activeTab === "free") {
            setFreeMode(true);
        } else {
            setFreeMode(false);
        }
    }, [activeTab, connected, activeRobotId]); // Re-run if robot changes

    // 2. Gamepad Logic
    const onGamepadMove = useCallback((jointIdx: number, delta: number) => {
        moveJointRel(jointIdx, delta);
    }, [moveJointRel]);

    const gamepadState = useGamepad({
        enabled: connected && calibrationState === 'rdy' && activeTab === 'gamepad' && !isPlaying,
        onMove: onGamepadMove
    });

    // 3. Keyboard Logic
    // Handled purely by VisualKeyboard component now for the 'keyboard' tab.
    // We remove the global listener here to avoid duplication/conflict when the tab is active.
    // However, if we want keyboard to work GLOBALLY (outside the tab), we should keep it or make VisualKeyboard hidden?
    // The requirement implies visual feedback, so likely we only want it when looking at the tab.
    // If users want global keys, they can use the hook logic. For now, let's delegate to the component in the tab.


    // --- Camera Logic ---
    useEffect(() => {
        if (activeStream && videoRef.current) {
            videoRef.current.srcObject = activeStream;
            videoRef.current.play().catch(console.error);
        }
    }, [activeStream, cameraActive]);

    const toggleCamera = async () => {
        if (cameraActive) {
            if (activeStream) activeStream.getTracks().forEach(t => t.stop());
            setActiveStream(null);
            setCameraActive(false);
        } else {
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

    const handleJointChange = (jointIdx: number, val: number) => {
        if (activeTab !== 'teleop' && activeTab !== 'free') return;
        moveJoint(jointIdx, val);
    };

    // Calculate Robot Count
    const robotCount = Object.keys(robots).length;

    return (
        <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 bg-zinc-950/50 rounded-2xl border border-zinc-800 backdrop-blur-xl flex flex-col min-h-[800px]">
            {/* Header: Multi-Robot Manager */}
            <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4 border-b border-zinc-800 pb-6">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-3 rounded-full">
                        <Activity className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-white line-clamp-1">HephasBot Control</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className="text-xs text-zinc-400 font-mono uppercase">
                                {robotCount > 0 ? `${robotCount} Connected` : "Offline"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Side Controls */}
                <div className="flex flex-wrap gap-3 items-center justify-end">

                    {/* SYNC TOGGLE (Visible if > 1 Robot) */}
                    {robotCount > 1 && (
                        <div className="flex items-center gap-2 mr-4 bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-zinc-800">
                            <Switch
                                id="sync-mode"
                                checked={syncControl}
                                onCheckedChange={setSyncControl}
                                className="data-[state=checked]:bg-blue-600"
                            />
                            <Label htmlFor="sync-mode" className="text-xs text-zinc-400 flex items-center gap-1 cursor-pointer">
                                {syncControl ? <LinkIcon className="w-3 h-3 text-blue-400" /> : <Unlink className="w-3 h-3" />}
                                Sync Control
                            </Label>
                        </div>
                    )}

                    {/* Robot Selector */}
                    {robotCount > 0 && (
                        <Select value={activeRobotId || ""} onValueChange={(val) => val && setActiveRobot(val)}>
                            <SelectTrigger className="w-[140px] h-9 text-xs">
                                <span>{activeRobotId && robots[activeRobotId] ? robots[activeRobotId].name : "Select Robot"}</span>
                            </SelectTrigger>
                            <SelectContent>
                                {Object.values(robots).map(bot => (
                                    <SelectItem key={bot.id} value={bot.id}>
                                        {bot.name} {bot.calibrationState === 'rdy' ? '✓' : '⚠'}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    {/* Speed Slider */}
                    <div className="flex items-center gap-2 bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-zinc-800 mr-2">
                        <span className="text-xs font-mono text-zinc-500 uppercase">Speed</span>
                        <input
                            type="range"
                            min="0" max="2" step="0.1"
                            value={speedMultiplier}
                            onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
                            className="w-20 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                        />
                        <span className="text-xs font-mono text-white w-8">{speedMultiplier.toFixed(1)}x</span>
                    </div>

                    <Button onClick={addRobot} variant="outline" size="sm" className="h-9">
                        <Plus className="mr-2 h-3 w-3" /> Add Robot
                    </Button>

                    <Button
                        onClick={toggleCamera}
                        variant="outline"
                        size="sm"
                        className={`h-9 ${cameraActive ? "bg-red-500/10 text-red-500 border-red-500/30" : ""}`}
                    >
                        <Camera className="mr-2 h-3 w-3" />
                        {cameraActive ? "Stop" : "Cam"}
                    </Button>
                </div>
            </div>

            {/* Main Interface */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-5 mb-6 bg-zinc-900/50 p-1">
                    <TabsTrigger value="teleop" className="data-[state=active]:bg-zinc-800">
                        <Sliders className="mr-2 w-4 h-4" /> Teleop
                    </TabsTrigger>
                    <TabsTrigger value="keyboard" className="data-[state=active]:bg-zinc-800">
                        <Keyboard className="mr-2 w-4 h-4" /> Keyboard
                    </TabsTrigger>
                    <TabsTrigger value="gamepad" className="data-[state=active]:bg-zinc-800">
                        <Gamepad2 className="mr-2 w-4 h-4" /> Gamepad
                    </TabsTrigger>
                    <TabsTrigger value="free" className="data-[state=active]:bg-purple-900/30 data-[state=active]:text-purple-400">
                        <Hand className="mr-2 w-4 h-4" /> Lead Through
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="data-[state=active]:bg-zinc-800">
                        <Settings className="mr-2 w-4 h-4" /> Settings
                    </TabsTrigger>
                </TabsList>

                <div className="flex-1 bg-black/20 rounded-xl border border-zinc-800/50 p-6 relative overflow-hidden">
                    {/* Disconnected Overlay (If 0 robots) */}
                    {robotCount === 0 && (
                        <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8 text-center">
                            <Lock className="w-12 h-12 text-zinc-600 mb-4" />
                            <h3 className="text-xl font-bold text-zinc-400 mb-2">No Robots Connected</h3>
                            <p className="text-zinc-500 max-w-sm mb-6">Connect a robot to enable control modes.</p>
                            <Button onClick={addRobot} variant="outline">
                                <Power className="mr-2 h-4 w-4" /> Connect Now
                            </Button>
                        </div>
                    )}

                    {/* Uncalibrated Overlay (If connected but not ready) */}
                    {connected && calibrationState === 'unc' && (
                        <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm z-40 flex flex-col items-center justify-center p-8 text-center">
                            <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4 animate-bounce" />
                            <h3 className="text-xl font-bold text-white mb-2">Calibration Required</h3>
                            <p className="text-zinc-400 max-w-sm mb-6">Start calibration to manually move the robot and define limits.</p>
                            <Button onClick={startCalibration} className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold">
                                Start Calibration Display
                            </Button>
                        </div>
                    )}


                    {/* TELEOP TAB */}
                    <TabsContent value="teleop" className="h-full mt-0 space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
                            <div className="space-y-4">
                                <h3 className="font-semibold text-zinc-300 flex items-center gap-2">
                                    <Sliders className="w-4 h-4" /> Manual Joint Control
                                    {syncControl && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded ml-2">SYNC ON</span>}
                                    {calibrationState === 'cal' && (
                                        <div className="ml-auto flex items-center gap-2">
                                            <span className="text-xs text-yellow-500 animate-pulse font-mono">CALIBRATION MODE</span>
                                            <Button onClick={finishCalibration} size="sm" className="h-7 bg-blue-600 hover:bg-blue-700 text-white text-xs">
                                                Finish Calibration
                                            </Button>
                                        </div>
                                    )}
                                </h3>
                                <div className="space-y-5 pr-2">
                                    {[0, 1, 2, 3, 4, 5].map((joint) => {
                                        const limits = calibrationLimits[joint] || { min: 0, max: 4095 };
                                        const sliderVal = jointVals[joint] || 0;
                                        // Display logic
                                        let currentPos = 0;
                                        if (calibrationState === 'cal' || activeTab === 'free') {
                                            currentPos = Math.floor((sliderVal + 100) * 20.48);
                                        } else {
                                            const range = limits.max - limits.min;
                                            const normalized = (sliderVal + 100) / 200;
                                            currentPos = Math.floor(limits.min + (normalized * range));
                                        }

                                        return (
                                            <div key={joint} className="space-y-1.5">
                                                <div className="flex justify-between text-xs text-zinc-500">
                                                    <span className="font-mono uppercase">Joint {joint + 1}</span>
                                                    <span className="font-mono text-zinc-300">{currentPos}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="-100" max="100"
                                                    value={jointVals[joint]}
                                                    onChange={(e) => handleJointChange(joint, Number(e.target.value))}
                                                    disabled={calibrationState !== 'rdy' && activeTab !== 'free'}
                                                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Visualizer Area */}
                            <div className="bg-black rounded-xl border border-zinc-800 flex items-center justify-center overflow-hidden relative group">
                                {cameraActive ? (
                                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Video className="w-8 h-8 text-zinc-700" />
                                        </div>
                                        <p className="text-zinc-600 text-sm">Camera Feed Inactive</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    {/* KEYBOARD TAB */}
                    <TabsContent value="keyboard" className="h-full mt-0 flex flex-col items-center justify-center space-y-8">
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-bold text-white mb-2">Keyboard Control</h3>
                            <p className="text-zinc-500 text-sm">Use keys or click buttons below</p>
                        </div>
                        <VisualKeyboard
                            onMoveStart={startManualMove}
                            onMoveStop={stopManualMove}
                        />
                    </TabsContent>

                    {/* GAMEPAD TAB */}
                    <TabsContent value="gamepad" className="h-full mt-0 flex flex-col items-center justify-center space-y-8">
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-bold text-white mb-2">Gamepad Status</h3>
                            <p className="text-zinc-500 text-sm">Visual feedback of connected controller</p>
                        </div>
                        <div className="relative w-full flex justify-center">
                            {!gamepadState.connected && (
                                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm rounded-2xl">
                                    <Gamepad2 className="w-12 h-12 text-zinc-600 mb-4 animate-pulse" />
                                    <h3 className="text-xl font-bold text-zinc-400 mb-2">Gamepad Not Detected</h3>
                                    <p className="text-zinc-500 max-w-sm mb-6 text-center">Press any button on your controller to wake it up.</p>
                                </div>
                            )}
                            <GamepadVisualizer state={gamepadState} />
                        </div>
                    </TabsContent>

                    {/* FREE MODE (LEAD THROUGH) TAB */}
                    <TabsContent value="free" className="h-full mt-0 flex flex-col items-center justify-center space-y-8">
                        <div className="text-center space-y-2">
                            <div className="inline-flex items-center justify-center p-4 bg-purple-500/10 rounded-full mb-4 animate-bounce">
                                <Hand className="w-12 h-12 text-purple-400" />
                            </div>
                            <h3 className="text-3xl font-bold text-purple-400">Lead Through Mode</h3>
                            <p className="text-purple-200/60 max-w-lg mx-auto text-lg">
                                Motors are relaxed. Sync is {syncControl ? "ON" : "OFF"}.<br />
                                Move the robot arm physically to desired positions.
                            </p>
                        </div>
                        <div className="flex gap-4">
                            {isRecording && <div className="px-4 py-2 bg-red-500/20 text-red-400 rounded-full border border-red-500/50 animate-pulse font-mono">RECORDING TRAJECTORY...</div>}
                        </div>
                    </TabsContent>

                    {/* SETTINGS TAB */}
                    <TabsContent value="settings" className="space-y-6 mt-0 overflow-y-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="p-6 bg-zinc-900/30 rounded-xl border border-zinc-800">
                                <h3 className="text-lg font-medium mb-4 text-white flex items-center gap-2"><Activity className="w-5 h-5" /> Calibration</h3>
                                <div className="flex flex-col gap-4">
                                    <p className="text-sm text-zinc-500">
                                        Calibrating: <span className="text-white font-mono">{activeRobotId ? robots[activeRobotId]?.name : 'None'}</span>
                                    </p>
                                    <div className="flex gap-3">
                                        <Button onClick={startCalibration} variant="outline" disabled={!connected || calibrationState === 'cal'}>Start</Button>
                                        <Button onClick={finishCalibration} disabled={calibrationState !== 'cal'} className="bg-blue-600 hover:bg-blue-700">Finish</Button>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 bg-zinc-900/30 rounded-xl border border-zinc-800">
                                <h3 className="text-lg font-medium mb-4 text-white flex items-center gap-2"><Cpu className="w-5 h-5" /> Diagnostics</h3>
                                {activeRobotId && (
                                    <Button onClick={() => disconnectRobot(activeRobotId)} variant="destructive" className="w-full justify-start">
                                        <Unlink className="mr-2 h-4 w-4" /> Disconnect This Robot
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="p-6 bg-zinc-900/30 rounded-xl border border-zinc-800">
                            <h3 className="text-sm font-mono text-zinc-500 mb-2">SYSTEM LOGS</h3>
                            <div className="bg-black/50 p-4 rounded-lg h-40 overflow-y-auto text-xs font-mono text-green-400/80">
                                {logs.map((l, i) => <div key={i}>&gt; {l}</div>)}
                            </div>
                        </div>
                    </TabsContent>
                </div>
            </Tabs>

            {/* Persistent Recording Footer */}
            <div className="mt-4 p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${isRecording ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-zinc-800 text-zinc-600'}`}>
                        <Disc className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-sm font-semibold text-zinc-300">Trajectory Recorder</h4>
                        <p className="text-xs text-zinc-500">
                            {isRecording ? "Recording active..." : isPlaying ? "Playback active..." : "Ready to record"}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Button
                        onClick={toggleRecording}
                        variant={isRecording ? "destructive" : "outline"}
                        disabled={!connected || isPlaying}
                        className="w-32"
                    >
                        {isRecording ? <Square className="mr-2 h-4 w-4 fill-current" /> : <Disc className="mr-2 h-4 w-4" />}
                        {isRecording ? "STOP" : "REC"}
                    </Button>
                    <Button
                        onClick={() => playRecording()}
                        variant="secondary"
                        disabled={!connected || isRecording || isPlaying}
                        className="w-32"
                    >
                        {isPlaying ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                        PLAY
                    </Button>
                </div>
            </div>
        </div>
    );
}
