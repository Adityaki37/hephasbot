import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, MousePointer2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VisualKeyboardProps {
    onMoveStart: (jointIdx: number, direction: number) => void;
    onMoveStop: () => void;
    className?: string;
}

export function VisualKeyboard({ onMoveStart, onMoveStop, className }: VisualKeyboardProps) {
    const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());

    // UseRef to track active keys for event logic without re-binding listeners
    const keysRef = useRef<Set<string>>(new Set());
    const moveInterval = useRef<NodeJS.Timeout | null>(null);

    // Handle real keyboard input
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (keysRef.current.has(key)) return;

            if (["arrowup", "arrowdown", " "].includes(key)) e.preventDefault();

            keysRef.current.add(key);
            setActiveKeys(new Set(keysRef.current));

            // Trigger movement
            switch (key) {
                case 'a': onMoveStart(0, -1); break;
                case 'd': onMoveStart(0, 1); break;
                case 'w': onMoveStart(1, 1); break;
                case 's': onMoveStart(1, -1); break;
                case 'arrowup': onMoveStart(2, 1); break;
                case 'arrowdown': onMoveStart(2, -1); break;
                case 'q': onMoveStart(3, -1); break;
                case 'e': onMoveStart(3, 1); break;
                case 'z': onMoveStart(4, -1); break;
                case 'c': onMoveStart(4, 1); break;
                case ' ': onMoveStart(5, 1); break;
                case 'shift': onMoveStart(5, -1); break;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (keysRef.current.has(key)) {
                keysRef.current.delete(key);
                setActiveKeys(new Set(keysRef.current));

                // Only stop if NO movement keys are left? 
                // For simplicity, stop manual move on any key up of a movement key.
                // The context handles stop by clearing interval.
                onMoveStop();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []); // Empty dependency = Bind once!

    // Key Button Component
    const KeyBtn = ({
        k,
        label, // Main Action Name (e.g. "SHOULDER UP")
        sub,   // Key Name (e.g. "W")
        icon: Icon,
        joint,
        dir,
        className
    }: {
        k: string,
        label?: string,
        sub?: string,
        icon?: any,
        joint: number,
        dir: number,
        className?: string
    }) => {
        const isActive = activeKeys.has(k.toLowerCase());

        return (
            <button
                onMouseDown={() => onMoveStart(joint, dir)}
                onMouseUp={onMoveStop}
                onMouseLeave={onMoveStop}
                onTouchStart={(e) => { e.preventDefault(); onMoveStart(joint, dir); }}
                onTouchEnd={(e) => { e.preventDefault(); onMoveStop(); }}
                className={cn(
                    "flex flex-col items-center justify-center w-24 h-20 rounded-xl border transition-all duration-75 select-none relative group overflow-hidden",
                    isActive
                        ? "bg-primary border-primary text-black shadow-[0_0_15px_rgba(var(--primary),0.5)] transform scale-95"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-700",
                    className
                )}
            >
                {Icon ? <Icon className="w-8 h-8 mb-1" /> : <span className="text-xs font-bold font-mono uppercase tracking-tighter leading-tight text-center px-1">{label}</span>}
                <div className={cn(
                    "absolute bottom-1 right-2 text-[10px] font-mono opacity-50 border border-current px-1 rounded",
                    isActive ? "border-black/50" : "border-zinc-700"
                )}>
                    {sub || k.toUpperCase()}
                </div>
            </button>
        );
    };

    return (
        <div className={cn("grid grid-cols-2 gap-12 p-8 bg-zinc-950/50 rounded-2xl border border-zinc-900", className)}>

            {/* Left Hand (WASD - Base/Shoulder) */}
            <div className="flex flex-col items-center gap-2">
                <div className="grid grid-cols-3 gap-3">
                    <div />
                    <KeyBtn k="w" label="SHOULDER UP" joint={1} dir={1} />
                    <div />
                    <KeyBtn k="a" label="BASE LEFT" joint={0} dir={-1} />
                    <KeyBtn k="s" label="SHOULDER DOWN" joint={1} dir={-1} />
                    <KeyBtn k="d" label="BASE RIGHT" joint={0} dir={1} />
                </div>
            </div>

            {/* Right Hand (Arrows - Elbow) */}
            <div className="flex flex-col items-center gap-2">
                <div className="grid grid-cols-3 gap-3">
                    <div />
                    <KeyBtn k="arrowup" label="ELBOW UP" icon={ArrowUp} sub="UP" joint={2} dir={1} />
                    <div />
                    <KeyBtn k="arrowleft" label="" joint={-1} dir={0} className="invisible" />
                    <KeyBtn k="arrowdown" label="ELBOW DOWN" icon={ArrowDown} sub="DOWN" joint={2} dir={-1} />
                    <KeyBtn k="arrowright" label="" joint={-1} dir={0} className="invisible" />
                </div>
            </div>

            {/* Extras Row */}
            <div className="col-span-2 grid grid-cols-3 gap-8 border-t border-zinc-800/50 pt-8 mt-2">
                <div className="flex justify-center gap-4">
                    <KeyBtn k="q" label="PITCH DOWN" joint={3} dir={-1} />
                    <KeyBtn k="e" label="PITCH UP" joint={3} dir={1} />
                </div>

                <div className="flex justify-center gap-4">
                    <KeyBtn k="shift" label="OPEN" joint={5} dir={-1} sub="SHIFT" />
                    <KeyBtn k=" " label="CLOSE" joint={5} dir={1} sub="SPACE" />
                </div>

                <div className="flex justify-center gap-4">
                    <KeyBtn k="z" label="ROLL LEFT" joint={4} dir={-1} />
                    <KeyBtn k="c" label="ROLL RIGHT" joint={4} dir={1} />
                </div>
            </div>
        </div>
    );
}
