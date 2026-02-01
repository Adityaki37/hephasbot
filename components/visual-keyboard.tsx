import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface VisualKeyboardProps {
    onMoveStart: (jointIdx: number, direction: number) => void;
    onMoveStop: () => void;
    scale?: number; // Scale factor (1 = normal, 1.5 = 150%, etc.)
    className?: string;
}

export function VisualKeyboard({ onMoveStart, onMoveStop, scale = 1, className }: VisualKeyboardProps) {
    const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
    const keysRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (keysRef.current.has(key)) return;

            if (["arrowup", "arrowdown", " "].includes(key)) e.preventDefault();

            keysRef.current.add(key);
            setActiveKeys(new Set(keysRef.current));

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
                onMoveStop();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // Calculate button sizes based on scale
    const btnWidth = Math.round(64 * scale); // base 64px (w-16)
    const btnHeight = Math.round(56 * scale); // base 56px (h-14)
    const gap = Math.round(4 * scale); // base 4px (gap-1)
    const fontSize = Math.max(8, Math.round(9 * scale));
    const iconSize = Math.round(20 * scale);

    const KeyBtn = ({
        k,
        label,
        sub,
        icon: Icon,
        joint,
        dir,
        btnClassName
    }: {
        k: string,
        label?: string,
        sub?: string,
        icon?: any,
        joint: number,
        dir: number,
        btnClassName?: string
    }) => {
        const isActive = activeKeys.has(k.toLowerCase());

        return (
            <button
                onMouseDown={() => onMoveStart(joint, dir)}
                onMouseUp={onMoveStop}
                onMouseLeave={onMoveStop}
                onTouchStart={(e) => { e.preventDefault(); onMoveStart(joint, dir); }}
                onTouchEnd={(e) => { e.preventDefault(); onMoveStop(); }}
                style={{
                    width: `${btnWidth}px`,
                    height: `${btnHeight}px`,
                    fontSize: `${fontSize}px`
                }}
                className={cn(
                    "flex flex-col items-center justify-center rounded-xl border transition-all duration-75 select-none relative overflow-hidden",
                    isActive
                        ? "bg-primary border-primary text-black shadow-[0_0_15px_rgba(var(--primary),0.5)] scale-95"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-700",
                    btnClassName
                )}
            >
                {Icon ? (
                    <Icon style={{ width: `${iconSize}px`, height: `${iconSize}px` }} className="mb-0.5" />
                ) : (
                    <span className="font-bold font-mono uppercase tracking-tighter leading-tight text-center px-0.5">{label}</span>
                )}
                <div
                    style={{ fontSize: `${Math.max(6, fontSize - 2)}px` }}
                    className={cn(
                        "absolute bottom-0.5 right-0.5 font-mono opacity-50 border border-current px-0.5 rounded",
                        isActive ? "border-black/50" : "border-zinc-700"
                    )}
                >
                    {sub || k.toUpperCase()}
                </div>
            </button>
        );
    };

    // Spacer with same size as button
    const Spacer = () => <div style={{ width: `${btnWidth}px`, height: `${btnHeight}px` }} />;

    return (
        <div
            className={cn("flex flex-col items-center bg-zinc-950/50 rounded-2xl border border-zinc-900", className)}
            style={{ padding: `${Math.round(16 * scale)}px`, gap: `${Math.round(24 * scale)}px` }}
        >
            {/* Top Row: WASD and Arrows */}
            <div className="flex" style={{ gap: `${Math.round(32 * scale)}px` }}>
                {/* Left Hand (WASD) */}
                <div className="flex flex-col items-center" style={{ gap: `${gap}px` }}>
                    <div className="flex" style={{ gap: `${gap}px` }}>
                        <Spacer />
                        <KeyBtn k="w" label="SHOULDER UP" joint={1} dir={1} />
                        <Spacer />
                    </div>
                    <div className="flex" style={{ gap: `${gap}px` }}>
                        <KeyBtn k="a" label="BASE LEFT" joint={0} dir={-1} />
                        <KeyBtn k="s" label="SHOULDER DN" joint={1} dir={-1} />
                        <KeyBtn k="d" label="BASE RIGHT" joint={0} dir={1} />
                    </div>
                </div>

                {/* Right Hand (Arrows) */}
                <div className="flex flex-col items-center" style={{ gap: `${gap}px` }}>
                    <div className="flex" style={{ gap: `${gap}px` }}>
                        <Spacer />
                        <KeyBtn k="arrowup" label="UP" icon={ArrowUp} sub="UP" joint={2} dir={1} />
                        <Spacer />
                    </div>
                    <div className="flex" style={{ gap: `${gap}px` }}>
                        <Spacer />
                        <KeyBtn k="arrowdown" label="DOWN" icon={ArrowDown} sub="DOWN" joint={2} dir={-1} />
                        <Spacer />
                    </div>
                </div>
            </div>

            {/* Bottom Row: Extra Controls */}
            <div
                className="flex border-t border-zinc-800/50"
                style={{ gap: `${gap}px`, paddingTop: `${Math.round(16 * scale)}px` }}
            >
                <KeyBtn k="q" label="PITCH DN" joint={3} dir={-1} />
                <KeyBtn k="e" label="PITCH UP" joint={3} dir={1} />
                <KeyBtn k="shift" label="OPEN" joint={5} dir={-1} sub="SHIFT" />
                <KeyBtn k=" " label="CLOSE" joint={5} dir={1} sub="SPACE" />
                <KeyBtn k="z" label="ROLL L" joint={4} dir={-1} />
                <KeyBtn k="c" label="ROLL R" joint={4} dir={1} />
            </div>
        </div>
    );
}
