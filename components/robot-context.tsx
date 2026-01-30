"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { RobotDriver } from '@/lib/web-serial-driver';

type CalibrationState = 'unc' | 'cal' | 'rdy';

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
}

const RobotContext = createContext<RobotContextType | undefined>(undefined);

export function RobotProvider({ children }: { children: React.ReactNode }) {
    const driverRef = useRef<RobotDriver | null>(null);
    const [connected, setConnected] = useState(false);
    const [calibrationState, setCalibrationState] = useState<CalibrationState>('unc');
    const [logs, setLogs] = useState<string[]>([]);
    const [jointVals, setJointVals] = useState<number[]>([0, 0, 0, 0, 0, 0]);

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
        const poll = async () => {
            if (active && driverRef.current && connected) {
                // If calibrating, we want to read positions to update Min/Max
                if (calibrationState === 'cal') {
                    for (let i = 0; i < 6; i++) {
                        const val = await driverRef.current.readPosition(i + 1);
                        if (val !== -1) {
                            setCalibrationLimits(prev => {
                                const next = [...prev];
                                const currentMin = next[i].min;
                                const currentMax = next[i].max;

                                // Update limits if outside current range
                                // (Initialize min/max on first read effectively done by startCalibration reset)
                                if (val < currentMin) next[i].min = val;
                                if (val > currentMax) next[i].max = val;
                                return next;
                            });
                        }
                        // Small delay to prevent bus saturation
                        await new Promise(r => setTimeout(r, 2));
                    }
                }
            }
            if (active) requestAnimationFrame(poll); // Loop
            // Note: In real app, might want slower poll than RAF for serial
        };

        // Use a timeout loop instead of RAF for serial stability
        const interval = setInterval(async () => {
            if (driverRef.current && connected && calibrationState === 'cal') {
                // Clone logic from above for interval
                for (let i = 0; i < 6; i++) {
                    try {
                        const val = await driverRef.current.readPosition(i + 1);
                        if (val !== -1) {
                            setCalibrationLimits(prev => {
                                const next = [...prev];
                                if (val < next[i].min) next[i].min = val;
                                if (val > next[i].max) next[i].max = val;
                                return next;
                            });
                        }
                    } catch (e) { }
                }
            }
        }, 100); // 10Hz poll during calibration

        return () => { active = false; clearInterval(interval); };
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

        // Reset limits to inverted values so first read sets them
        setCalibrationLimits(Array(6).fill({ min: 4095, max: 0 }));

        setCalibrationState('cal');
    };

    const finishCalibration = async () => {
        addLog("Finishing Calibration - Enabling Torque...");
        await enableTorqueAll();
        setCalibrationState('rdy');

        // Reset JointVals to center (0) visually
        setJointVals([0, 0, 0, 0, 0, 0]);
    };

    // Absolute Move (-100 to 100) based on Calibrated Range
    const moveJoint = async (jointIdx: number, value: number) => {
        if (!driverRef.current || calibrationState !== 'rdy') return;

        const limit = calibrationLimits[jointIdx];
        const range = limit.max - limit.min;

        // Map -100..100 to Min..Max
        // Value 0 => Min + Range/2
        // Value -100 => Min
        // Value 100 => Max

        // Normalized (0..1) = (value + 100) / 200
        const normalized = (value + 100) / 200;
        const targetPos = Math.floor(limit.min + (normalized * range));

        // Clamp for safety
        const clampedPos = Math.max(limit.min, Math.min(limit.max, targetPos));

        await driverRef.current.setPosition(jointIdx + 1, clampedPos);

        setJointVals(prev => {
            const next = [...prev];
            next[jointIdx] = value;
            return next;
        });
    };

    // Relative Move (Percent Change)
    const moveJointRel = async (jointIdx: number, percentChange: number) => {
        const currentVal = jointVals[jointIdx];
        // Input percentChange is usually +/- 5 (representing 5%)
        // But wait, our sliders are -100 to 100.
        // Range of slider is 200 units.
        // 5% of Range means 5% of physical motion or 5% of slider?
        // User said: "moves forward by 5% of the range of motion for that joint"
        // So if range is 1000 ticks. 5% is 50 ticks.
        // In slider space (-100 to 100), range is 200. 5% is 10 units.

        const delta = (percentChange / 100) * 200; // e.g. 0.05 * 200 = 10
        const nextVal = Math.min(Math.max(currentVal + delta, -100), 100);

        await moveJoint(jointIdx, nextVal);
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
            moveJointRel
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
