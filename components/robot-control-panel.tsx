import { Sliders, Camera, Power, RefreshCw, Cpu, Activity, Video, AlertTriangle, Check, RotateCcw, Unlock, Lock, Disc, Play, Square, Settings, Gamepad2, Keyboard, Hand, ChevronRight, Info, Plus, Users, Link as LinkIcon, Unlink, Maximize2, Minimize2, Edit2, ArrowRightLeft, Monitor } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRobot } from "@/components/robot-context";
import { cn } from "@/lib/utils";
import { useGamepad } from "@/hooks/use-gamepad";
import useMeasure from "react-use-measure";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { VisualKeyboard } from "@/components/visual-keyboard";
import { GamepadVisualizer } from "@/components/gamepad-visualizer";
import { ResizableSplitPane } from "@/components/resizable-split-pane";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { MotorConfigWizard } from "@/components/motor-config-wizard";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

// function RobotControlPanel continued...

function CameraGrid({
    cameras,
    onRemove,
    onAdd
}: {
    cameras: { id: string, label?: string, stream: MediaStream }[],
    onRemove: (id: string) => void,
    onAdd: () => void
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [useColumns, setUseColumns] = useState(true);

    // Use ResizeObserver to dynamically determine best layout
    useEffect(() => {
        const container = containerRef.current;
        if (!container || cameras.length < 2) return;

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;

            const { width, height } = entry.contentRect;
            const aspectRatio = width / height;

            // For 2 cameras: if container is wide (aspect > 1.2), use columns; otherwise stack
            // For 3+ cameras: if container is wide (aspect > 1.5), use 2 columns; otherwise stack
            if (cameras.length === 2) {
                setUseColumns(aspectRatio > 1.2);
            } else {
                // For 3+ cameras, use 2 columns when wide enough
                setUseColumns(aspectRatio > 1.0 && width > 400);
            }
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, [cameras.length]);

    // Determine grid class based on camera count and layout mode
    const getLayoutClass = () => {
        if (cameras.length === 0 || cameras.length === 1) {
            return 'flex items-center justify-center';
        }
        if (useColumns) {
            return 'grid grid-cols-2 gap-3 place-items-center auto-rows-fr';
        }
        return 'flex flex-col gap-3 items-center justify-center';
    };

    return (
        <div
            ref={containerRef}
            className={`w-full h-full min-h-[200px] bg-black/40 rounded-xl border border-zinc-800 p-3 ${getLayoutClass()}`}
        >
            {cameras.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-zinc-800 rounded-lg">
                    <div className="w-14 h-14 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Video className="w-7 h-7 text-zinc-700" />
                    </div>
                    <p className="text-zinc-500 text-sm mb-3">No cameras connected</p>
                    <Button onClick={onAdd} variant="outline" size="sm">
                        <Plus className="mr-2 h-3 w-3" /> Add Camera
                    </Button>
                </div>
            ) : (
                cameras.map((cam) => (
                    <CameraFeed key={cam.id} cam={cam} onRemove={onRemove} />
                ))
            )}
        </div>
    );
}

export function RobotControlPanel() {
    const {
        connected,
        activeRobotId,
        robots,
        setActiveRobot,
        addRobot,
        syncControl,
        setSyncControl,
        disconnectRobot,

        // Leader Follower
        leaderRobotId,
        setLeaderRobotId,
        isLeaderFollowerActive,
        toggleLeaderFollower,

        // Active State (Mapped by useRobot)
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
        setSpeedMultiplier,
        scanMotors,
        followerRobotId,
        setFollowerRobotId,
        updateRobotName
    } = useRobot();

    // Multi-Camera State
    const [cameras, setCameras] = useState<{ id: string, label?: string, stream: MediaStream }[]>([]);
    const [activeTab, setActiveTab] = useState("teleop");
    const [showCamerasInTabs, setShowCamerasInTabs] = useState(true);

    // Resizable Split Pane State
    const [splitWidth, setSplitWidth] = useState(60); // percentage for controls panel (default 60% for controls)

    // Camera Selection State
    const [showCameraSelector, setShowCameraSelector] = useState(false);
    const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);

    // Fullscreen State
    const panelRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showWizard, setShowWizard] = useState(false);
    const [calibrationError, setCalibrationError] = useState<string | null>(null);
    const [calibrationWarning, setCalibrationWarning] = useState<{ found: number, ids: number[] } | null>(null);

    // Name Editing State
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [editingNameValue, setEditingNameValue] = useState("");

    const startEditingName = (id: string, currentName: string) => {
        setEditingNameId(id);
        setEditingNameValue(currentName);
    };

    const saveName = () => {
        if (editingNameId && editingNameValue.trim()) {
            updateRobotName(editingNameId, editingNameValue.trim());
            setEditingNameId(null);
        }
    };

    // --- SAFE CALIBRATION HANDLER ---
    const handleSafeCalibrationStart = async () => {
        if (!activeRobotId) {
            return;
        }

        try {
            // 1. Scan bus
            const ids = await scanMotors(activeRobotId);

            // Filter valid IDs
            const validIds = ids.filter(id => id >= 1 && id <= 6);

            // 2. Case: No Connection
            if (ids.length === 0) {
                setCalibrationError("Connection Error: No motors found.\n\nPlease check:\n1. Power supply is ON\n2. USB connection is secure\n3. Emergency stop is released");
                return;
            }

            // 3. Case: Incomplete Configuration
            if (validIds.length < 6) {
                setCalibrationWarning({ found: validIds.length, ids });
                return;
            }

            // 4. Good to Go
            startCalibration();
        } catch (error) {
            console.error("[CalibrationCheck] Error during check:", error);
            setCalibrationError("Failed to scan motors before calibration.\nCheck console for details.");
        }
    };

    const toggleFullscreen = useCallback(() => {
        if (!panelRef.current) return;
        if (!document.fullscreenElement) {
            panelRef.current.requestFullscreen().catch(err => {
                console.error('Fullscreen request failed:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Measure containers for precise scaling
    // Separate refs to avoid conflicts between tabs and ensure correct widths
    const [gamepadRef, gamepadBounds] = useMeasure();
    const [keyboardRef, keyboardBounds] = useMeasure();

    // Calculate dynamic scales
    const BASE_WIDTH = 540;
    const PADDING = 48; // px

    // Gamepad Scale
    const gpScaleCalc = gamepadBounds.width ? (gamepadBounds.width - PADDING) / BASE_WIDTH : 1.0;
    const gamepadScale = Math.min(Math.max(gpScaleCalc, 0.5), 1.8);

    // Keyboard Scale (can share same base scale logic or tune independently)
    const kbScaleCalc = keyboardBounds.width ? (keyboardBounds.width - PADDING) / 480 : 1.0;
    const keyboardScale = Math.min(Math.max(kbScaleCalc, 0.5), 1.8);

    // Legacy fallback (remove eventually)
    // const baseScale = showCamerasInTabs ? Math.max(1.0, (splitWidth / 50) * 1.2) : 1.5;
    // const controlScale = isFullscreen ? baseScale * 1.4 : baseScale;

    // --- LOGIC: Active Tab determines Active Interaction Mode ---

    const [isWebSerialSupported, setIsWebSerialSupported] = useState(true);

    useEffect(() => {
        // Check for Web Serial API support
        if (typeof navigator !== 'undefined') {
            const supported = 'serial' in navigator;
            setIsWebSerialSupported(supported);
        }
    }, []);

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
        // Only move if ready (safety check moved here to allow visualizer to work always)
        if (connected && calibrationState === 'rdy' && !isPlaying) {
            moveJointRel(jointIdx, delta);
        }
    }, [moveJointRel, connected, calibrationState, isPlaying]);

    const gamepadState = useGamepad({
        // Always enable visualizer when tab is active to detect connection
        // Actual movement is guarded in onGamepadMove
        enabled: activeTab === 'gamepad',
        onMove: onGamepadMove
    });

    // 3. Keyboard Logic
    // Handled purely by VisualKeyboard component.


    // --- Camera Logic ---
    const startAddCamera = async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
            console.warn("Media Devices API not available");
            return;
        }
        try {
            await navigator.mediaDevices.getUserMedia({ video: true }); // Request permission first
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            setAvailableDevices(videoDevices);
            setShowCameraSelector(true);
        } catch (e) {
            console.error("Failed to enumerate devices:", e);
        }
    };

    const addCamera = async (deviceId: string, label: string) => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: { exact: deviceId },
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                }
            });
            const id = crypto.randomUUID();
            setCameras(prev => [...prev, { id, label, stream }]);
            setShowCameraSelector(false);
        } catch (e) {
            console.error("Camera access failed:", e);
        }
    };

    const removeCamera = (id: string) => {
        setCameras(prev => {
            const cam = prev.find(c => c.id === id);
            if (cam) {
                cam.stream.getTracks().forEach(t => t.stop());
            }
            return prev.filter(c => c.id !== id);
        });
    };

    const handleJointChange = (jointIdx: number, val: number) => {
        if (activeTab !== 'teleop' && activeTab !== 'free') return;
        moveJoint(jointIdx, val);
    };

    // Calculate Robot Count
    const robotCount = Object.keys(robots).length;

    if (!isWebSerialSupported) {
        return (
            <div className="w-full h-full min-h-[600px] flex flex-col items-center justify-center bg-zinc-950 p-8 text-center space-y-6 animate-in fade-in duration-500">
                <div className="bg-red-500/10 p-6 rounded-full ring-1 ring-red-500/50 shadow-[0_0_30px_-10px_rgba(239,68,68,0.5)]">
                    <AlertTriangle className="w-16 h-16 text-red-500" />
                </div>
                <div className="max-w-md space-y-2">
                    <h2 className="text-2xl font-bold text-white">Browser Not Supported</h2>
                    <p className="text-zinc-400">
                        This application requires the <span className="text-orange-400 font-mono">Web Serial API</span> to communicate with the robot.
                    </p>
                </div>
                <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 max-w-sm w-full">
                    <p className="text-sm text-zinc-500 mb-3 uppercase tracking-wider font-bold">Recommended Browsers</p>
                    <div className="flex justify-center gap-6">
                        <div className="flex flex-col items-center gap-2 group cursor-help">
                            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30 group-hover:bg-blue-500/30 transition-colors">
                                <Monitor className="w-5 h-5 text-blue-400" />
                            </div>
                            <span className="text-xs text-zinc-400">Chrome</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 group cursor-help">
                            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center border border-green-500/30 group-hover:bg-green-500/30 transition-colors">
                                <Monitor className="w-5 h-5 text-green-400" />
                            </div>
                            <span className="text-xs text-zinc-400">Edge</span>
                        </div>
                        <div className="flex flex-col items-center gap-2 group cursor-help">
                            <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center border border-red-500/30 group-hover:bg-red-500/30 transition-colors">
                                <Monitor className="w-5 h-5 text-red-400" />
                            </div>
                            <span className="text-xs text-zinc-400">Opera</span>
                        </div>
                    </div>
                </div>
                <p className="text-xs text-zinc-600 max-w-xs">
                    Firefox and Safari do not currently implement the Web Serial standard.
                </p>
            </div>
        );
    }

    return (
        <div ref={panelRef} className={`w-full mx-auto p-4 sm:p-6 lg:p-8 bg-zinc-950/50 rounded-2xl border border-zinc-800 backdrop-blur-xl flex flex-col relative ${isFullscreen ? 'max-w-none h-screen' : 'max-w-6xl min-h-[600px]'}`}>

            {/* MOTOR WIZARD OVERLAY */}
            {showWizard && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <MotorConfigWizard onClose={() => setShowWizard(false)} />
                </div>
            )}

            {/* ERROR DIALOG */}
            <AlertDialog open={!!calibrationError} onOpenChange={(open) => !open && setCalibrationError(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-500 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" /> Calibration Check Failed
                        </AlertDialogTitle>
                        <AlertDialogDescription className="whitespace-pre-line text-zinc-600 dark:text-zinc-300">
                            {calibrationError}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setCalibrationError(null)}>OK</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* CONFIRMATION DIALOG */}
            <AlertDialog open={!!calibrationWarning} onOpenChange={(open) => !open && setCalibrationWarning(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Configuration Incomplete</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="flex flex-col gap-4 pt-2">
                                <p className="text-zinc-600 dark:text-zinc-400">
                                    The robot configuration does not match the expected setup.
                                </p>

                                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Motors Found</span>
                                        <span className={cn(
                                            "text-sm font-bold",
                                            (calibrationWarning?.found || 0) < 6 ? "text-amber-500" : "text-green-500"
                                        )}>
                                            {calibrationWarning?.found} / 6
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5">
                                        {calibrationWarning?.ids.length === 0 ? (
                                            <span className="text-xs text-zinc-500 italic">No IDs detected</span>
                                        ) : (
                                            calibrationWarning?.ids.map(id => (
                                                <Badge key={id} variant="secondary" className="font-mono text-xs">
                                                    ID {id}
                                                </Badge>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <p className="text-zinc-600 dark:text-zinc-400">
                                    Do you want to open the Motor Configuration Wizard to identify and fix the missing motors?
                                </p>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setCalibrationWarning(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => { setCalibrationWarning(null); setShowWizard(true); }}>
                            Open Wizard
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Camera Selection Modal */}
            {showCameraSelector && (
                <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm rounded-2xl p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <h3 className="text-xl font-bold text-white mb-4">Select Camera</h3>
                        <div className="space-y-2 mb-6 max-h-[300px] overflow-y-auto">
                            {availableDevices.map((device, idx) => (
                                <Button
                                    key={device.deviceId || idx}
                                    variant="outline"
                                    className="w-full justify-start text-left font-normal"
                                    onClick={() => addCamera(device.deviceId, device.label || `Camera ${idx + 1}`)}
                                >
                                    <Video className="mr-2 h-4 w-4 text-zinc-500" />
                                    {device.label || `Camera ${idx + 1}`}
                                </Button>
                            ))}
                            {availableDevices.length === 0 && (
                                <p className="text-zinc-500 text-sm text-center py-4">No video devices found.</p>
                            )}
                        </div>
                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={() => setShowCameraSelector(false)}
                        >
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

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

                    {/* Robot Selector with Edit */}
                    {robotCount > 0 && (
                        <div className="flex items-center gap-2">
                            {editingNameId === activeRobotId ? (
                                <div className="flex items-center gap-1">
                                    <Input
                                        value={editingNameValue}
                                        onChange={(e) => setEditingNameValue(e.target.value)}
                                        className="h-9 w-32 text-xs"
                                        onKeyDown={(e) => e.key === 'Enter' && saveName()}
                                        autoFocus
                                    />
                                    <Button size="sm" variant="ghost" onClick={saveName} className="h-9 w-9 p-0 hover:bg-green-500/20 hover:text-green-400">
                                        <Check className="w-4 h-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center">
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
                                    {activeRobotId && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-9 w-9 p-0 ml-1 text-zinc-500 hover:text-white"
                                            onClick={() => startEditingName(activeRobotId, robots[activeRobotId].name)}
                                        >
                                            <Edit2 className="w-3 h-3" />
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Speed Slider */}
                    <div className="flex items-center gap-2 bg-zinc-900/50 px-3 py-1.5 rounded-lg border border-zinc-800 mr-2">
                        <span className="text-xs font-mono text-zinc-500 uppercase">Speed</span>
                        <input
                            type="range"
                            min="0" max="2" step="0.1"
                            value={speedMultiplier}
                            onChange={(e) => setSpeedMultiplier(Number(e.target.value))}
                            className="w-20 h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                        <span className="text-xs font-mono text-white w-8">{speedMultiplier.toFixed(1)}x</span>
                    </div>

                    <Button onClick={addRobot} variant="outline" size="sm" className="h-9">
                        <Plus className="mr-2 h-3 w-3" /> Add Robot
                    </Button>

                    <Button
                        onClick={startAddCamera}
                        variant="outline"
                        size="sm"
                        className="h-9"
                    >
                        <Camera className="mr-2 h-3 w-3" />
                        + Add Camera
                    </Button>

                    <Button
                        onClick={toggleFullscreen}
                        variant="ghost"
                        size="sm"
                        className="h-9 w-9 p-0"
                        title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                    >
                        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                    </Button>
                </div>
            </div>

            {/* Main Interface */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="grid w-full grid-cols-6 mb-6 bg-zinc-900/50 p-1">
                    <TabsTrigger value="teleop" className="data-[active]:bg-primary/10 data-[active]:text-primary data-[active]:font-bold transition-all">
                        <Sliders className="mr-2 w-4 h-4" /> Joint Control
                    </TabsTrigger>
                    <TabsTrigger value="keyboard" className="data-[active]:bg-primary/10 data-[active]:text-primary data-[active]:font-bold transition-all">
                        <Keyboard className="mr-2 w-4 h-4" /> Keyboard
                    </TabsTrigger>
                    <TabsTrigger value="gamepad" className="data-[active]:bg-primary/10 data-[active]:text-primary data-[active]:font-bold transition-all">
                        <Gamepad2 className="mr-2 w-4 h-4" /> Gamepad
                    </TabsTrigger>
                    <TabsTrigger value="free" className="data-[active]:bg-primary/10 data-[active]:text-primary data-[active]:font-bold transition-all">
                        <Hand className="mr-2 w-4 h-4" /> Lead Through
                    </TabsTrigger>
                    <TabsTrigger value="leader" className="data-[active]:bg-primary/10 data-[active]:text-primary data-[active]:font-bold transition-all">
                        <Users className="mr-2 w-4 h-4" /> Leader Mode
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="data-[active]:bg-primary/10 data-[active]:text-primary data-[active]:font-bold transition-all">
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

                            <div className="flex flex-col gap-3 w-full max-w-xs">
                                <Button
                                    onClick={handleSafeCalibrationStart}
                                    className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold w-full"
                                >
                                    Start Calibration Display
                                </Button>

                                <Button
                                    onClick={() => setShowWizard(true)}
                                    variant="outline"
                                    className="w-full border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                                >
                                    <Settings className="mr-2 h-4 w-4" /> Configure Motors
                                </Button>
                            </div>
                        </div>
                    )}


                    {/* TELEOP TAB */}
                    <TabsContent value="teleop" className="h-full mt-0 flex flex-col">
                        <div className="w-full flex justify-end px-4 mb-4">
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="show-cam-teleop"
                                    checked={showCamerasInTabs}
                                    onCheckedChange={setShowCamerasInTabs}
                                />
                                <Label htmlFor="show-cam-teleop" className="text-zinc-400 text-xs">Show Cameras</Label>
                            </div>
                        </div>

                        {showCamerasInTabs ? (
                            <ResizableSplitPane
                                defaultLeftWidth={splitWidth}
                                minLeftWidth={40}
                                maxLeftWidth={75}
                                onResize={setSplitWidth}
                                className="flex-1"
                                left={
                                    <div className="h-full flex flex-col p-4 overflow-auto">
                                        <div className="text-center space-y-2 mb-6">
                                            <h3 className="text-xl font-bold text-white">Joint Control</h3>
                                            <p className="text-zinc-500 text-sm">Precise independent joint manipulation</p>
                                        </div>

                                        {(syncControl || calibrationState === 'cal') && (
                                            <div className="flex items-center justify-center gap-2 mb-4">
                                                {syncControl && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-mono">SYNC ON</span>}
                                                {calibrationState === 'cal' && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-yellow-500 animate-pulse font-mono">CALIBRATION MODE</span>
                                                        <Button onClick={finishCalibration} size="sm" className="h-7 bg-blue-600 hover:bg-blue-700 text-white text-xs">
                                                            Finish Calibration
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="space-y-5">
                                            {[0, 1, 2, 3, 4, 5].map((joint) => {
                                                const limits = calibrationLimits[joint] || { min: 0, max: 4095 };
                                                const sliderVal = jointVals[joint] || 0;
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
                                }
                                right={
                                    <div className="h-full flex flex-col p-4 overflow-auto">
                                        <h3 className="font-semibold text-zinc-300 flex items-center gap-2 mb-4">
                                            <Video className="w-4 h-4" /> Camera Feeds
                                        </h3>
                                        <div className="flex-1 min-h-[300px]">
                                            <CameraGrid cameras={cameras} onRemove={removeCamera} onAdd={startAddCamera} />
                                        </div>
                                    </div>
                                }
                            />
                        ) : (
                            <div className="flex-1 p-4">
                                <div className="text-center space-y-2 mb-6">
                                    <h3 className="text-xl font-bold text-white">Joint Control</h3>
                                    <p className="text-zinc-500 text-sm">Precise independent joint manipulation</p>
                                </div>

                                {(syncControl || calibrationState === 'cal') && (
                                    <div className="flex items-center justify-center gap-2 mb-4">
                                        {syncControl && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-mono">SYNC ON</span>}
                                        {calibrationState === 'cal' && (
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-yellow-500 animate-pulse font-mono">CALIBRATION MODE</span>
                                                <Button onClick={finishCalibration} size="sm" className="h-7 bg-blue-600 hover:bg-blue-700 text-white text-xs">
                                                    Finish Calibration
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div className="space-y-5 max-w-xl mx-auto">
                                    {[0, 1, 2, 3, 4, 5].map((joint) => {
                                        const limits = calibrationLimits[joint] || { min: 0, max: 4095 };
                                        const sliderVal = jointVals[joint] || 0;
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
                        )}
                    </TabsContent>

                    {/* KEYBOARD TAB */}
                    <TabsContent value="keyboard" className="h-full mt-0 flex flex-col">
                        <div className="w-full flex justify-end px-4 mb-4">
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="show-cam-kbd"
                                    checked={showCamerasInTabs}
                                    onCheckedChange={setShowCamerasInTabs}
                                />
                                <Label htmlFor="show-cam-kbd" className="text-zinc-400 text-xs">Show Cameras</Label>
                            </div>
                        </div>

                        {showCamerasInTabs ? (
                            <ResizableSplitPane
                                defaultLeftWidth={splitWidth}
                                minLeftWidth={40}
                                maxLeftWidth={75}
                                onResize={setSplitWidth}
                                className="flex-1"
                                left={
                                    <div className="h-full flex flex-col items-center justify-center p-4 overflow-hidden">
                                        <div className="text-center space-y-2 mb-4">
                                            <h3 className="text-xl font-bold text-white">Keyboard Control</h3>
                                            <p className="text-zinc-500 text-sm">Use keys or click buttons below</p>
                                        </div>
                                        <div ref={keyboardRef} className="w-full flex justify-center">
                                            <VisualKeyboard
                                                onMoveStart={startManualMove}
                                                onMoveStop={stopManualMove}
                                                scale={keyboardScale}
                                            />
                                        </div>
                                    </div>
                                }
                                right={
                                    <div className="h-full flex flex-col p-4 overflow-auto">
                                        <h3 className="font-semibold text-zinc-300 flex items-center gap-2 mb-4">
                                            <Video className="w-4 h-4" /> Camera Feeds
                                        </h3>
                                        <div className="flex-1 min-h-[300px]">
                                            <CameraGrid cameras={cameras} onRemove={removeCamera} onAdd={startAddCamera} />
                                        </div>
                                    </div>
                                }
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <div className="text-center space-y-2 mb-6">
                                    <h3 className="text-2xl font-bold text-white">Keyboard Control</h3>
                                    <p className="text-zinc-500 text-sm">Use keys or click buttons below</p>
                                </div>
                                <div ref={keyboardRef} className="w-full flex justify-center">
                                    <VisualKeyboard
                                        onMoveStart={startManualMove}
                                        onMoveStop={stopManualMove}
                                        scale={keyboardScale}
                                    />
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* GAMEPAD TAB */}
                    <TabsContent value="gamepad" className="h-full mt-0 flex flex-col">
                        <div className="w-full flex justify-end px-4 mb-4">
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="show-cam-gamepad"
                                    checked={showCamerasInTabs}
                                    onCheckedChange={setShowCamerasInTabs}
                                />
                                <Label htmlFor="show-cam-gamepad" className="text-zinc-400 text-xs">Show Cameras</Label>
                            </div>
                        </div>

                        {showCamerasInTabs ? (
                            <ResizableSplitPane
                                defaultLeftWidth={splitWidth}
                                minLeftWidth={40}
                                maxLeftWidth={75}
                                onResize={setSplitWidth}
                                className="flex-1"
                                left={
                                    <div className="h-full flex flex-col items-center justify-center px-6 py-4 overflow-hidden">
                                        <div className="text-center space-y-2 mb-4">
                                            <h3 className="text-xl font-bold text-white">Gamepad Status</h3>
                                            <p className="text-zinc-500 text-sm">Visual feedback of connected controller</p>
                                        </div>
                                        <div ref={gamepadRef} className="w-full relative flex-shrink-0 flex justify-center">
                                            {!gamepadState.connected && (
                                                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm rounded-2xl">
                                                    <Gamepad2 className="w-12 h-12 text-zinc-600 mb-4 animate-pulse" />
                                                    <h3 className="text-xl font-bold text-zinc-400 mb-2">Gamepad Not Detected</h3>
                                                    <p className="text-zinc-500 max-w-sm mb-6 text-center">Press any button on your controller to wake it up.</p>
                                                </div>
                                            )}
                                            <GamepadVisualizer state={gamepadState} scale={gamepadScale} />
                                        </div>
                                    </div>
                                }
                                right={
                                    <div className="h-full flex flex-col p-4 overflow-auto">
                                        <h3 className="font-semibold text-zinc-300 flex items-center gap-2 mb-4">
                                            <Video className="w-4 h-4" /> Camera Feeds
                                        </h3>
                                        <div className="flex-1 min-h-[300px]">
                                            <CameraGrid cameras={cameras} onRemove={removeCamera} onAdd={startAddCamera} />
                                        </div>
                                    </div>
                                }
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <div className="text-center space-y-2 mb-6">
                                    <h3 className="text-2xl font-bold text-white">Gamepad Status</h3>
                                    <p className="text-zinc-500 text-sm">Visual feedback of connected controller</p>
                                </div>
                                <div ref={gamepadRef} className="relative flex justify-center w-full">
                                    {!gamepadState.connected && (
                                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm rounded-2xl">
                                            <Gamepad2 className="w-12 h-12 text-zinc-600 mb-4 animate-pulse" />
                                            <h3 className="text-xl font-bold text-zinc-400 mb-2">Gamepad Not Detected</h3>
                                            <p className="text-zinc-500 max-w-sm mb-6 text-center">Press any button on your controller to wake it up.</p>
                                        </div>
                                    )}
                                    <GamepadVisualizer state={gamepadState} scale={gamepadScale} />
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* FREE MODE (LEAD THROUGH) TAB */}
                    <TabsContent value="free" className="h-full mt-0 flex flex-col">
                        <div className="w-full flex justify-end px-4 mb-4">
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="show-cam-free"
                                    checked={showCamerasInTabs}
                                    onCheckedChange={setShowCamerasInTabs}
                                />
                                <Label htmlFor="show-cam-free" className="text-zinc-400 text-xs">Show Cameras</Label>
                            </div>
                        </div>

                        {showCamerasInTabs ? (
                            <ResizableSplitPane
                                defaultLeftWidth={splitWidth}
                                minLeftWidth={40}
                                maxLeftWidth={75}
                                onResize={setSplitWidth}
                                className="flex-1"
                                left={
                                    <div className="h-full flex flex-col items-center justify-center p-4 overflow-hidden">
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
                                        <div className="flex gap-4 mt-4">
                                            {isRecording && <div className="px-4 py-2 bg-red-500/20 text-red-400 rounded-full border border-red-500/50 animate-pulse font-mono">RECORDING TRAJECTORY...</div>}
                                        </div>
                                    </div>
                                }
                                right={
                                    <div className="h-full flex flex-col p-4 overflow-auto">
                                        <h3 className="font-semibold text-zinc-300 flex items-center gap-2 mb-4">
                                            <Video className="w-4 h-4" /> Camera Feeds
                                        </h3>
                                        <div className="flex-1 min-h-[300px]">
                                            <CameraGrid cameras={cameras} onRemove={removeCamera} onAdd={startAddCamera} />
                                        </div>
                                    </div>
                                }
                            />
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center">
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
                                <div className="flex gap-4 mt-4">
                                    {isRecording && <div className="px-4 py-2 bg-red-500/20 text-red-400 rounded-full border border-red-500/50 animate-pulse font-mono">RECORDING TRAJECTORY...</div>}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {/* LEADER MODE TAB */}
                    <TabsContent value="leader" className="h-full mt-0 flex flex-col">
                        <div className="w-full flex justify-end px-4 mb-4">
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="show-cameras-leader"
                                    checked={showCamerasInTabs}
                                    onCheckedChange={setShowCamerasInTabs}
                                />
                                <Label htmlFor="show-cameras-leader" className="text-zinc-400 text-xs">
                                    Show Cameras
                                </Label>
                            </div>
                        </div>

                        {showCamerasInTabs ? (
                            <ResizableSplitPane
                                defaultLeftWidth={splitWidth}
                                minLeftWidth={40}
                                maxLeftWidth={75}
                                onResize={setSplitWidth}
                                className="flex-1"
                                left={
                                    <div className="h-full p-4 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center">
                                        <div className="text-center space-y-2 mb-6">
                                            <h3 className="text-xl font-bold text-white">Leader-Follower</h3>
                                            <p className="text-zinc-500 text-sm">Synchronize movements between two robots.</p>
                                        </div>
                                        <div className="@container w-full max-w-4xl space-y-6">
                                            <div className="w-full space-y-6">

                                                {/* SELECTION FLEX LAYOUT */}
                                                <div className="flex flex-row items-center gap-4 w-full">

                                                    {/* INPUTS COLUMN */}
                                                    <div className="flex flex-col gap-3 flex-1 min-w-0">

                                                        {/* LEADER INPUT */}
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <Label className="text-orange-500 font-bold uppercase tracking-wider text-[10px] flex items-center gap-2">
                                                                    <Activity className="w-3 h-3" /> Leader
                                                                </Label>
                                                                <span className="text-[10px] text-zinc-500">Free to move</span>
                                                            </div>
                                                            <Select
                                                                value={leaderRobotId || ""}
                                                                onValueChange={setLeaderRobotId}
                                                                disabled={isLeaderFollowerActive}
                                                            >
                                                                <SelectTrigger className="h-10 text-sm bg-zinc-950 border-zinc-700 focus:ring-orange-500/50 w-full">
                                                                    <span className="truncate">
                                                                        {leaderRobotId ? robots[leaderRobotId]?.name || leaderRobotId : "Select Leader"}
                                                                    </span>
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {Object.values(robots)
                                                                        .filter(r => r.id !== followerRobotId)
                                                                        .map(bot => (
                                                                            <SelectItem key={bot.id} value={bot.id}>
                                                                                {bot.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>

                                                        {/* FOLLOWER INPUT */}
                                                        <div>
                                                            <div className="flex items-center justify-between mb-1.5">
                                                                <Label className="text-orange-500 font-bold uppercase tracking-wider text-[10px] flex items-center gap-2">
                                                                    <Activity className="w-3 h-3" /> Follower
                                                                </Label>
                                                                <span className="text-[10px] text-zinc-500">Rigid mimic</span>
                                                            </div>
                                                            <Select
                                                                value={followerRobotId || ""}
                                                                onValueChange={setFollowerRobotId}
                                                                disabled={isLeaderFollowerActive}
                                                            >
                                                                <SelectTrigger className="h-10 text-sm bg-zinc-950 border-zinc-700 focus:ring-orange-500/50 w-full">
                                                                    <span className="truncate">
                                                                        {followerRobotId ? robots[followerRobotId]?.name || followerRobotId : "Select Follower"}
                                                                    </span>
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {Object.values(robots)
                                                                        .filter(r => r.id !== leaderRobotId)
                                                                        .map(bot => (
                                                                            <SelectItem key={bot.id} value={bot.id}>
                                                                                {bot.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>

                                                    {/* SWAP BUTTON (RIGHT SIDE) */}
                                                    <div className="flex flex-col justify-center items-center shrink-0">
                                                        <Button
                                                            variant="ghost"
                                                            className="h-12 w-12 rounded-full hover:bg-orange-950/30 hover:text-orange-500 border border-zinc-800/50"
                                                            disabled={isLeaderFollowerActive}
                                                            onClick={() => {
                                                                const oldLeader = leaderRobotId;
                                                                const oldFollower = followerRobotId;
                                                                setLeaderRobotId(oldFollower);
                                                                setFollowerRobotId(oldLeader);
                                                            }}
                                                        >
                                                            <ArrowRightLeft className="!w-5 !h-5 text-zinc-400 rotate-90" />
                                                        </Button>
                                                    </div>
                                                </div>

                                                {Object.values(robots).length < 2 && (
                                                    <p className="text-center text-sm text-amber-500 flex items-center justify-center gap-2 bg-amber-500/10 p-2 rounded">
                                                        <AlertTriangle className="w-4 h-4" /> Need at least 2 robots connected.
                                                    </p>
                                                )}

                                                <div className="pt-4 border-t border-zinc-800">
                                                    <Button
                                                        onClick={toggleLeaderFollower}
                                                        disabled={!leaderRobotId || !followerRobotId}
                                                        className={cn(
                                                            "w-full h-14 text-lg font-bold transition-all shadow-lg",
                                                            isLeaderFollowerActive
                                                                ? "bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-red-900/20"
                                                                : "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-orange-900/20"
                                                        )}
                                                    >
                                                        {isLeaderFollowerActive ? (
                                                            <>
                                                                <Unlink className="mr-3 h-5 w-5" /> STOP SYNC
                                                            </>
                                                        ) : (
                                                            <>
                                                                <LinkIcon className="mr-3 h-5 w-5" /> START SYNC
                                                            </>
                                                        )}
                                                    </Button>
                                                    <p className="text-center text-xs text-zinc-500 mt-3">
                                                        {isLeaderFollowerActive
                                                            ? "Leader is compliant. Follower is actively servoing."
                                                            : "Select robots above and start sync."}
                                                    </p>
                                                </div>

                                                {/* STATUS INDICATOR */}
                                                {isLeaderFollowerActive && (
                                                    <div className="bg-orange-950/30 border border-orange-900/50 rounded-lg p-4 text-center animate-in fade-in slide-in-from-bottom-4">
                                                        <p className="text-orange-200 font-mono text-sm flex items-center justify-center gap-2">
                                                            <Activity className="w-4 h-4 animate-pulse" /> Sync Active • Latency: ~20ms
                                                        </p>
                                                    </div>
                                                )}

                                            </div>
                                        </div>
                                    </div>
                                }
                                right={
                                    <div className="h-full flex flex-col p-4 overflow-auto">
                                        <h3 className="font-semibold text-zinc-300 flex items-center gap-2 mb-4">
                                            <Video className="w-4 h-4" /> Camera Feeds
                                        </h3>
                                        <div className="flex-1 min-h-[300px]">
                                            <CameraGrid
                                                cameras={cameras}
                                                onRemove={removeCamera}
                                                onAdd={startAddCamera}
                                            />
                                        </div>
                                    </div>
                                }
                            />
                        ) : (
                            <div className="flex-1 h-full p-4 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-center">
                                <div className="text-center space-y-2 mb-6">
                                    <h3 className="text-xl font-bold text-white">Leader-Follower</h3>
                                    <p className="text-zinc-500 text-sm">Synchronize movements between two robots.</p>
                                </div>
                                <div className="@container w-full max-w-4xl space-y-6">
                                    <div className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-6">

                                        {/* SELECTION FLEX LAYOUT */}
                                        <div className="flex flex-row items-center gap-4 w-full">

                                            {/* INPUTS COLUMN */}
                                            <div className="flex flex-col gap-3 flex-1 min-w-0">

                                                {/* LEADER INPUT */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <Label className="text-orange-500 font-bold uppercase tracking-wider text-[10px] flex items-center gap-2">
                                                            <Activity className="w-3 h-3" /> Leader
                                                        </Label>
                                                        <span className="text-[10px] text-zinc-500">Free to move</span>
                                                    </div>
                                                    <Select
                                                        value={leaderRobotId || ""}
                                                        onValueChange={setLeaderRobotId}
                                                        disabled={isLeaderFollowerActive}
                                                    >
                                                        <SelectTrigger className="h-10 text-sm bg-zinc-950 border-zinc-700 focus:ring-orange-500/50 w-full">
                                                            <span className="truncate">
                                                                {leaderRobotId ? robots[leaderRobotId]?.name || leaderRobotId : "Select Leader"}
                                                            </span>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {Object.values(robots)
                                                                .filter(r => r.id !== followerRobotId)
                                                                .map(bot => (
                                                                    <SelectItem key={bot.id} value={bot.id}>
                                                                        {bot.name}
                                                                    </SelectItem>
                                                                ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                {/* FOLLOWER INPUT */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-1.5">
                                                        <Label className="text-orange-500 font-bold uppercase tracking-wider text-[10px] flex items-center gap-2">
                                                            <Activity className="w-3 h-3" /> Follower
                                                        </Label>
                                                        <span className="text-[10px] text-zinc-500">Rigid mimic</span>
                                                    </div>
                                                    <Select
                                                        value={followerRobotId || ""}
                                                        onValueChange={setFollowerRobotId}
                                                        disabled={isLeaderFollowerActive}
                                                    >
                                                        <SelectTrigger className="h-10 text-sm bg-zinc-950 border-zinc-700 focus:ring-orange-500/50 w-full">
                                                            <span className="truncate">
                                                                {followerRobotId ? robots[followerRobotId]?.name || followerRobotId : "Select Follower"}
                                                            </span>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {Object.values(robots)
                                                                .filter(r => r.id !== leaderRobotId)
                                                                .map(bot => (
                                                                    <SelectItem key={bot.id} value={bot.id}>
                                                                        {bot.name}
                                                                    </SelectItem>
                                                                ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            {/* SWAP BUTTON (RIGHT SIDE) */}
                                            <div className="flex flex-col justify-center items-center shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    className="h-12 w-12 rounded-full hover:bg-orange-950/30 hover:text-orange-500 border border-zinc-800/50"
                                                    disabled={isLeaderFollowerActive}
                                                    onClick={() => {
                                                        const oldLeader = leaderRobotId;
                                                        const oldFollower = followerRobotId;
                                                        setLeaderRobotId(oldFollower);
                                                        setFollowerRobotId(oldLeader);
                                                    }}
                                                >
                                                    <ArrowRightLeft className="!w-5 !h-5 text-zinc-400 rotate-90" />
                                                </Button>
                                            </div>
                                        </div>

                                        {Object.values(robots).length < 2 && (
                                            <p className="text-center text-sm text-amber-500 flex items-center justify-center gap-2 bg-amber-500/10 p-2 rounded">
                                                <AlertTriangle className="w-4 h-4" /> Need at least 2 robots connected.
                                            </p>
                                        )}

                                        <div className="pt-4 border-t border-zinc-800">
                                            <Button
                                                onClick={toggleLeaderFollower}
                                                disabled={!leaderRobotId || !followerRobotId}
                                                className={cn(
                                                    "w-full h-14 text-lg font-bold transition-all shadow-lg",
                                                    isLeaderFollowerActive
                                                        ? "bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-red-900/20"
                                                        : "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-orange-900/20"
                                                )}
                                            >
                                                {isLeaderFollowerActive ? (
                                                    <>
                                                        <Unlink className="mr-3 h-5 w-5" /> STOP SYNC
                                                    </>
                                                ) : (
                                                    <>
                                                        <LinkIcon className="mr-3 h-5 w-5" /> START SYNC
                                                    </>
                                                )}
                                            </Button>
                                            <p className="text-center text-xs text-zinc-500 mt-3">
                                                {isLeaderFollowerActive
                                                    ? "Leader is compliant. Follower is actively servoing."
                                                    : "Select robots above and start sync."}
                                            </p>
                                        </div>

                                        {/* STATUS INDICATOR */}
                                        {isLeaderFollowerActive && (
                                            <div className="bg-orange-950/30 border border-orange-900/50 rounded-lg p-4 text-center animate-in fade-in slide-in-from-bottom-4">
                                                <p className="text-orange-200 font-mono text-sm flex items-center justify-center gap-2">
                                                    <Activity className="w-4 h-4 animate-pulse" /> Sync Active • Latency: ~20ms
                                                </p>
                                            </div>
                                        )}

                                    </div>
                                </div>
                            </div>
                        )}
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
                                        <Button onClick={handleSafeCalibrationStart} variant="outline" disabled={!connected || calibrationState === 'cal'}>Start</Button>
                                        <Button onClick={finishCalibration} disabled={calibrationState !== 'cal'} className="bg-blue-600 hover:bg-blue-700">Finish</Button>
                                    </div>
                                </div>
                            </div>

                            {/* MOTOR CONFIG WIZARD */}
                            <div className="p-6 bg-zinc-900/30 rounded-xl border border-zinc-800">
                                <h3 className="text-lg font-medium mb-4 text-white flex items-center gap-2"><Cpu className="w-5 h-5" /> Motor Setup</h3>
                                <p className="text-sm text-zinc-500 mb-4">
                                    Configure motor IDs and assign joints for a new robot build.
                                </p>
                                <Button onClick={() => setShowWizard(true)} variant="secondary" className="w-full">
                                    <Settings className="mr-2 h-4 w-4" /> Open Configuration Wizard
                                </Button>
                            </div>

                            <div className="p-6 bg-zinc-900/30 rounded-xl border border-zinc-800">
                                <h3 className="text-lg font-medium mb-4 text-white flex items-center gap-2"><Cpu className="w-5 h-5" /> Diagnostics</h3>
                                {activeRobotId && (
                                    <Button onClick={() => disconnectRobot(activeRobotId)} variant="destructive" className="w-full justify-start mb-2">
                                        <Unlink className="mr-2 h-4 w-4" /> Disconnect {robots[activeRobotId]?.name}
                                    </Button>
                                )}

                                {cameras.length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-zinc-800">
                                        <h4 className="text-sm font-medium text-zinc-400 mb-2">Connected Cameras</h4>
                                        <div className="space-y-2">
                                            {cameras.map(cam => (
                                                <Button
                                                    key={cam.id}
                                                    onClick={() => removeCamera(cam.id)}
                                                    variant="destructive"
                                                    className="w-full justify-start mb-2"
                                                >
                                                    <Unlink className="mr-2 h-4 w-4" /> Disconnect {cam.label || 'Camera'}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-6 bg-zinc-900/30 rounded-xl border border-zinc-800">
                                <h3 className="text-sm font-mono text-zinc-500 mb-2">SYSTEM LOGS</h3>
                                <div className="bg-black/50 p-4 rounded-lg h-40 overflow-y-auto text-xs font-mono text-green-400/80">
                                    {logs.map((l, i) => <div key={i}>&gt; {l}</div>)}
                                </div>
                            </div>
                        </div>

                    </TabsContent>


                </div>
            </Tabs >

            {/* Persistent Recording Footer */}
            < div className="mt-4 p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl flex items-center justify-between" >
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
            </div >
        </div >
    );
}

function CameraFeed({ cam, onRemove }: { cam: { id: string, label?: string, stream: MediaStream }, onRemove: (id: string) => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        const video = videoRef.current;
        if (video && cam.stream) {
            video.srcObject = cam.stream;
            video.play().catch(e => {
                if (e.name !== 'AbortError') console.error("Video play failed:", e);
            });
        }
    }, [cam.stream]);

    return (
        <div className="relative group rounded-lg overflow-hidden border border-zinc-800 bg-black w-full max-w-full" style={{ aspectRatio: '16/9' }}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
            />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                    onClick={() => onRemove(cam.id)}
                    variant="destructive"
                    size="icon"
                    className="h-7 w-7 rounded-full shadow-lg"
                >
                    <Unlink className="h-3.5 w-3.5" />
                </Button>
            </div>
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded text-[10px] font-mono text-zinc-400 max-w-[90%] truncate">
                {cam.label || `CAM ${cam.id.slice(0, 4)}`}
            </div>
        </div>
    );
}
