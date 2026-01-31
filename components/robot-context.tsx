"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { RobotDriver } from '@/lib/web-serial-driver';

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
    // We could track individual recording/free modes, but for now we might share or keep per-bot.
    // Let's keep these per-bot since one might be recording while another is not? 
    // Actually, distinct Free Mode is useful. 
    freeMode: boolean;
}

interface RobotContextType {
    // Fleet State
    robots: Record<string, RobotInstance>;
    activeRobotId: string | null;
    syncControl: boolean;
    logs: string[];

    // Actions
    // Actions
    addRobot: () => Promise<void>;
    setActiveRobot: (id: string) => void;
    setSyncControl: (enabled: boolean) => void;
    disconnectRobot: (id: string) => Promise<void>;

    // Active Robot Proxies (or Unified Actions)
    // These generally apply to the active robot, or ALL if syncControl is true for movements.
    connect: () => Promise<void>; // Legacy alias for addRobot

    // Speed
    setSpeedMultiplier: (speed: number) => void;
    speedMultiplier: number;

    // Joint Control
    moveJoint: (jointIdx: number, value: number) => void;
    moveJointRel: (jointIdx: number, percentChange: number) => void;
    startManualMove: (jointIdx: number, direction: number) => void;
    stopManualMove: () => void;

    // Config
    startCalibration: () => void;
    finishCalibration: () => void;
    setFreeMode: (enabled: boolean) => Promise<void>;

    // Recording (Global for now, uses Active Robot or All?)
    // Let's make recording capture ALL robots if sync is on? 
    // For simplicity, recording is currently designed for one trajectory. 
    // We will bind recording to the ACTIVE robot for now.
    isRecording: boolean;
    isPlaying: boolean;
    recordedTraj: number[][]; // Stores active robot's path
    toggleRecording: () => void;
    playRecording: () => Promise<void>;

    // Helpers
    item: string;
    activeRobot: RobotInstance | null; // Helper accessor
}

const RobotContext = createContext<RobotContextType | undefined>(undefined);

