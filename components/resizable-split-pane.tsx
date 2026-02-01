import { useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResizableSplitPaneProps {
    left: ReactNode;
    right: ReactNode;
    defaultLeftWidth?: number; // percentage 0-100
    minLeftWidth?: number; // percentage
    maxLeftWidth?: number; // percentage
    className?: string;
    onResize?: (leftWidth: number) => void;
}

export function ResizableSplitPane({
    left,
    right,
    defaultLeftWidth = 50,
    minLeftWidth = 30,
    maxLeftWidth = 70,
    className,
    onResize
}: ResizableSplitPaneProps) {
    const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !containerRef.current) return;

        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const newWidth = Math.min(maxLeftWidth, Math.max(minLeftWidth, (x / rect.width) * 100));

        setLeftWidth(newWidth);
        onResize?.(newWidth);
    }, [isDragging, minLeftWidth, maxLeftWidth, onResize]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <div
            ref={containerRef}
            className={cn("flex h-full w-full", className)}
        >
            {/* Left Panel */}
            <div
                className="flex-shrink-0 min-w-0"
                style={{ width: `${leftWidth}%` }}
            >
                {left}
            </div>

            {/* Resizer Handle */}
            <div
                onMouseDown={handleMouseDown}
                className={cn(
                    "flex-shrink-0 w-3 flex items-center justify-center cursor-col-resize group hover:bg-zinc-700/30 transition-colors",
                    isDragging && "bg-zinc-700/50"
                )}
            >
                <div className={cn(
                    "w-1 h-16 rounded-full bg-zinc-700 group-hover:bg-zinc-500 transition-colors flex items-center justify-center",
                    isDragging && "bg-primary"
                )}>
                    <GripVertical className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300" />
                </div>
            </div>

            {/* Right Panel */}
            <div
                className="flex-1 overflow-hidden"
            >
                {right}
            </div>
        </div>
    );
}
