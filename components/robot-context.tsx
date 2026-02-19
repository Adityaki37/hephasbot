"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { RobotDriver } from '@/lib/web-serial-driver';
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUser } from "@/components/user-session";

type CalibrationState = 'unc' | 'cal' | 'finishing' | 'rdy';

interface CalibrationLimit {
    min: number;
    max: number;
}

// Data for a single robot instance
export interface RobotInstance {
    id: string;
    name: string;
    driver: RobotDriver;
    connected: boolean;
    calibrationState: CalibrationState;
    jointVals: number[];
    calibrationLimits: CalibrationLimit[];
    freeMode: boolean;
    // Navigation Flags
    profileSelectionNeeded: boolean;
    savePromptNeeded: boolean;
}

interface RobotContextType {
    robots: Record<string, RobotInstance>;
    activeRobotId: string | null;
    syncControl: boolean;
    logs: string[];
    error: string | null;
    dismissError: () => void;
    addRobot: () => Promise<void>;
    setActiveRobot: (id: string) => void;
    setSyncControl: (enabled: boolean) => void;
    disconnectRobot: (id: string) => Promise<void>;

    // Proxies
    connect: () => Promise<void>;
    moveJoint: (jointIndex: number, angle: number) => Promise<void>;
    moveJointRel: (jointIndex: number, delta: number) => Promise<void>;
    startManualMove: (jointIndex: number, direction: number) => void;
    stopManualMove: () => void;
    startCalibration: () => void;
    finishCalibration: () => Promise<void>;
    setFreeMode: (enabled: boolean) => Promise<void>;

    isRecording: boolean;
    isPlaying: boolean;
    recordedTraj: number[][];
    toggleRecording: () => void;
    playRecording: () => Promise<void>;

    speedMultiplier: number;
    setSpeedMultiplier: (speed: number) => void;

    // Config
    scanMotors: (botId: string) => Promise<number[]>;
    configureMotorId: (botId: string, currentId: number, newId: number) => Promise<boolean>;
    setMotorIsolation: (botId: string, targetId: number | null, allIds: number[]) => Promise<void>;

    // Leader-Follower
    leaderRobotId: string | null;
    setLeaderRobotId: (id: string | null) => void;
    followerRobotId: string | null;
    setFollowerRobotId: (id: string | null) => void;
    isLeaderFollowerActive: boolean;
    toggleLeaderFollower: () => Promise<void>;
    updateRobotName: (id: string, name: string) => void;

    item: string;
    activeRobot: RobotInstance | null;

    // Profile Helpers
    userProfiles: any[];
    confirmProfileSelection: (botId: string, profile?: any) => Promise<void>;
    saveMakeProfile: (botId: string, name: string) => Promise<void>;
    deleteRobotProfile: (profileId: string, profileName: string) => Promise<void>;
    redoCalibration: (botId: string) => Promise<void>;
    simulateRobotConnection: () => Promise<void>;
}

export const RobotContext = createContext<RobotContextType | null>(null);

