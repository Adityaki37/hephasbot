import { useEffect, useRef, useState } from 'react';

interface GamepadConfig {
    enabled: boolean;
    onMove: (jointIdx: number, delta: number) => void;
}

export interface GamepadState {
    axes: number[];
    buttons: any[]; // Changed to any to support 'value' property
    connected: boolean;
}

export function useGamepad({ enabled, onMove }: GamepadConfig) {
    const requestRef = useRef<number | undefined>(undefined);
    const lastUpdate = useRef<number>(0);
    const onMoveRef = useRef(onMove);

    // Update ref when onMove changes (avoids resetting effect)
    useEffect(() => {
        onMoveRef.current = onMove;
    }, [onMove]);

    const [gamepadState, setGamepadState] = useState<GamepadState>({
        axes: [],
        buttons: [],
        connected: false
    });

    const updateGamepadStatus = () => {
        // Need to poll even if disabled? No, only enabled. 
        // But what if we want to detect connection while disabled?
        // The requirements say "Visual Gamepad Guide" only active in tab.
        // We will keep loop running if enabled.

        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = gamepads[0]; // Use first gamepad

        if (gp) {
            const now = Date.now();

            // Only update React state if diff? 
            // For now, simple set state. 
            // Note: gp.buttons is an object array, we need to map carefully.
            setGamepadState({
                axes: [...gp.axes],
                buttons: gp.buttons.map(b => ({ pressed: b.pressed, value: b.value })),
                connected: true
            });

            if (enabled && now - lastUpdate.current > 30) {
                lastUpdate.current = now;
                const deadzone = 0.1;
                const cb = onMoveRef.current; // Use Ref

                // LEFT STICK X -> Base (J1)
                if (Math.abs(gp.axes[0]) > deadzone) cb(0, gp.axes[0] * 2);

                // LEFT STICK Y -> Shoulder (J2) (Inverted)
                if (Math.abs(gp.axes[1]) > deadzone) cb(1, -gp.axes[1] * 2);

                // RIGHT STICK Y -> Elbow (J3) (Inverted)
                if (Math.abs(gp.axes[3]) > deadzone) cb(2, -gp.axes[3] * 2);

                // RIGHT STICK X -> Wrist Pitch (J4)
                if (Math.abs(gp.axes[2]) > deadzone) cb(3, gp.axes[2] * 2);

                // WRIST ROLL (Bumpers)
                if (gp.buttons[4].pressed) cb(4, -2);
                if (gp.buttons[5].pressed) cb(4, 2);

                // GRIPPER (Triggers)
                const l2 = gp.buttons[6].value;
                const r2 = gp.buttons[7].value;
                if (l2 > deadzone) cb(5, -l2 * 3);
                if (r2 > deadzone) cb(5, r2 * 3);
            }
        } else {
            // Not connected
            setGamepadState(prev => prev.connected ? { ...prev, connected: false } : prev);
        }

        requestRef.current = requestAnimationFrame(updateGamepadStatus);
    };

    useEffect(() => {
        if (enabled) {
            requestRef.current = requestAnimationFrame(updateGamepadStatus);
        }
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [enabled]); // Removed onMove dependency

    return gamepadState;
}
