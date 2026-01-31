"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { RobotDriver } from '@/lib/web-serial-driver';

type CalibrationState = 'unc' | 'cal' | 'finishing' | 'rdy';

interface CalibrationLimit {
    min: number;
    max: number;
}

interface RobotContextType {
    driver: RobotDriver | null;
    connected: boolean;
    calibrationState: CalibrationState;
    item: string;
    logs: string[];
    jointVals: number[];
    calibrationLimits: CalibrationLimit[];
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
    startCalibration: () => void;
    finishCalibration: () => void;
    moveJoint: (jointIdx: number, value: number) => void;
    moveJointRel: (jointIdx: number, percentChange: number) => void;
    startManualMove: (jointIdx: number, direction: number) => void;
    stopManualMove: () => void;
}

const RobotContext = createContext<RobotContextType | undefined>(undefined);

export function RobotProvider({ children }: { children: React.ReactNode }) {
    const driverRef = useRef<RobotDriver | null>(null);
    const [connected, setConnected] = useState(false);
    const [calibrationState, setCalibrationState] = useState<CalibrationState>('unc');
    const [logs, setLogs] = useState<string[]>([]);
    const [jointVals, setJointVals] = useState<number[]>([0, 0, 0, 0, 0, 0]);
    const moveInterval = useRef<NodeJS.Timeout | null>(null);

    // Track Joint 5 positions during calibration for gap detection
    const j5PositionsRef = useRef<Set<number>>(new Set());

    // Default calibration limits (Safety fallback)
    const [calibrationLimits, setCalibrationLimits] = useState<CalibrationLimit[]>([
        { min: 0, max: 4095 }, { min: 0, max: 4095 }, { min: 0, max: 4095 },
        { min: 0, max: 4095 }, { min: 0, max: 4095 }, { min: 0, max: 4095 }
    ]);

    // Initialize driver ref once
    if (!driverRef.current && typeof window !== 'undefined') {
        driverRef.current = new RobotDriver();
    }

    const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 10));

    // Polling Loop for Read Position
    useEffect(() => {
        let active = true;

        // STS3215 servos use UNSIGNED 0-4095 range (360°)
        const isValidPosition = (val: number) => val >= 0 && val <= 4095;

        // Use recursive timeout to prevent overlapping iterations
        const runCalibrationLoop = async () => {
            if (!active || !driverRef.current || !connected || calibrationState !== 'cal') {
                if (active && calibrationState === 'cal') {
                    setTimeout(runCalibrationLoop, 100);
                }
                return;
            }

            // Read all joint positions
            const readings: number[] = [];
            for (let i = 0; i < 6; i++) {
                try {
                    const raw = await driverRef.current.readPosition(i + 1);
                    const val = (raw !== -1 && isValidPosition(raw)) ? raw : -1;
                    readings.push(val);
                } catch (e) {
                    readings.push(-1);
                }
            }

            // Track Joint 5 positions for gap detection
            if (readings[4] !== -1) {
                // Round to nearest 20 for better precision (100 was too coarse)
                const rounded = Math.round(readings[4] / 20) * 20;
                j5PositionsRef.current.add(rounded);
            }

            // Update limits atomically - all joints use normal min/max tracking
            setCalibrationLimits(prev => {
                const next = prev.map(limit => ({ ...limit }));
                readings.forEach((val, i) => {
                    if (val !== -1) {
                        if (val < next[i].min) next[i].min = val;
                        if (val > next[i].max) next[i].max = val;
                    }
                });
                // Log for debugging
                console.log(`[CalLoop] J1: ${next[0].min}-${next[0].max} | J5: ${next[4].min}-${next[4].max} (${j5PositionsRef.current.size} positions tracked)`);
                return next;
            });

            // Update sliders with readings using the standard 0-4095 range
            // -100% = 0, 0% = 2048 (midpoint), +100% = 4095
            setJointVals(prev => {
                return readings.map((val, i) => {
                    if (val === -1) return prev[i];
                    // Map 0-4095 to -100..100 with midpoint at 0
                    return ((val - 2048) / 2048) * 100;
                });
            });

            // Schedule next iteration ONLY after this one completes
            if (active) {
                setTimeout(runCalibrationLoop, 100);
            }
        };

        // Start the loop
        if (calibrationState === 'cal') {
            runCalibrationLoop();
        }

        return () => { active = false; };
    }, [connected, calibrationState]);


    const connect = async () => {
        if (!driverRef.current) return;
        try {
            const success = await driverRef.current.connect();
            if (success) {
                setConnected(true);
                addLog("Connected to Serial Port");
                setCalibrationState('unc');
                await disableTorqueAll();
            } else {
                addLog("Failed to connect");
            }
        } catch (e) {
            console.error(e);
            addLog(`Connection error: ${e}`);
        }
    };

    const disconnect = async () => {
        if (!driverRef.current) return;
        await driverRef.current.disconnect();
        setConnected(false);
        addLog("Disconnected");
    };

    const disableTorqueAll = async () => {
        if (!driverRef.current) return;
        for (let i = 1; i <= 6; i++) {
            await driverRef.current.setTorque(i, false);
            await new Promise(r => setTimeout(r, 10));
        }
    };

    const enableTorqueAll = async () => {
        if (!driverRef.current) return;
        for (let i = 1; i <= 6; i++) {
            await driverRef.current.setTorque(i, true);
            await new Promise(r => setTimeout(r, 10));
        }
    };

    const startCalibration = async () => {
        addLog("Starting Calibration - Torque DISABLED. Move to limits.");
        await disableTorqueAll();

        // Clear J5 position tracking for gap detection
        j5PositionsRef.current.clear();

        const isValidPosition = (val: number) => val >= 0 && val <= 4095;

        const initialLimits: { min: number; max: number }[] = [];
        if (driverRef.current) {
            for (let i = 0; i < 6; i++) {
                try {
                    const raw = await driverRef.current.readPosition(i + 1);
                    const pos = (raw !== -1 && isValidPosition(raw)) ? raw : 2048;
                    initialLimits.push({ min: pos, max: pos });
                } catch (e) {
                    initialLimits.push({ min: 2048, max: 2048 });
                }
            }
        } else {
            for (let i = 0; i < 6; i++) {
                initialLimits.push({ min: 2048, max: 2048 });
            }
        }

        setCalibrationLimits(initialLimits);
        addLog("Move each joint to its limits.");

        setCalibrationState('cal');
    };

    const finishCalibration = async () => {
        // Set state to 'finishing' to stop the polling loop immediately
        setCalibrationState('finishing');

        // LOG CAPTURED LIMITS FOR DEBUGGING
        console.log("=== CALIBRATION COMPLETE ===");
        calibrationLimits.forEach((limit, i) => {
            console.log(`Joint ${i + 1}: Min=${limit.min}, Max=${limit.max}, Range=${limit.max - limit.min}`);
        });

        // Gap detection for Joint 5 (wrist roll)
        // Filter noise: Remove isolated points or small clusters inside the gap
        const j5Positions = Array.from(j5PositionsRef.current).sort((a, b) => a - b);










        console.log(`[J5 Gap] Tracked ${j5Positions.length} positions:`, j5Positions);

        if (j5Positions.length >= 2) {
            // Find the largest gap between consecutive positions
            let largestGap = 0;
            let gapLowEdge = 0;  // Position just before the gap
            let gapHighEdge = 0; // Position just after the gap

            for (let i = 0; i < j5Positions.length - 1; i++) {
                const gap = j5Positions[i + 1] - j5Positions[i];
                if (gap > largestGap) {
                    largestGap = gap;
                    gapLowEdge = j5Positions[i];      // Last visited position before gap
                    gapHighEdge = j5Positions[i + 1]; // First visited position after gap
                }
            }

            // Also check the wrap-around gap (from last position to first, going through 0/4095)
            const wrapGap = (j5Positions[0] + 4096) - j5Positions[j5Positions.length - 1];
            if (wrapGap > largestGap) {
                largestGap = wrapGap;
                gapLowEdge = j5Positions[j5Positions.length - 1]; // Last before wrap
                gapHighEdge = j5Positions[0];                      // First after wrap
            }

            console.log(`[J5 Gap] Largest gap: ${largestGap} (from ${gapLowEdge} to ${gapHighEdge})`);

            // If gap is significant (>= 200), set J5 limits based on gap
            // The GAP is where the robot CAN'T go (the wall)
            // The USABLE range is OUTSIDE the gap
            // So: min = gapHighEdge (start of usable range), max = gapLowEdge (end of usable range)
            // Movement: -100% = gapHighEdge, +100% = gapLowEdge
            // The servo moves through the usable range (gapHighEdge -> 4095 -> 0 -> gapLowEdge)
            if (largestGap >= 200) {
                setCalibrationLimits(prev => {
                    const next = [...prev];
                    // min = high edge of gap (where usable range STARTS) + 20 buffer
                    // max = low edge of gap (where usable range ENDS) - 20 buffer
                    // This shrinks the valid range slightly to avoid hitting the wall
                    const safeMin = (gapHighEdge + 20) % 4096;
                    const safeMax = (gapLowEdge - 20 + 4096) % 4096;

                    next[4] = { min: safeMin, max: safeMax };
                    return next;
                });
                addLog(`J5: Gap detected ${gapLowEdge}-${gapHighEdge}. Usable range: ${gapHighEdge}→${gapLowEdge}`);
                console.log(`[J5 Gap] Usable range: ${gapHighEdge} (-100%) -> 4095 -> 0 -> ${gapLowEdge} (+100%)`);
            } else {
                console.log(`[J5 Gap] No significant gap found (${largestGap}), using normal min/max`);
            }
        }

        console.log("============================");

        // Configure servo hardware limits to match calibrated range
        addLog("Configuring servo position limits...");
        if (driverRef.current) {
            for (let i = 0; i < 6; i++) {
                const limit = calibrationLimits[i];
                const servoId = i + 1;

                // Skip J5 if using gap-based limits (min > max)
                // BUT we must ENSURE hardware limits are fully open (0-4095) so it can wrap
                if (i === 4 && limit.min > limit.max) {
                    console.log(`[ConfigLimits] J5: Resetting hardware limits to 0-4095 for wrap-around (Soft limits: ${limit.min}-${limit.max})`);
                    try {
                        // Reset J5 to full range so physical wrapping works
                        await driverRef.current.unlockEEPROM(servoId);
                        await driverRef.current.setPositionLimits(servoId, 0, 4095);
                        await driverRef.current.lockEEPROM(servoId);
                    } catch (e) {
                        console.error(`Failed to reset J5 limits`, e);
                    }
                    continue; // Skip the normal limit setting
                }

                try {
                    // Clamp to valid hardware range
                    let min = Math.max(0, Math.min(4095, limit.min));
                    let max = Math.max(0, Math.min(4095, limit.max));

                    // Safety: ensure min < max (swap if needed)
                    if (min > max) {
                        console.warn(`[ConfigLimits] J${servoId}: Min > Max (${min} > ${max}), swapping!`);
                        [min, max] = [max, min];
                    }

                    // Read current limits to compare
                    const currentLimits = await driverRef.current.readPositionLimits(servoId);
                    console.log(`[ConfigLimits] J${servoId}: Current=${currentLimits.min}-${currentLimits.max}, New=${min}-${max}`);

                    // Only update if different
                    if (currentLimits.min !== min || currentLimits.max !== max) {
                        // Unlock EEPROM, write limits, lock EEPROM
                        await driverRef.current.unlockEEPROM(servoId);
                        await new Promise(r => setTimeout(r, 10)); // Small delay
                        await driverRef.current.setPositionLimits(servoId, min, max);
                        await new Promise(r => setTimeout(r, 10)); // Small delay
                        await driverRef.current.lockEEPROM(servoId);
                        console.log(`[ConfigLimits] J${servoId}: Updated servo limits to ${min}-${max}`);
                    }
                } catch (e) {
                    console.error(`Failed to configure limits for joint ${i + 1}:`, e);
                }
            }
        }

        addLog("Enabling Torque...");
        await enableTorqueAll();

        // STS3215 uses UNSIGNED 0-4095 range
        const isValidPosition = (val: number) => val >= 0 && val <= 4095;

        // Clamp limits to valid 0-4095 range
        setCalibrationLimits(prev => {
            const clamped = prev.map(limit => ({
                min: Math.max(0, Math.min(4095, limit.min)),
                max: Math.max(0, Math.min(4095, limit.max))
            }));
            console.log("Clamped Limits to 0-4095:", clamped);
            return clamped;
        });

        // Sync UI sliders with current physical position preventing "jumps"
        if (driverRef.current) {
            const newJointVals = [...jointVals];
            for (let i = 0; i < 6; i++) {
                try {
                    const raw = await driverRef.current.readPosition(i + 1);
                    const pos = (raw !== -1 && isValidPosition(raw)) ? raw : -1;

                    if (pos !== -1) {
                        const rawLimit = calibrationLimits[i];
                        const limit = {
                            min: Math.max(0, Math.min(4095, rawLimit.min)),
                            max: Math.max(0, Math.min(4095, rawLimit.max))
                        };
                        const range = limit.max - limit.min;

                        if (range > 0) {
                            // Map Physical (Min..Max) -> Slider (-100..100)
                            const normalized = (pos - limit.min) / range;
                            const sliderVal = (normalized * 200) - 100;
                            newJointVals[i] = Math.max(-100, Math.min(100, sliderVal));
                        } else {
                            newJointVals[i] = 0;
                        }
                    }
                } catch (e) {
                    console.error(`Failed to sync joint ${i}`, e);
                }
            }
            setJointVals(newJointVals);
        }

        setCalibrationState('rdy');

        // Log final state for debugging
        addLog(`Calibration complete! J1: ${calibrationLimits[0].min}-${calibrationLimits[0].max}`);
    };

    // Absolute Move (-100 to 100) based on Calibrated Range
    const moveJoint = async (jointIdx: number, value: number) => {
        if (!driverRef.current || calibrationState !== 'rdy') return;

        const limit = calibrationLimits[jointIdx];
        let finalPos: number;

        // Joint 5: Handle gap-based limits where min > max (range goes through 0)
        // min = low edge of gap (e.g., 2950), max = high edge of gap (e.g., 3300)
        // Movement: -100% = min (2950), +100% = max (3300)
        // The "usable" range goes: min -> 0 -> max (the "long way" around, avoiding the gap)
        if (jointIdx === 4 && limit.min > limit.max) {
            // Range goes: min -> 4095 -> 0 -> max (crossing 0)
            // Total range = (4096 - min) + max
            const totalRange = (4096 - limit.min) + limit.max;
            const normalized = (value + 100) / 200; // 0..1
            const offset = Math.floor(normalized * totalRange);

            // Start from min and go FORWARD (increasing toward 4095, wrapping to 0)
            finalPos = (limit.min + offset) % 4096;

            console.log(`[Move] J5 (gap): slider=${value.toFixed(0)}% -> offset=${offset}/${totalRange} -> final=${finalPos} (gap: ${limit.max}-${limit.min})`);
        } else {
            // Normal range: min..max
            const range = limit.max - limit.min;
            const normalized = (value + 100) / 200;
            let targetPos = Math.floor(limit.min + (normalized * range));

            // Clamp to Calibrated Limits then to Hardware Range (0-4095)
            targetPos = Math.max(limit.min, Math.min(limit.max, targetPos));
            finalPos = Math.max(0, Math.min(4095, targetPos));

            console.log(`[Move] J${jointIdx + 1}: slider=${value.toFixed(0)}% -> final=${finalPos} (limits: ${limit.min}..${limit.max})`);
        }

        await driverRef.current.setPosition(jointIdx + 1, finalPos);

        setJointVals(prev => {
            const next = [...prev];
            next[jointIdx] = value;
            return next;
        });
    };

    // Relative Move (Percent Change)
    const moveJointRel = async (jointIdx: number, percentChange: number) => {
        if (!driverRef.current) return;

        // 1. Try to read ACTUAL position from robot to prevent jumps
        let currentEffectiveVal = jointVals[jointIdx]; // Fallback to state

        // STS3215 uses UNSIGNED 0-4095 range
        const isValidPosition = (val: number) => val >= 0 && val <= 4095;

        try {
            const raw = await driverRef.current.readPosition(jointIdx + 1);
            const physicalPos = (raw !== -1 && isValidPosition(raw)) ? raw : -1;

            console.log(`[MoveRel] J${jointIdx + 1} Physical: ${physicalPos} (Raw: ${raw})`);

            if (physicalPos !== -1) {
                const limit = calibrationLimits[jointIdx];

                // J5 with gap-based limits (min > max, range goes through 0)
                if (jointIdx === 4 && limit.min > limit.max) {
                    const totalRange = (4096 - limit.min) + limit.max;
                    // Calculate offset from min going FORWARD (increasing) through 0
                    let offset: number;
                    // Check if inside gap (between max and min)
                    if (physicalPos > limit.max && physicalPos < limit.min) {
                        // Position is in the invalid gap (or buffer zone)
                        // Snap to NEAREST limit to avoid jumping across the wall
                        const distToMin = Math.abs(physicalPos - limit.min);
                        const distToMax = Math.abs(physicalPos - limit.max);

                        if (distToMin < distToMax) {
                            offset = 0; // Closer to start (min)
                        } else {
                            offset = totalRange; // Closer to end (max)
                        }
                    } else {
                        // Position is in usable range
                        if (physicalPos >= limit.min) {
                            offset = physicalPos - limit.min;
                        } else {
                            // Wrapped around 0 (e.g., physicalPos=100, min=3300)
                            // Offset = (4096 - min) + physicalPos
                            offset = (4096 - limit.min) + physicalPos;
                        }
                    }
                    const normalized = offset / totalRange;
                    const calculatedVal = -100 + (normalized * 200);
                    console.log(`[MoveRel] J5 (gap): offset=${offset}/${totalRange} -> PhysVal: ${calculatedVal.toFixed(2)}`);
                    currentEffectiveVal = calculatedVal;
                } else {
                    // Normal range
                    const range = limit.max - limit.min;
                    console.log(`[MoveRel] J${jointIdx + 1} Limit: [${limit.min}, ${limit.max}] Range: ${range}`);

                    if (range > 0) {
                        const normalized = (physicalPos - limit.min) / range;
                        const calculatedVal = (normalized * 200) - 100;
                        console.log(`[MoveRel] J${jointIdx + 1} PhysVal: ${calculatedVal.toFixed(2)}`);
                        currentEffectiveVal = calculatedVal;
                    }
                }
            } else {
                console.warn(`[MoveRel] Failed to read valid position for J${jointIdx + 1} (got -1)`);
            }
        } catch (e) {
            console.warn("Failed to read pos for relative move, using state", e);
        }

        const delta = (percentChange / 100) * 200; // e.g. 0.02 * 200 = 4
        const nextVal = Math.min(Math.max(currentEffectiveVal + delta, -100), 100);

        await moveJoint(jointIdx, nextVal);
    };

    const startManualMove = (jointIdx: number, direction: number) => {
        if (moveInterval.current) return; // Already moving

        // Initial move
        moveJointRel(jointIdx, direction * 2); // 2% immediate move

        // Loop for continuous movement
        moveInterval.current = setInterval(() => {
            moveJointRel(jointIdx, direction * 2); // 2% per tick
        }, 150); // Slightly slower tick
    };

    const stopManualMove = () => {
        if (moveInterval.current) {
            clearInterval(moveInterval.current);
            moveInterval.current = null;
        }
    };

    return (
        <RobotContext.Provider value={{
            driver: driverRef.current,
            connected,
            calibrationState,
            item: "so-100",
            logs,
            jointVals,
            calibrationLimits,
            connect,
            disconnect,
            startCalibration,
            finishCalibration,
            moveJoint,
            moveJointRel,
            startManualMove,
            stopManualMove
        }}>
            {children}
        </RobotContext.Provider>
    );
}

export function useRobot() {
    const context = useContext(RobotContext);
    if (context === undefined) {
        throw new Error('useRobot must be used within a RobotProvider');
    }
    return context;
}