export function RobotProvider({ children }: { children: React.ReactNode }) {
    const [robots, setRobots] = useState<Record<string, RobotInstance>>({});
    const [activeRobotId, setActiveRobotId] = useState<string | null>(null);
    const [syncControl, setSyncControl] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);

    // Leader-Follower State
    const [leaderRobotId, setLeaderRobotId] = useState<string | null>(null);
    const [followerRobotId, setFollowerRobotId] = useState<string | null>(null);
    const [isLeaderFollowerActive, setIsLeaderFollowerActive] = useState(false);

    // Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [recordedTraj, setRecordedTraj] = useState<number[][]>([]);

    // Speed Control
    const [speedMultiplier, setSpeedMultiplier] = useState(1.0);

    // Global Error State
    const [error, setError] = useState<string | null>(null);

    // User Session
    const { user } = useUser();
    const userId = user?.id;
    const userProfiles = useQuery(api.robots.listProfiles, userId ? { userId } : "skip");
    const saveCalibrationMutation = useMutation(api.robots.saveCalibration);
    const deleteProfileMutation = useMutation(api.robots.deleteProfile);

    const addLog = (msg: string) => setLogs(prev => [...prev.slice(-49), msg]);

    // Helpers need to be defined before usage
    const applyToTargets = async (fn: (bot: RobotInstance) => Promise<void>) => {
        if (syncControl) {
            await Promise.all(Object.values(robots).map(bot => fn(bot)));
        } else if (activeRobotId && robots[activeRobotId]) {
            await fn(robots[activeRobotId]);
        }
    };

    // Helper for torque
    const setAllTorque = async (bot: RobotInstance, enabled: boolean) => {
        try {
            await bot.driver.setTorqueSync([1, 2, 3, 4, 5, 6], enabled);
        } catch (e) { console.error(e); }
    };


    // Effect: Disconnect all robots on user change (Login/Logout) to prevent state pollution
    useEffect(() => {
        const currentRobots = robotsRef.current;
        const connectedIds = Object.keys(currentRobots).filter(id => currentRobots[id].connected);

        if (connectedIds.length > 0) {
            console.log("[RobotContext] User session changed. Disconnecting all robots...");
            addLog("Session changed. Disconnecting all robots...");

            // Disconnect all
            connectedIds.forEach(async (id) => {
                const bot = currentRobots[id];
                try {
                    await setAllTorque(bot, false); // Safety first
                    await bot.driver.disconnect();
                } catch (e) {
                    console.error(`Failed to clean disconnect ${bot.name}:`, e);
                }
            });

            // Wipe state
            setRobots({});
            setActiveRobotId(null);
            setLeaderRobotId(null);
            setFollowerRobotId(null);
            setIsLeaderFollowerActive(false);
        }
    }, [userId]);

    const addRobot = async () => {
        const newDriver = new RobotDriver();
        try {
            // Connect now throws error on failure (e.g. port already open)
            await newDriver.connect();

            // Connection Successful
            const id = crypto.randomUUID();
            const num = Object.keys(robots).length + 1;
            const shouldSelectProfile = !!userId;

            // Read initial positions
            const initialJointVals = [0, 0, 0, 0, 0, 0];
            try {
                for (let i = 0; i < 6; i++) {
                    let pos = await newDriver.readPosition(i + 1);
                    if (!isNaN(pos) && pos !== -1) {
                        pos = pos % 4096; // Normalize to single turn
                        initialJointVals[i] = ((pos / 4095) * 200) - 100;
                    }
                }
            } catch (e) {
                console.error("Failed to read initial positions", e);
            }

            const newBot: RobotInstance = {
                id,
                name: `Robot ${num}`,
                driver: newDriver,
                connected: true,
                calibrationState: 'unc',
                jointVals: initialJointVals,
                calibrationLimits: Array(6).fill(null).map(() => ({ min: 0, max: 4095 })),
                freeMode: false,
                profileSelectionNeeded: shouldSelectProfile,
                savePromptNeeded: false
            };

            setRobots(prev => ({ ...prev, [id]: newBot }));
            setActiveRobotId(id);
            addLog(`Connected to ${newBot.name}`);
            await newDriver.setTorqueSync([1, 2, 3, 4, 5, 6], false);

        } catch (e: any) {
            // 1. User Cancelled
            if (e.name === 'NotFoundError') {
                return;
            }

            // 2. Port Connection Error
            let errorMessage = `Connection error: ${e}`;
            if (e && (e.name === 'InvalidStateError' || (e.message && e.message.includes("port is already open")))) {
                errorMessage = "This robot is connected in another tab or the port is busy.";
                console.warn("Port already open:", e);
            } else {
                console.error(e);
            }

            addLog(errorMessage);
            setError(errorMessage);
        }
    };

    const simulateRobotConnection = async () => {
        const id = crypto.randomUUID();
        const num = Object.keys(robots).length + 1;
        const newBot: RobotInstance = {
            id,
            name: `Simulated Robot ${num}`,
            driver: new RobotDriver(), // Mock driver effectively
            connected: true,
            calibrationState: 'unc',
            jointVals: [0, 0, 0, 0, 0, 0],
            calibrationLimits: Array(6).fill(null).map(() => ({ min: 0, max: 4095 })),
            freeMode: false,
            profileSelectionNeeded: true,
            savePromptNeeded: false
        };
        setRobots(prev => ({ ...prev, [id]: newBot }));
        setActiveRobotId(id);
        addLog(`Simulated connection to ${newBot.name}`);
    };

    const confirmProfileSelection = async (botId: string, profile?: any) => {
        console.log(`[RobotContext] Confirming profile selection for ${botId}`, profile);

        // 1. Update UI State
        setRobots(prev => {
            const next = { ...prev };
            const bot = { ...next[botId] };
            if (!bot) {
                console.warn(`[RobotContext] Robot ${botId} not found during profile selection`);
                return prev;
            }

            if (profile) {
                bot.name = profile.name;
                bot.calibrationLimits = profile.calibrationLimits;
                bot.calibrationState = 'rdy';
                addLog(`Loaded profile: ${profile.name}`);
            } else {
                // New Robot
                addLog(`Configuring as New Robot`);
            }
            bot.profileSelectionNeeded = false;
            console.log(`[RobotContext] Updated robot state:`, bot);
            next[botId] = bot;
            return next;
        });

        // 2. Hardware Sync (if profile loaded)
        if (profile) {
            // Use ref to ensure we get the driver even if closure is stale (though driver shouldn't change)
            const bot = robotsRef.current[botId];
            if (bot && bot.connected) {
                addLog(`[${bot.name}] Writing profile limits to hardware...`);
                const limits = profile.calibrationLimits;

                // Apply to all 6 joints
                for (let i = 0; i < 6; i++) {
                    const servoId = i + 1;
                    const limit = limits[i];
                    if (limit) {
                        try {
                            // Min/Max are usually correct in profile (min < max), but driver expects min/max
                            // Logic: Unlock -> Write -> Lock
                            await bot.driver.unlockEEPROM(servoId);
                            await bot.driver.setPositionLimits(servoId, limit.min, limit.max);
                            await bot.driver.lockEEPROM(servoId);
                        } catch (e) {
                            console.error(`Failed to write limits for servo ${servoId}`, e);
                        }
                        // Small delay to prevent bus saturation
                        await new Promise(r => setTimeout(r, 20));
                    }
                }
                addLog(`[${bot.name}] Hardware limits updated.`);

                // Re-engage torque for readiness
                await setAllTorque(bot, true);
            }
        }
    };

    const saveMakeProfile = async (botId: string, name: string) => {
        // CRITICAL: Get latest robot state to ensure we save actual limits
        setRobots(prev => {
            const bot = prev[botId];
            if (!bot) return prev; // Should not happen

            // Optimistic update for name
            const updatedBot = { ...bot, name, savePromptNeeded: false };

            // Perform async save side-effect here to capture LATEST limits
            if (userId) {
                saveCalibrationMutation({
                    userId,
                    name,
                    calibrationLimits: updatedBot.calibrationLimits
                }).then(() => {
                    addLog(`Saved profile: ${name}`);
                }).catch(e => {
                    console.error("Cloud Save Failed", e);
                    addLog(`Error saving profile: ${e}`);
                });
            }

            return { ...prev, [botId]: updatedBot };
        });
    };

    const deleteRobotProfile = async (profileId: string, profileName: string) => {
        if (!userId) return;
        try {
            await deleteProfileMutation({ userId, name: profileName });
            addLog(`Deleted profile: ${profileName}`);
        } catch (e) {
            addLog(`Error deleting profile: ${e}`);
        }
    };

    const redoCalibration = async (botId: string) => {
        setRobots(prev => {
            const bot = prev[botId];
            if (!bot) return prev;
            return {
                ...prev,
                [botId]: {
                    ...bot,
                    calibrationState: 'unc',
                    // Reset to defaults for re-calibration? Or keep existing?
                    // User probably wants to start fresh or refine.
                    // Let's reset to full range to allow movement during cal.
                    calibrationLimits: Array(6).fill(null).map(() => ({ min: 0, max: 4095 })),
                    savePromptNeeded: false
                }
            };
        });
        // Optionally auto-start calibration?
        // Let's just reset state and let user click "Start Calibration" in wizard (which will open)
        // Actually, we need to trigger the wizard or the "Start" flow.
        // The wizard opens if calState is 'unc' or 'cal' usually.
        // We'll let the UI handle the "Show Wizard" part based on state.
        if (activeRobotId === botId) {
            startCalibration(); // Auto-start the process logic
        }
    };

    const disconnectRobot = async (id: string) => {
        const bot = robots[id];
        if (bot) {
            // Safety: Disable torque before disconnecting
            try {
                await setAllTorque(bot, false);
            } catch (e) {
                console.warn(`Failed to disable torque before disconnect for ${bot.name}`, e);
            }

            await bot.driver.disconnect();
            setRobots(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            if (activeRobotId === id) {
                setActiveRobotId(null);
            }
            addLog(`Disconnected from ${bot.name}`);
        }
    };

    // Safety: Ensure torque is disabled on page unload/refresh
    useEffect(() => {
        const handleUnload = () => {
            const currentRobots = robotsRef.current;
            Object.values(currentRobots).forEach(bot => {
                if (bot.connected) {
                    // Best effort to disable torque. 
                    // sendBeacon or similar would be better but WebSerial requires active context.
                    // We just fire and hope the browser allows the serial write before killing the thread.
                    // setTorqueSync is synchronous-ish at the driver level for writes if possible.
                    bot.driver.setTorqueSync([1, 2, 3, 4, 5, 6], false).catch(e => console.error(e));
                }
            });
        };
        window.addEventListener('beforeunload', handleUnload);
        return () => window.removeEventListener('beforeunload', handleUnload);
    }, []);

    // --- MOVEMENT ---
    const moveJoint = async (jointIndex: number, angle: number) => {
        await applyToTargets(async (bot) => {
            // angle is -100 to 100
            const limit = bot.calibrationLimits[jointIndex];
            const range = limit.max - limit.min;
            const normalized = (angle + 100) / 200;
            const targetPos = Math.floor(limit.min + (normalized * range));
            const safePos = Math.max(0, Math.min(4095, Math.max(limit.min, Math.min(limit.max, targetPos))));

            await bot.driver.setPosition(jointIndex + 1, safePos);

            // Optimistic update
            setRobots(prev => {
                const next = { ...prev };
                if (next[bot.id]) {
                    const newVals = [...next[bot.id].jointVals];
                    newVals[jointIndex] = angle;
                    next[bot.id] = { ...next[bot.id], jointVals: newVals };
                }
                return next;
            });
        });
    };

    const moveJointRel = async (jointIndex: number, delta: number) => {
        if (activeRobotId && robots[activeRobotId]) {
            const bot = robots[activeRobotId];
            const currentVal = bot.jointVals[jointIndex];
            const newVal = Math.max(-100, Math.min(100, currentVal + delta));
            moveJoint(jointIndex, newVal);
        }
    };

    // --- MANUAL MOVEMENT LOOP ---
    const manualMoveRef = useRef<{ joint: number, dir: number } | null>(null);

    const startManualMove = (jointIndex: number, direction: number) => {
        manualMoveRef.current = { joint: jointIndex, dir: direction };
    };

    const stopManualMove = () => {
        manualMoveRef.current = null;
    };

    // Continuous Movement Loop
    useEffect(() => {
        const interval = setInterval(() => {
            const currentMove = manualMoveRef.current;
            if (!currentMove || !activeRobotId) return;

            // Targets: Either all (Sync) or specific active
            const targets: RobotInstance[] = [];
            const currentRobots = robotsRef.current; // access fresh state via ref

            if (syncControl) {
                Object.values(currentRobots).forEach(b => {
                    if (b.connected) targets.push(b);
                });
            } else {
                const bot = currentRobots[activeRobotId];
                if (bot && bot.connected) targets.push(bot);
            }

            if (targets.length === 0) return;

            const { joint, dir } = currentMove;

            targets.forEach(bot => {
                const currentVal = bot.jointVals[joint];
                const delta = dir * speedMultiplier * 2.0;
                const newVal = Math.max(-100, Math.min(100, currentVal + delta));

                if (newVal !== currentVal) {
                    const limit = bot.calibrationLimits[joint];
                    const range = limit.max - limit.min;
                    const normalized = (newVal + 100) / 200;
                    const targetPos = Math.floor(limit.min + (normalized * range));
                    const safePos = Math.max(0, Math.min(4095, Math.max(limit.min, Math.min(limit.max, targetPos))));

                    // Hardware Move
                    bot.driver.setPosition(joint + 1, safePos).catch(e => { });

                    // Optimistic State Update
                    setRobots(prev => {
                        const next = { ...prev };
                        if (next[bot.id]) {
                            const newVals = [...next[bot.id].jointVals];
                            newVals[joint] = newVal;
                            next[bot.id] = { ...next[bot.id], jointVals: newVals };
                        }
                        return next;
                    });
                }
            });
        }, 50);

        return () => clearInterval(interval);
    }, [activeRobotId, speedMultiplier, syncControl]);

    // Keep a ref to latest robots state so the polling interval can read it
    // without being a dependency (which would cause infinite re-creation).
    const robotsRef = useRef(robots);
    useEffect(() => { robotsRef.current = robots; }, [robots]);

    // Polling Loop for Joint Values (single stable loop, runs once on mount)
    useEffect(() => {
        const intervalId = setInterval(async () => {
            const currentRobots = robotsRef.current;
            const connectedIds = Object.keys(currentRobots).filter(id => currentRobots[id].connected);
            if (connectedIds.length === 0) return;

            for (const id of connectedIds) {
                const bot = currentRobots[id];

                // Only poll if Calibrating or Free Mode.
                // In Ready mode, we trust optimistic updates from moveJoint.
                if (bot.calibrationState !== 'cal' && !bot.freeMode) {
                    continue;
                }

                const newVals = [...bot.jointVals];
                let changed = false;
                const newLimits = bot.calibrationLimits.map(l => ({ ...l }));
                let limitsChanged = false;

                for (let i = 0; i < 6; i++) {
                    try {
                        let pos = await bot.driver.readPosition(i + 1);
                        // -1 is the error code from the driver
                        if (isNaN(pos) || pos === -1) continue;

                        // Normalize to single turn (handle multi-turn overflow)
                        pos = pos % 4096;

                        let angle = 0;

                        if (bot.calibrationState === 'cal') {
                            // During calibration: map raw 0-4095 to -100..100
                            angle = ((pos / 4095) * 200) - 100;
                        } else {
                            // Free mode / ready: map using calibrated limits
                            const limit = bot.calibrationLimits[i];
                            const range = limit.max - limit.min;
                            if (range <= 0) {
                                angle = 0;
                            } else {
                                const clampedPos = Math.max(limit.min, Math.min(limit.max, pos));
                                const normalized = (clampedPos - limit.min) / range;
                                angle = (normalized * 200) - 100;
                            }
                        }

                        if (Math.abs(angle - newVals[i]) > 0.5) {
                            newVals[i] = angle;
                            changed = true;
                        }

                        // Expand calibration limits during calibration
                        if (bot.calibrationState === 'cal') {
                            const limit = newLimits[i];
                            if (limit.min > limit.max) {
                                limit.min = pos;
                                limit.max = pos;
                                limitsChanged = true;
                            } else {
                                if (pos < limit.min) { limit.min = pos; limitsChanged = true; }
                                if (pos > limit.max) { limit.max = pos; limitsChanged = true; }
                            }
                        }
                    } catch (e) { }
                }

                if (changed || limitsChanged) {
                    setRobots(prev => ({
                        ...prev,
                        [id]: {
                            ...prev[id],
                            jointVals: newVals,
                            calibrationLimits: limitsChanged ? newLimits : prev[id].calibrationLimits
                        }
                    }));
                }
            }

        }, 150);
        return () => clearInterval(intervalId);
    }, []); // Run once on mount


    // --- CALIBRATION ---
    const startCalibration = () => {
        if (!activeRobotId) return;
        const id = activeRobotId;
        setRobots(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                calibrationState: 'cal',
                // Reset limits to "inverted" state to capture fresh range
                calibrationLimits: Array(6).fill(null).map(() => ({ min: 4096, max: -1 }))
            }
        }));
        // Disable torque for all servos to allow manual movement
        const bot = robots[id];
        if (bot) {
            setAllTorque(bot, false);
            addLog(`[${bot.name}] Calibration started. Move robot to limits.`);
        }
    };

    const finishCalibration = async () => {
        if (!activeRobotId) return;
        const id = activeRobotId;

        setRobots(prev => {
            const bot = prev[id];
            if (!bot) return prev;

            // 1. Identify Uncalibrated Joints and Lock Them
            const newLimits = bot.calibrationLimits.map((limit, idx) => {
                // If min > max, it means it was NEVER touched (still at 4096, -1)
                const isUntouched = limit.min > limit.max;

                if (isUntouched) {
                    // Lock it to safe center
                    return { min: 2048, max: 2048 };
                }

                // If touched but min==max (didn't move), allow a small buffer?
                // Or just keep it as is (locked)
                // If min=max, range is 0. moveJoint will stick to min.
                return limit;
            });

            return {
                ...prev,
                [id]: {
                    ...bot,
                    calibrationLimits: newLimits,
                    calibrationState: 'finishing'
                }
            };
        });

        // RE-READ logic from previous step, but now unnecessary to read hardware again 
        // because we have been polling!
        // Just write the limits from STATE to HARDWARE.

        addLog(`[${robots[id]?.name}] Configuring hardware limits...`);
        const bot = robots[id]; // Warning: this might be slightly stale if setRobots hasn't processed

        // Wait a tick for state to settle? 
        // Ideally we pass 'newLimits' to a function that does the hardware write.
        // Let's just do it.

        setTimeout(async () => {
            // We need to get the LATEST limits from the updated state, or re-calculate them here.
            // Since we can't easily access the NEXT state here, let's re-derive or use a ref.
            // Actually, 'newLimits' calculated above inside setRobots function is LOCAL to that function.
            // We need to access it here.

            // Redo calculation locally for hardware write:
            const currentBot = robotsRef.current[id]; // Use Ref for latest
            const limitsToWrite = currentBot.calibrationLimits.map(l => {
                if (l.min > l.max) return { min: 2048, max: 2048 };
                return l;
            });

            for (let i = 0; i < 6; i++) {
                const servoId = i + 1;
                let limit = limitsToWrite[i];

                // Apply to Hardware
                try {
                    if (limit.min > limit.max) [limit.min, limit.max] = [limit.max, limit.min];
                    await currentBot.driver.unlockEEPROM(servoId);
                    await currentBot.driver.setPositionLimits(servoId, limit.min, limit.max);
                    await currentBot.driver.lockEEPROM(servoId);
                } catch (e) { }
            }

            await new Promise(r => setTimeout(r, 200));
            await setAllTorque(currentBot, true);

            setRobots(prev => ({
                ...prev,
                [id]: {
                    ...prev[id],
                    calibrationLimits: limitsToWrite, // Ensure state matches hardware
                    calibrationState: 'rdy',
                    savePromptNeeded: false // Auto-saved
                }
            }));

            // AUTO-SAVE if User is logged in
            if (userId && currentBot.name) {
                try {
                    await saveCalibrationMutation({
                        userId,
                        name: currentBot.name,
                        calibrationLimits: limitsToWrite
                    });
                    addLog(`Auto-saved profile: ${currentBot.name}`);
                } catch (e) {
                    console.error("Auto-save failed", e);
                    addLog("Auto-save failed. Check console.");
                }
            }

            addLog(`[${currentBot.name}] Calibration Ready!`);

        }, 100);

    };

    // --- FREE MODE (Subject to Sync?) ---
    const setFreeMode = async (enabled: boolean) => {
        await applyToTargets(async (bot) => {
            await setAllTorque(bot, !enabled); // if enabled=true, torque=false

            setRobots(prev => ({
                ...prev,
                [bot.id]: { ...prev[bot.id], freeMode: enabled }
            }));
        });

        addLog(enabled ? "Free Mode ON" : "Free Mode OFF");
    };

    // --- RECORDING ---
    // Currently only records ACTIVE robot.
    const toggleRecording = () => {
        if (isRecording) {
            setIsRecording(false);
            addLog(`Recording stopped. ${recordedTraj.length} frames.`);
        } else {
            setRecordedTraj([]);
            setIsRecording(true);
            addLog("Recording started...");
        }
    };

    const playRecording = async () => {
        if (recordedTraj.length === 0) return;

        // Disable free mode if on
        await setFreeMode(false);

        setIsPlaying(true);
        addLog(`Playing ${recordedTraj.length} frames on Target(s)...`);

        // Replays on ALL targeted robots (Sync)
        for (const frame of recordedTraj) {
            // Apply frame to all targets
            // frame is [val, val...] (-100 to 100)
            await applyToTargets(async (bot) => {
                for (let i = 0; i < 6; i++) {
                    // Calculate target pos from frame value
                    const val = frame[i];
                    const limit = bot.calibrationLimits[i];
                    const range = limit.max - limit.min;
                    const norm = (val + 100) / 200;
                    const pos = Math.floor(limit.min + (norm * range));
                    // Clamp
                    const safe = Math.max(0, Math.min(4095, Math.max(limit.min, Math.min(limit.max, pos))));
                    await bot.driver.setPosition(i + 1, safe);
                }
            });
            await new Promise(r => setTimeout(r, 50));
        }

        setIsPlaying(false);
        addLog("Playback finished.");
    };

    // --- MOTOR CONFIGURATION ---
    const scanMotors = async (botId: string): Promise<number[]> => {
        const bot = robots[botId];
        if (!bot) return [];
        // Scan standard range + temp range
        // Standard: 1-6
        // Temp: 11-20 (or whatever we use)
        // Default new: 1
        const standard = await bot.driver.scan(1, 6);
        const temp = await bot.driver.scan(11, 20);
        const defaults = await bot.driver.scan(0, 1); // check 0 and 1
        return Array.from(new Set([...standard, ...temp, ...defaults])).sort((a, b) => a - b);
    };

    const configureMotorId = async (botId: string, currentId: number, newId: number): Promise<boolean> => {
        const bot = robots[botId];
        if (!bot) return false;
        return await bot.driver.changeId(currentId, newId);
    };

    // --- ISOLATION MODE ---
    // Replaces "Wiggle". Locks all other motors, frees the target one.
    // If targetId is null, frees ALL motors (Stop Isolation).
    const setMotorIsolation = async (botId: string, targetId: number | null, allIds: number[]) => {
        const bot = robots[botId];
        if (!bot) return;

        if (targetId !== null) {
            addLog(`[${bot.name}] ISOLATION MODE: Motor ${targetId} FREE, others LOCKED.`);
        } else {
            addLog(`[${bot.name}] ISOLATION MODE: OFF (All Motors Free).`);
        }

        // We iterate through all known IDs on the bus
        for (const id of allIds) {
            // small delay to prevent bus congestion
            await new Promise(r => setTimeout(r, 10));

            if (targetId === null) {
                // STOP: Free everyone
                try { await bot.driver.setTorque(id, false); } catch (e) { }
            } else {
                // ACTIVE: Free target, Lock others
                if (id === targetId) {
                    try { await bot.driver.setTorque(id, false); } catch (e) { }
                } else {
                    try { await bot.driver.setTorque(id, true); } catch (e) { }
                }
            }
        }
    };

    const updateRobotName = (id: string, newName: string) => {
        setRobots(prev => {
            const next = { ...prev };
            let bot = { ...next[id], name: newName };

            // Try to load profile for new name
            if (userProfiles) {
                const profile = userProfiles.find((p: any) => p.name === newName);
                if (profile) {
                    bot.calibrationLimits = profile.calibrationLimits;
                    bot.calibrationState = 'rdy';
                }
            }

            next[id] = bot;
            return next;
        });
    };



    const toggleLeaderFollower = async () => {
        if (!followerRobotId || !leaderRobotId) {
            addLog("Cannot start Leader-Follower: Missing Leader or Follower.");
            return;
        }

        const isActive = !isLeaderFollowerActive;
        setIsLeaderFollowerActive(isActive);

        const leader = robots[leaderRobotId];
        const follower = robots[followerRobotId];

        if (isActive) {
            addLog(`[Leader-Follower] STARTED. Leader: ${leader.name}, Follower: ${follower.name}`);
            // SAFETY: Leader -> Free (Torque OFF), Follower -> Rigid (Torque ON)
            await setAllTorque(leader, false);
            await setAllTorque(follower, true);
            // Update local state to reflect this
            setRobots(prev => ({
                ...prev,
                [leader.id]: { ...prev[leader.id], freeMode: true },
                [follower.id]: { ...prev[follower.id], freeMode: false }
            }));
        } else {
            addLog(`[Leader-Follower] STOPPED.`);
            // SAFETY: Lock Leader? Or leave free? Let's Lock Leader to prevent slumping.
            await setAllTorque(leader, true);
            setRobots(prev => ({
                ...prev,
                [leader.id]: { ...prev[leader.id], freeMode: false }
            }));
        }
    };

    return (
        <RobotContext.Provider value={{
            robots,
            activeRobotId,
            syncControl,
            logs,
            error,
            dismissError: () => setError(null),
            addRobot,
            setActiveRobot: setActiveRobotId,
            setSyncControl,
            disconnectRobot,

            // Proxies
            connect: addRobot,
            moveJoint,
            moveJointRel,
            startManualMove,
            stopManualMove,

            // Profile Helpers
            userProfiles: userProfiles || [],
            confirmProfileSelection,
            saveMakeProfile,
            deleteRobotProfile,
            redoCalibration,
            simulateRobotConnection,

            startCalibration,
            finishCalibration,
            setFreeMode,

            isRecording,
            isPlaying,
            recordedTraj,
            toggleRecording,
            playRecording,

            speedMultiplier,
            setSpeedMultiplier,

            // Config
            scanMotors,
            configureMotorId,
            setMotorIsolation,

            // Leader-Follower
            leaderRobotId,
            setLeaderRobotId,
            followerRobotId,
            setFollowerRobotId,
            isLeaderFollowerActive,
            toggleLeaderFollower,
            updateRobotName,

            item: "so-100",
            get activeRobot() { return activeRobotId ? robots[activeRobotId] : null }
        }}>
            {children}
        </RobotContext.Provider>
    );
}

export function useRobot() {
    const context = useContext(RobotContext);
    if (!context) throw new Error("useRobot must be used within RobotProvider");

    // Map ACTIVE robot state to top-level properties
    const active = context.activeRobot;

    return {
        ...context,
        // Overrides/Aliases for active robot
        connected: active ? active.connected : false,
        calibrationState: active ? active.calibrationState : 'unc',
        jointVals: active ? active.jointVals : [0, 0, 0, 0, 0, 0],
        calibrationLimits: active ? active.calibrationLimits : [],
        freeMode: active ? active.freeMode : false,
        // driver: active?.driver // Do not expose raw driver if possible, use context methods
    };
}
