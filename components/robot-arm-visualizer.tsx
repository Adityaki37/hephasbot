import React from 'react';
import { cn } from "@/lib/utils";

interface RobotArmVisualizerProps {
    highlightedId?: number | null;
}

export function RobotArmVisualizer({ highlightedId }: RobotArmVisualizerProps) {
    // Helper to render a joint indicator
    const renderJointLabel = (id: number, x: number, y: number, label: string) => {
        const isHighlighted = highlightedId === id;
        return (
            <g className="cursor-default group">
                <circle
                    cx={x}
                    cy={y}
                    r={isHighlighted ? 14 : 10}
                    className={cn(
                        "transition-all duration-300",
                        isHighlighted ? "fill-primary stroke-white stroke-2" : "fill-zinc-800 stroke-zinc-600 hover:fill-zinc-700"
                    )}
                />
                <text
                    x={x}
                    y={y}
                    dy={4}
                    textAnchor="middle"
                    className={cn(
                        "text-[10px] font-bold pointer-events-none select-none transition-colors",
                        isHighlighted ? "fill-white" : "fill-zinc-400"
                    )}
                >
                    {id}
                </text>

                {/* Tooltip-like label on hover (SVG title) */}
                <title>{label}</title>
            </g>
        );
    };

    return (
        <div className="w-full h-64 bg-zinc-950/50 rounded-lg border border-zinc-800 flex items-center justify-center relative overflow-hidden">
            {/* Grid Background */}
            <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            </div>

            <svg width="300" height="200" viewBox="0 0 300 200" className="drop-shadow-lg z-10">
                {/* --- ROBOT ARM SCHEMATIC (Side View) --- */}

                {/* Base (Static) */}
                <path d="M 50 180 L 100 180 L 90 160 L 60 160 Z" className="fill-zinc-800 stroke-zinc-700 stroke-2" />

                {/* Joint 1: Base Rotation */}
                <rect x="65" y="150" width="20" height="10" rx="2" className="fill-zinc-600" />

                {/* Link 1: Base to Shoulder */}
                <path d="M 75 155 L 75 120" className="stroke-zinc-500 stroke-[8] rounded-full" />

                {/* Joint 2: Shoulder */}
                <circle cx="75" cy="120" r="12" className="fill-zinc-700 stroke-zinc-600" />

                {/* Link 2: Shoulder to Elbow */}
                <path d="M 75 120 L 140 80" className="stroke-zinc-500 stroke-[6] rounded-full" />

                {/* Joint 3: Elbow */}
                <circle cx="140" cy="80" r="10" className="fill-zinc-700 stroke-zinc-600" />

                {/* Link 3: Elbow to Wrist */}
                <path d="M 140 80 L 210 80" className="stroke-zinc-500 stroke-[5] rounded-full" />

                {/* Joint 4: Wrist Flex */}
                <rect x="205" y="72" width="12" height="16" rx="2" className="fill-zinc-700 stroke-zinc-600" />

                {/* Link 4: Wrist Section */}
                <path d="M 217 80 L 240 80" className="stroke-zinc-500 stroke-[4]" />

                {/* Joint 5: Wrist Roll (Cylinder representation) */}
                <rect x="235" y="74" width="15" height="12" rx="1" className="fill-zinc-700 stroke-zinc-600" />

                {/* Joint 6: Gripper Base */}
                <path d="M 250 80 L 265 80" className="stroke-zinc-500 stroke-[3]" />

                {/* Gripper Jaws */}
                <path d="M 265 80 L 280 70 M 265 80 L 280 90" className="stroke-zinc-500 stroke-[2]" />

                {/* --- JOINT INDICATORS --- */}
                {renderJointLabel(1, 75, 165, "J1: Base Pan")}
                {renderJointLabel(2, 75, 120, "J2: Shoulder Lift")}
                {renderJointLabel(3, 140, 80, "J3: Elbow Flex")}
                {renderJointLabel(4, 211, 65, "J4: Wrist Flex")}
                {renderJointLabel(5, 242, 65, "J5: Wrist Roll")}
                {renderJointLabel(6, 275, 80, "J6: Gripper")}

            </svg>

            <div className="absolute bottom-2 right-2 text-[10px] text-zinc-500 font-mono">
                Visual Reference
            </div>
        </div>
    );
}
