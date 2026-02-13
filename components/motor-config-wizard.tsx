"use client";

import { useState } from "react";
import { useRobot } from "@/components/robot-context";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Check, RefreshCw, Cpu, CheckCircle2, AlertTriangle, XCircle, HelpCircle,
    Play, Pause, PauseCircle, ChevronLeft, RotateCcw, Loader2,
    Settings, Wrench, PlusCircle
} from "lucide-react";
import { Input } from "./ui/input";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { RobotArmVisualizer } from "./robot-arm-visualizer";

// Joint definitions with visual descriptions
const JOINT_NAMES = [
    { id: 1, name: 'shoulder_pan', label: 'Joint 1 (Shoulder Pan)', desc: 'Rotates the base left/right (Horizontal Axis)' },
    { id: 2, name: 'shoulder_lift', label: 'Joint 2 (Shoulder Lift)', desc: 'Lifts the main arm up/down (Vertical Axis)' },
    { id: 3, name: 'elbow_flex', label: 'Joint 3 (Elbow Flex)', desc: 'Bends the elbow (Vertical Axis)' },
    { id: 4, name: 'wrist_flex', label: 'Joint 4 (Wrist Flex)', desc: 'Bends the wrist up/down' },
    { id: 5, name: 'wrist_roll', label: 'Joint 5 (Wrist Roll)', desc: 'Rotates the gripper (Roll Axis)' },
    { id: 6, name: 'gripper', label: 'Joint 6 (Gripper)', desc: 'Opens/Closes the gripper' },
];

const TEMP_ID_OFFSET = 10; // Temp IDs will be 11-16

type WizardMode = 'select' | 'new_setup' | 'maintenance' | 'duplicate_resolver';

