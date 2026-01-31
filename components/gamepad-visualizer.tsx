import { GamepadState } from "@/hooks/use-gamepad";
import { cn } from "@/lib/utils";

interface GamepadVisualizerProps {
    state: GamepadState;
    className?: string;
}

export function GamepadVisualizer({ state, className }: GamepadVisualizerProps) {
    const { axes = [], buttons = [] } = state;

    // Helper to get axis value
    // Axes: 0=LeftX, 1=LeftY, 2=RightX, 3=RightY
    // Check if "Active" means significant axis move or pressed button
    const isAxisActive = (idx: number, dir: number) => {
        const val = axes[idx] || 0;
        return dir > 0 ? val > 0.5 : val < -0.5;
    };

    // Safety check for buttons array (sometimes undefined/empty initially)
    // Safety check for buttons array (sometimes undefined/empty initially)
    const isBtnPressed = (idx: number) => {
        if (!buttons || !buttons[idx]) return false;
        const btn = buttons[idx] as any; // Cast to avoid strict type issues
        return typeof btn === 'object' ? btn.pressed : btn;
    };

    // Check Trigger value (Button 6/7)
    const getBtnValue = (idx: number) => {
        if (!buttons || !buttons[idx]) return 0;
        const btn = buttons[idx] as any;
        return typeof btn === 'object' ? btn.value : (btn ? 1 : 0);
    }

    // Grid Item Component
    const GridBtn = ({
        label,
        sub,
        active,
        className
    }: {
        label: string,
        sub: string,
        active: boolean,
        className?: string
    }) => (
        <div className={cn(
            "flex flex-col items-center justify-center w-24 h-20 rounded-xl border transition-all duration-75 select-none relative group overflow-hidden",
            active
                ? "bg-blue-500 border-blue-500 text-black shadow-[0_0_15px_rgba(59,130,246,0.5)] transform scale-95"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 opacity-80",
            className
        )}>
            <span className="text-xs font-bold font-mono uppercase tracking-tighter leading-tight text-center px-1">{label}</span>
            <div className={cn(
                "absolute bottom-1 right-2 text-[10px] font-mono opacity-50 border border-current px-1 rounded",
                active ? "border-black/50" : "border-zinc-700"
            )}>
                {sub}
            </div>
        </div>
    );

    return (
        <div className={cn("grid grid-cols-1 lg:grid-cols-3 gap-8 p-8 bg-zinc-950/50 rounded-2xl border border-zinc-900", className)}>

            {/* COLUMN 1: LEFT STICK & PITCH */}
            <div className="flex flex-col items-center gap-8">
                {/* Stick */}
                <div className="flex flex-col items-center gap-2">
                    <div className="grid grid-cols-3 gap-3">
                        <div />
                        <GridBtn label="SHOULDER UP" sub="L-STICK UP" active={isAxisActive(1, -1)} />
                        <div />
                        <GridBtn label="BASE LEFT" sub="L-STICK LEFT" active={isAxisActive(0, -1)} />
                        <GridBtn label="SHOULDER DOWN" sub="L-STICK DOWN" active={isAxisActive(1, 1)} />
                        <GridBtn label="BASE RIGHT" sub="L-STICK RIGHT" active={isAxisActive(0, 1)} />
                    </div>
                </div>

                {/* Pitch Controls (Aligned under Left Stick) */}
                <div className="flex justify-center gap-4 border-t border-zinc-800/50 pt-4 w-full">
                    <GridBtn label="PITCH DOWN" sub="BTN A/X" active={isBtnPressed(0)} />
                    <GridBtn label="PITCH UP" sub="BTN Y/△" active={isBtnPressed(3)} />
                </div>
            </div>

            {/* COLUMN 2: GRIPPER (CENTER) */}
            <div className="flex flex-col items-center justify-center gap-8">
                <div className="hidden lg:block h-24" /> {/* Spacer to align with sticks somewhat if needed, or just center vertically */}
                <div className="flex flex-col gap-4">
                    <GridBtn label="OPEN" sub="LT" active={getBtnValue(6) > 0.5} />
                    <GridBtn label="CLOSE" sub="RT" active={getBtnValue(7) > 0.5} />
                </div>
            </div>

            {/* COLUMN 3: RIGHT STICK & ROLL */}
            <div className="flex flex-col items-center gap-8">
                {/* Stick */}
                <div className="flex flex-col items-center gap-2">
                    <div className="grid grid-cols-3 gap-3">
                        <div />
                        <GridBtn label="ELBOW UP" sub="R-STICK UP" active={isAxisActive(3, -1)} />
                        <div />
                        <GridBtn label="" sub="" active={false} className="invisible" />
                        <GridBtn label="ELBOW DOWN" sub="R-STICK DOWN" active={isAxisActive(3, 1)} />
                        <GridBtn label="" sub="" active={false} className="invisible" />
                    </div>
                </div>

                {/* Roll Controls (Aligned under Right Stick) */}
                <div className="flex justify-center gap-4 border-t border-zinc-800/50 pt-4 w-full">
                    <GridBtn label="ROLL LEFT" sub="LB" active={isBtnPressed(4)} />
                    <GridBtn label="ROLL RIGHT" sub="RB" active={isBtnPressed(5)} />
                </div>
            </div>

        </div>
    );
}