export function RobotProvider({ children }: { children: React.ReactNode }) {
    // FLEET STATE
    const [robots, setRobots] = useState<Record<string, RobotInstance>>({});
    const [activeRobotId, setActiveRobotId] = useState<string | null>(null);
    const [syncControl, setSyncControl] = useState(false);

    const [logs, setLogs] = useState<string[]>([]);

    // GLOBAL / ACTIVE STATE (Legacy wrappers)
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [recordedTraj, setRecordedTraj] = useState<number[][]>([]); // For the active robot

    // Speed Control
    const [speedMultiplier, setSpeedMultiplier] = useState(1.0);

    // Helpers
    const activeRobot = activeRobotId ? robots[activeRobotId] : null;

    const moveInterval = useRef<NodeJS.Timeout | null>(null);
    const j5PositionsRef = useRef<Map<string, Set<number>>>(new Map()); // id -> map

    const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 10));

    // REF TO LATEST STATE (Fixes stale closures in setInterval/Timeouts)
    const stateRef = useRef({ robots, activeRobotId, syncControl, speedMultiplier });
    useEffect(() => {
        stateRef.current = { robots, activeRobotId, syncControl, speedMultiplier };
    }, [robots, activeRobotId, syncControl, speedMultiplier]);

    // ----------- POLLING LOOP (FLEET WIDE) -----------
    useEffect(() => {
        let active = true;
        const isValidPosition = (val: number) => val >= 0 && val <= 4095;

        const runLoop = async () => {
            if (!active) return;

            const robotIds = Object.keys(robots);
            if (robotIds.length === 0) {
                setTimeout(runLoop, 200);
                return;
            }

            // We iterate all robots to update their state
            // But we can't easily update state in a loop without functional updates.
            // We will collect updates and apply once.

            const updates: Record<string, Partial<RobotInstance>> = {};
            let updatesFound = false;

            for (const id of robotIds) {
                const bot = robots[id];
                if (!bot.connected || !bot.driver) continue;

                // Conditions to read
                const shouldRead = bot.calibrationState === 'cal' || bot.freeMode || (id === activeRobotId && isRecording);

                if (!shouldRead) continue;

                const readings: number[] = [];
                for (let i = 0; i < 6; i++) {
                    try {
                        const raw = await bot.driver.readPosition(i + 1);
                        readings.push((raw !== -1 && isValidPosition(raw)) ? raw : -1);
                    } catch (e) {
                        readings.push(-1);
                    }
                }

                // 1. CALIBRATION LOGIC
                if (bot.calibrationState === 'cal') {
                    // Track J5
                    if (readings[4] !== -1) {
                        if (!j5PositionsRef.current.has(id)) j5PositionsRef.current.set(id, new Set());
                        const set = j5PositionsRef.current.get(id)!;
                        set.add(Math.round(readings[4] / 20) * 20);
                    }

                    // Update limits
                    const newLimits = [...bot.calibrationLimits];
                    let limitsChanged = false;
                    readings.forEach((val, i) => {
                        if (val !== -1) {
                            if (val < newLimits[i].min) { newLimits[i].min = val; limitsChanged = true; }
                            if (val > newLimits[i].max) { newLimits[i].max = val; limitsChanged = true; }
                        }
                    });

                    if (limitsChanged) {
                        updates[id] = { ...updates[id], calibrationLimits: newLimits };
                        updatesFound = true;
                    }
                }

                // 2. SYNC JOINTS
                if (bot.calibrationState === 'cal' || bot.freeMode) {
                    const newVals = readings.map((val, i) => {
                        if (val === -1) return bot.jointVals[i];

                        if (bot.calibrationState === 'cal') {
                            // Raw: 0->-100, 2048->0, 4095->100
                            return ((val - 2048) / 2048) * 100;
                        } else {
                            // Calibrated
                            const limit = bot.calibrationLimits[i];
                            const range = limit.max - limit.min;
                            if (range > 0) {
                                const norm = (val - limit.min) / range;
                                return Math.max(-100, Math.min(100, (norm * 200) - 100));
                            }
                            return 0;
                        }
                    });

                    // Only update if different enough? Or just update.
                    updates[id] = { ...updates[id], jointVals: newVals };
                    updatesFound = true;

                    // 3. RECORDING (Only Active Robot)
                    if (isRecording && id === activeRobotId) {
                        setRecordedTraj(prev => [...prev, [...newVals]]);
                    }
                }
            }

            // Apply updates
            if (updatesFound) {
                setRobots(prev => {
                    const next = { ...prev };
                    Object.keys(updates).forEach(id => {
                        next[id] = { ...next[id], ...updates[id] };
                    });
                    return next;
                });
            }

            if (active) setTimeout(runLoop, isRecording ? 50 : 100);
        };

        runLoop();
        return () => { active = false; };
    }, [robots, activeRobotId, isRecording]); // Re-binds when robot list changes. Optimize? 
    // If robots changes, we restart loop. That's fine.

    // ----------- ACTIONS -----------

    const addRobot = async () => {
        const newDriver = new RobotDriver();
        try {
            const success = await newDriver.connect();
            if (success) {
                const id = crypto.randomUUID();
                const num = Object.keys(robots).length + 1;
                const newBot: RobotInstance = {
                    id,
                    name: `Robot ${num}`,
                    driver: newDriver,
                    connected: true,
                    calibrationState: 'unc', // Explicitly uncalibrated on connect
                    jointVals: [0, 0, 0, 0, 0, 0],
                    calibrationLimits: Array(6).fill(null).map(() => ({ min: 0, max: 4095 })),
                    freeMode: false
                };

                setRobots(prev => ({ ...prev, [id]: newBot }));
                setActiveRobotId(id); // Auto-select new robot
                addLog(`Connected to ${newBot.name}`);

                // Disable Torque initially
                for (let i = 1; i <= 6; i++) await newDriver.setTorque(i, false);
            } else {
                addLog("Failed to connect to new robot");
            }
        } catch (e) {
            console.error(e);
            addLog(`Connection error: ${e}`);
        }
    };

    const disconnectRobot = async (id: string) => {
        const bot = robots[id];
        if (bot) {
            await bot.driver.disconnect();
            setRobots(prev => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            if (activeRobotId === id) {
                setActiveRobotId(Object.keys(robots).find(k => k !== id) || null);
            }
            addLog(`Disconnected ${bot.name}`);
        }
    };

    // --- JOINT MOVEMENTS (SYNC SUPPORT) ---

    // Generic helper to apply function to target(s)
    const applyToTargets = async (fn: (bot: RobotInstance) => Promise<void> | void) => {
        const { robots, activeRobotId, syncControl } = stateRef.current;
        const targets: RobotInstance[] = [];
        if (syncControl) {
            Object.values(robots).forEach(b => { if (b.connected) targets.push(b); });
        } else if (activeRobotId && robots[activeRobotId]) {
            targets.push(robots[activeRobotId]);
        }

        await Promise.all(targets.map(fn));
    };

    const moveJoint = async (jointIdx: number, value: number) => {
        if (!activeRobotId && !syncControl) return;

        // Optimistic UI update for active robot immediately
        if (activeRobotId && robots[activeRobotId]) {
            // We can't easily optimistic update "All" in state without flicker or complexity.
            // But for the active one, we should.
            const bot = robots[activeRobotId];
            if (!bot.freeMode) {
                // Update state
                setRobots(prev => {
                    const next = { ...prev };
                    const b = { ...next[activeRobotId!] };
                    const vals = [...b.jointVals];
                    vals[jointIdx] = value;
                    b.jointVals = vals;
                    next[activeRobotId!] = b;
                    return next;
                });
            }
        }

        await applyToTargets(async (bot) => {
            if (bot.freeMode) return;
            if (bot.calibrationState !== 'rdy') return; // Enforce readiness

            const limit = bot.calibrationLimits[jointIdx];
            const range = limit.max - limit.min;
            const norm = (value + 100) / 200;
            let target = Math.floor(limit.min + (norm * range));

            // Clamp
            target = Math.max(limit.min, Math.min(limit.max, target));
            target = Math.max(0, Math.min(4095, target));

            await bot.driver.setPosition(jointIdx + 1, target);
        });
    };

    const moveJointRel = async (jointIdx: number, percentChange: number) => {
        // More complex for Sync: relative to EACH robot's current pos?
        // Yes.
        await applyToTargets(async (bot) => {
            if (bot.freeMode) return;
            // Read current effective percentage
            // We can use bot.jointVals[jointIdx] which is -100..100
            const current = bot.jointVals[jointIdx];
            // Apply speed multiplier
            const { speedMultiplier } = stateRef.current;
            const delta = (percentChange / 100) * 200 * speedMultiplier;
            const next = Math.max(-100, Math.min(100, current + delta));

            // call internal move helper (duplicate logic but eh)
            // Better to just call moveJoint logic inline or extract

            const limit = bot.calibrationLimits[jointIdx];
            const range = limit.max - limit.min;
            const norm = (next + 100) / 200;
            const target = Math.max(0, Math.min(4095, Math.floor(limit.min + (norm * range))));

            await bot.driver.setPosition(jointIdx + 1, target);

            // We need to update state so successive relative moves work
            // But we are in a loop update...
            // Let's force update state for everyone? Expensive?
            // Not really for <5 robots.
            setRobots(prev => {
                const n = { ...prev };
                if (n[bot.id]) {
                    const vals = [...n[bot.id].jointVals];
                    vals[jointIdx] = next;
                    n[bot.id] = { ...n[bot.id], jointVals: vals };
                }
                return n;
            });
        });
    };

    // Wrapper for interval checks
    const startManualMove = (jointIdx: number, direction: number) => {
        if (moveInterval.current) return;
        // Faster interval (30ms) for smoother motion
        // Smaller step (0.5%) per tick, totaling ~16% per second at 1x speed
        const tick = () => moveJointRel(jointIdx, direction * 0.5);
        tick();
        moveInterval.current = setInterval(tick, 30);
    };

    const stopManualMove = () => {
        if (moveInterval.current) {
            clearInterval(moveInterval.current);
            moveInterval.current = null;
        }
    };


    // --- TORQUE HELPER ---
    const setAllTorque = async (bot: RobotInstance, enable: boolean) => {
        for (let i = 1; i <= 6; i++) {
            let success = false;
            // Retry logic: 3 attempts
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    await bot.driver.setTorque(i, enable);
                    success = true;
                    break;
                } catch (e) {
                    console.warn(`[${bot.name}] Failed to set torque for J${i}, attempt ${attempt + 1}`);
                    await new Promise(r => setTimeout(r, 10));
                }
            }
            if (!success) addLog(`[${bot.name}] Warning: Failed to set torque J${i}`);

            // Small delay between servos to prevent flooding serial bus
            await new Promise(r => setTimeout(r, 10));
        }
    };

    // --- CALIBRATION (Active Only) ---
    // Calibration is complex to sync. Let's force Calibration to be PER ROBOT (Active).
    // Syncing calibration seems dangerous/confusing.

    const startCalibration = async () => {
        if (!activeRobotId) return;
        const id = activeRobotId;
        const bot = robots[id];

        addLog(`[${bot.name}] Starting Calibration...`);
        // Use robust helper
        await setAllTorque(bot, false);

        j5PositionsRef.current.delete(id); // Clear history

        // Initial READ to prevent big jump
        const initLimits: CalibrationLimit[] = [];
        for (let i = 0; i < 6; i++) {
            const val = await bot.driver.readPosition(i + 1);
            const safe = (val !== -1 && val >= 0 && val <= 4095) ? val : 2048;
            initLimits.push({ min: safe, max: safe });
        }

        setRobots(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                calibrationLimits: initLimits,
                calibrationState: 'cal'
            }
        }));
    };

    const finishCalibration = async () => {
        if (!activeRobotId) return;
        const id = activeRobotId;
        const bot = robots[id];

        // Update state to finishing
        setRobots(prev => ({ ...prev, [id]: { ...prev[id], calibrationState: 'finishing' } }));

        // Config Hardware Limits
        addLog(`[${bot.name}] Configuring hardware limits...`);
        for (let i = 0; i < 6; i++) {
            const servoId = i + 1;
            // J5 Safety (Hardware 0-4095)
            if (i === 4) {
                await bot.driver.unlockEEPROM(servoId);
                await bot.driver.setPositionLimits(servoId, 0, 4095);
                await bot.driver.lockEEPROM(servoId);
                continue;
            }

            const limit = bot.calibrationLimits[i];
            let min = Math.max(0, Math.min(4095, limit.min));
            let max = Math.max(0, Math.min(4095, limit.max));
            if (min > max) [min, max] = [max, min];

            // Write to EEPROM if different
            try {
                const curr = await bot.driver.readPositionLimits(servoId);
                if (curr.min !== min || curr.max !== max) {
                    await bot.driver.unlockEEPROM(servoId);
                    await bot.driver.setPositionLimits(servoId, min, max);
                    await bot.driver.lockEEPROM(servoId);
                }
            } catch (e) {/* ignore */ }
        }

        await new Promise(r => setTimeout(r, 200));
        // Re-enable Torque using robust helper
        await setAllTorque(bot, true);

        // Final State Update
        setRobots(prev => ({
            ...prev,
            [id]: { ...prev[id], calibrationState: 'rdy' }
        }));

        // Trigger a read to sync sliders
        // (Handled by next poll loop essentially, but we reset sliders to 0 or sync?)
        // The loop will sync them.
        addLog(`[${bot.name}] Calibration Ready!`);
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

    return (
        <RobotContext.Provider value={{
            robots,
            activeRobotId,
            syncControl,
            logs,
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

    // BACKWARD COMPATIBILITY LAYER
    // Many components confirm strictly to 'connected', 'jointVals', etc.
    // We map the ACTIVE robot's state to these top-level properties.
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