export function MotorConfigWizard({ onClose }: { onClose: () => void }) {
    const { activeRobotId, scanMotors, configureMotorId, setMotorIsolation } = useRobot();
    const [mode, setMode] = useState<WizardMode>('select');

    // Common State
    const [scannedIds, setScannedIds] = useState<number[]>([]);
    const [statusMsg, setStatusMsg] = useState("");
    const [isScanning, setIsScanning] = useState(false);
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [isolatedId, setIsolatedId] = useState<number | null>(null);

    // New Setup State
    const [selectedId, setSelectedId] = useState<string>("");
    const [targetJoint, setTargetJoint] = useState<string>("");
    const [configuredJoints, setConfiguredJoints] = useState<number[]>([]);

    // Maintenance State
    const [reconfigId, setReconfigId] = useState<string>(""); // ID being modified
    const [newIdVal, setNewIdVal] = useState<string>("");

    if (!activeRobotId) return null;

    // --- SHARED HELPERS ---
    const handleScan = async () => {
        setIsScanning(true);
        setStatusMsg("Scanning bus...");
        setScannedIds([]);
        try {
            const ids = await scanMotors(activeRobotId);
            setScannedIds(ids);
            setStatusMsg(`Found ${ids.length} motors: ${ids.join(", ")}`);
        } catch (e) {
            setStatusMsg("Scan failed.");
            setScannedIds([]);
        } finally {
            setIsScanning(false);
        }
    };

    const handleToggleIsolation = async (id: number) => {
        if (isolatedId === id) {
            // TURN OFF
            setStatusMsg(`Stopping Isolation...`);
            await setMotorIsolation(activeRobotId, null, scannedIds);
            setIsolatedId(null);
            setStatusMsg(`Isolation Stopped. All motors loose.`);
        } else {
            // TURN ON
            setIsolatedId(id); // Set state immediately for responsiveness
            setStatusMsg(`Isolating Motor ${id}... (Others Locking)`);
            await setMotorIsolation(activeRobotId, id, scannedIds);
            setStatusMsg(`Motor ${id} is FREE. All others are LOCKED.`);
        }
    };

    // --- NEW SETUP LOGIC ---
    const handleAssign = async () => {
        if (!selectedId || !targetJoint) return;
        const currentId = parseInt(selectedId);
        const jointIdx = parseInt(targetJoint); // 1-6
        const tempId = jointIdx + TEMP_ID_OFFSET; // 11-16

        setIsConfiguring(true);
        setStatusMsg(`Assigning ID ${currentId} to TEMP ID ${tempId} (${JOINT_NAMES[jointIdx - 1].name})...`);

        try {
            const success = await configureMotorId(activeRobotId, currentId, tempId);
            if (success) {
                setStatusMsg(`Success! Re-scanning...`);
                setConfiguredJoints(prev => [...prev, jointIdx]);
                setSelectedId("");
                setTargetJoint("");
                await handleScan(); // Refresh list
            } else {
                setStatusMsg("Failed to configure ID.");
            }
        } catch (e) {
            setStatusMsg("Error during configuration.");
        } finally {
            setIsConfiguring(false);
        }
    };

    const handleFinalize = async () => {
        setIsConfiguring(true);
        setStatusMsg("Finalizing configuration (Restoring IDs 1-6)...");
        try {
            const ids = await scanMotors(activeRobotId);
            let count = 0;
            for (const id of ids) {
                if (id > TEMP_ID_OFFSET && id <= TEMP_ID_OFFSET + 6) {
                    const finalId = id - TEMP_ID_OFFSET;
                    await configureMotorId(activeRobotId, id, finalId);
                    count++;
                }
            }
            setStatusMsg(`Finalized ${count} motors. Configuration Complete!`);
            setTimeout(onClose, 2000);
        } catch (e) {
            setStatusMsg("Finalization failed.");
        } finally {
            setIsConfiguring(false);
        }
    };

    // --- MAINTENANCE LOGIC ---
    const handleChangeId = async (currentId: number, targetId: number) => {
        setIsConfiguring(true);
        setStatusMsg(`Changing ID ${currentId} to ${targetId}...`);
        try {
            const success = await configureMotorId(activeRobotId, currentId, targetId);
            if (success) {
                setStatusMsg("Success! Re-scanning...");
                setReconfigId("");
                setNewIdVal("");
                await handleScan();
            } else {
                setStatusMsg("Failed to change ID.");
            }
        } catch (e) {
            setStatusMsg("Error changing ID.");
        } finally {
            setIsConfiguring(false);
        }
    };

    return (
        <Card className="w-full max-w-3xl mx-auto bg-zinc-950 border-zinc-800 shadow-2xl">
            <CardHeader className="border-b border-zinc-800/50 pb-4">
                <CardTitle className="flex items-center justify-between text-white">
                    <div className="flex items-center gap-2">
                        <Settings className="w-6 h-6 text-primary" />
                        Motor Configuration Wizard
                    </div>
                    {mode !== 'select' ? (
                        <Button variant="ghost" size="sm" onClick={() => setMode('select')}>
                            <RotateCcw className="mr-2 h-3 w-3" /> Back to Menu
                        </Button>
                    ) : (
                        <Button variant="ghost" size="sm" onClick={onClose}>
                            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Calibration
                        </Button>
                    )}
                </CardTitle>
                <CardDescription>
                    Safely assign IDs to your daisy-chained motors.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-6 min-h-[400px]">

                {/* --- MODE SELECTION --- */}
                {mode === 'select' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full items-center">
                        <button
                            onClick={() => setMode('new_setup')}
                            className="bg-primary/5 hover:bg-primary/10 border border-primary/20 hover:border-primary/50 text-left p-6 rounded-xl transition-all group h-full flex flex-col items-center text-center justify-center gap-4"
                        >
                            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <PlusCircle className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">New Robot Setup</h3>
                                <p className="text-zinc-400 text-sm">
                                    I am building a new robot.<br />
                                    Connect motors <b>one by one</b> to assign IDs safely.
                                </p>
                            </div>
                        </button>

                        <button
                            onClick={() => setMode('maintenance')}
                            className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-left p-6 rounded-xl transition-all group h-full flex flex-col items-center text-center justify-center gap-4"
                        >
                            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Wrench className="w-8 h-8 text-zinc-400 group-hover:text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">Maintenance Mode</h3>
                                <p className="text-zinc-400 text-sm">
                                    My robot is already assembled.<br />
                                    Fix ID collisions or swap motors.
                                </p>
                            </div>
                        </button>
                    </div>
                )}

                {/* --- NEW SETUP MODE (Daisy Chain) --- */}
                {mode === 'new_setup' && (
                    <div className="space-y-4">
                        <div className="bg-blue-900/20 border border-blue-800 text-blue-200 p-4 rounded-lg flex gap-3">
                            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                            <div>
                                <h5 className="font-medium mb-1">Daisy Chain Strategy</h5>
                                <p className="text-sm opacity-90">
                                    To avoid ID conflicts, connect one motor at a time. We will assign a temporary ID to each motor before finalizing.
                                </p>
                            </div>
                        </div>

                        {/* Status Bar */}
                        <div className="bg-zinc-900/50 p-3 rounded-md border border-zinc-800 text-sm font-mono text-zinc-300 min-h-[48px] flex items-center justify-between">
                            <span>{statusMsg || "Ready to start."}</span>
                            <Button onClick={handleScan} disabled={isScanning} size="sm" variant="secondary">
                                <RefreshCw className={`mr-2 h-3 w-3 ${isScanning ? 'animate-spin' : ''}`} /> Scan
                            </Button>
                        </div>

                        {/* Scan & Assign UI */}
                        {scannedIds.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-zinc-800 pt-4">
                                <div className="space-y-2">
                                    <label className="text-xs text-zinc-500 uppercase font-bold">1. Select Detected ID</label>
                                    <Select value={selectedId} onValueChange={(val) => val && setSelectedId(val)}>
                                        <SelectTrigger><SelectValue placeholder="Select ID" /></SelectTrigger>
                                        <SelectContent>
                                            {scannedIds.map(id => (
                                                <SelectItem key={id} value={id.toString()}>ID {id} {id > 10 ? '(Temp)' : ''}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedId && (
                                        <Button
                                            onClick={() => handleToggleIsolation(parseInt(selectedId))}
                                            variant="secondary"
                                            size="sm"
                                            className={cn("w-full transition-colors", isolatedId === parseInt(selectedId) && "bg-amber-600 hover:bg-amber-700 text-white")}
                                            disabled={isolatedId !== null && isolatedId !== parseInt(selectedId)}
                                        >
                                            {isolatedId === parseInt(selectedId) ? <PauseCircle className="mr-2 h-3 w-3 animate-pulse" /> : <Play className="mr-2 h-3 w-3" />}
                                            {isolatedId === parseInt(selectedId) ? "Release (Stop Isolation)" : "Isolate (Identify)"}
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs text-zinc-500 uppercase font-bold">2. Assign Role</label>
                                    <Select value={targetJoint} onValueChange={(val) => val && setTargetJoint(val)}>
                                        <SelectTrigger><SelectValue placeholder="Select Joint" /></SelectTrigger>
                                        <SelectContent>
                                            {JOINT_NAMES.map(j => (
                                                <SelectItem key={j.id} value={j.id.toString()} disabled={configuredJoints.includes(j.id)}>
                                                    <div className="flex flex-col text-left">
                                                        <span className="font-semibold">{j.label}</span>
                                                        <span className="text-xs text-zinc-400">{j.desc}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button onClick={handleAssign} disabled={!selectedId || !targetJoint || isConfiguring} className="w-full">
                                        Assign & Next
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* Configuration Progress Logic */}
                        <div className="border-t border-zinc-800 pt-4">
                            <h4 className="text-sm font-medium text-zinc-400 mb-2">Configuration Progress</h4>
                            <div className="grid grid-cols-3 gap-2">
                                {JOINT_NAMES.map(j => (
                                    <div key={j.id} className={`text-xs p-2 rounded border ${configuredJoints.includes(j.id) ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-zinc-900/50 border-zinc-800 text-zinc-600'}`}>
                                        <div className="font-bold">{j.name}</div>
                                        <div>J{j.id}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button onClick={handleFinalize} disabled={configuredJoints.length === 0 || isConfiguring} className="bg-green-600 hover:bg-green-700 text-white">
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Finalize & Save
                            </Button>
                        </div>
                    </div>
                )}

                {/* --- MAINTENANCE MODE --- */}
                {mode === 'maintenance' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-center bg-zinc-900 p-4 rounded-lg flex-wrap gap-4">
                            <div className="flex gap-4 items-center flex-grow">
                                <Button onClick={handleScan} disabled={isScanning} >
                                    <RefreshCw className={`mr-2 h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
                                    Scan Bus
                                </Button>
                                <span className="text-zinc-500 text-sm font-mono">
                                    {statusMsg || `Found ${scannedIds.length} IDs`}
                                </span>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setMode('duplicate_resolver')}>
                                <AlertTriangle className="mr-2 h-4 w-4 text-orange-500" /> Troubleshoot Duplicates
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                            {/* Left Column: Visualizer */}
                            <div className="flex flex-col gap-2 sticky top-0">
                                <RobotArmVisualizer highlightedId={isolatedId || (reconfigId ? parseInt(reconfigId) : null)} />
                                <p className="text-xs text-zinc-500 text-center italic">
                                    Hover over joints for details. Highlighted motor is active.
                                </p>
                            </div>

                            {/* Right Column: List */}
                            <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto content-start pr-1">
                                <div className="p-3 bg-blue-900/10 border border-blue-900/30 rounded-lg text-sm text-blue-200 mb-2">
                                    <span className="font-bold">Isolation Mode:</span> Click "Isolate" to loosen ONE motor and lock all others. This helps you identify which motor is which by feeling it.
                                </div>
                                {scannedIds.map(id => {
                                    const joint = JOINT_NAMES.find(j => j.id === id);
                                    const isReconfiguring = reconfigId === id.toString();

                                    return (
                                        <div key={id}
                                            className={cn(
                                                "flex items-center justify-between p-3 border rounded-lg transition-colors",
                                                isolatedId === id ? "bg-amber-900/20 border-amber-500/50" : "bg-zinc-900/50 border-zinc-800"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-full flex items-center justify-center font-bold text-white transition-colors flex-shrink-0",
                                                    isolatedId === id ? "bg-amber-600 text-black" : "bg-zinc-800"
                                                )}>
                                                    {id}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm font-medium text-white truncate">{joint ? joint.name : "Unknown"}</div>
                                                        {joint && (
                                                            <TooltipProvider delayDuration={0}>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <button className="p-1.5 hover:bg-zinc-800 rounded-full transition-colors focus:outline-none">
                                                                            <HelpCircle className="w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors" />
                                                                        </button>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent side="right" className="bg-zinc-800 border-zinc-700 text-zinc-200">
                                                                        <p>{joint.desc}</p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-zinc-500 truncate">{joint ? joint.label : "Unassigned"}</div>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {isReconfiguring ? (
                                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                                        <Input
                                                            className="w-16 h-8 text-xs bg-zinc-950 border-zinc-700"
                                                            placeholder="#"
                                                            type="number"
                                                            value={newIdVal}
                                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewIdVal(e.target.value)}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            className="h-8 px-2"
                                                            onClick={() => handleChangeId(id, parseInt(newIdVal))}
                                                            disabled={!newIdVal}
                                                        >
                                                            Save
                                                        </Button>
                                                        <Button
                                                            size="sm" variant="ghost" className="h-8 w-8 p-0"
                                                            onClick={() => setReconfigId("")}
                                                        >
                                                            X
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            variant="secondary"
                                                            className={cn("h-8 px-2 transition-colors", isolatedId === id && "bg-amber-600 hover:bg-amber-700 text-white")}
                                                            onClick={() => handleToggleIsolation(id)}
                                                            disabled={isolatedId !== null && isolatedId !== id}
                                                        >
                                                            {isolatedId === id ? <PauseCircle className=" h-3 w-3 animate-pulse" /> : <Play className="h-3 w-3" />}
                                                            {isolatedId === id ? " Release" : " Isolate"}
                                                        </Button>
                                                        <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setReconfigId(id.toString())}>
                                                            Edit
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                {scannedIds.length === 0 && !isScanning && (
                                    <div className="text-center py-10 text-zinc-500 col-span-full">
                                        No motors found. Check connections and power.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* --- DUPLICATE RESOLVER MODE --- */}
                {mode === 'duplicate_resolver' && (
                    <div className="space-y-6">
                        <div className="bg-orange-900/20 border border-orange-800 p-4 rounded-lg">
                            <h3 className="text-orange-200 font-bold flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" /> Duplicate ID Resolver
                            </h3>
                            <p className="text-orange-200/80 text-sm mt-2">
                                If multiple motors share the same ID, they will conflict on the bus.
                                to fix this, you must <b>isolate the motor</b> you want to change.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800">
                                <h4 className="font-bold text-white mb-2">Instructions:</h4>
                                <ol className="list-decimal list-inside text-zinc-400 space-y-2 text-sm">
                                    <li>Power off the robot.</li>
                                    <li><b>Disconnect</b> all motors except the one with the duplicate ID you want to change.</li>
                                    <li>Power the robot back on (with only 1 motor connected).</li>
                                    <li>Click <b>Scan Isolated Motor</b> below.</li>
                                </ol>
                            </div>

                            <div className="flex flex-col gap-4 items-center py-4">
                                <Button onClick={handleScan} disabled={isScanning} size="lg" className="w-full max-w-sm">
                                    <RefreshCw className={`mr-2 h-4 w-4 ${isScanning ? 'animate-spin' : ''}`} />
                                    Scan Isolated Motor
                                </Button>

                                {scannedIds.length > 0 && (
                                    <div className="w-full max-w-sm space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="text-center text-green-400 font-medium">
                                            Found Motor ID: {scannedIds[0]}
                                        </div>
                                        <div className="flex gap-2">
                                            <Input
                                                placeholder="New ID (e.g. 2)"
                                                value={newIdVal}
                                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewIdVal(e.target.value)}
                                                type="number"
                                            />
                                            <Button onClick={() => handleChangeId(scannedIds[0], parseInt(newIdVal))}>
                                                Change ID
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

            </CardContent>
        </Card>
    );
}
