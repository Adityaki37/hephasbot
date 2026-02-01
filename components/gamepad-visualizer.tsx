import { GamepadState } from "@/hooks/use-gamepad";
import { cn } from "@/lib/utils";

interface GamepadVisualizerProps {
    state: GamepadState;
    scale?: number; // Scale factor (1 = normal, 1.5 = 150%, etc.)
    className?: string;
}

export function GamepadVisualizer({ state, scale = 1, className }: GamepadVisualizerProps) {
    const { axes = [], buttons = [] } = state;

    const isAxisActive = (idx: number, dir: number) => {
        const val = axes[idx] || 0;
        return dir > 0 ? val > 0.5 : val < -0.5;
    };

    const isBtnPressed = (idx: number) => {
        if (!buttons || !buttons[idx]) return false;
        const btn = buttons[idx] as any;
        return typeof btn === 'object' ? btn.pressed : btn;
    };

    const getBtnValue = (idx: number) => {
        if (!buttons || !buttons[idx]) return 0;
        const btn = buttons[idx] as any;
        return typeof btn === 'object' ? btn.value : (btn ? 1 : 0);
    }

    // Calculate sizes based on scale
    const btnWidth = Math.round(70 * scale); // base 70px
    const btnHeight = Math.round(48 * scale); // base 48px
    const gap = Math.round(4 * scale);
    const fontSize = Math.max(7, Math.round(8 * scale));

    const GridBtn = ({
        label,
        sub,
        active,
        btnClassName
    }: {
        label: string,
        sub: string,
        active: boolean,
        btnClassName?: string
    }) => (
        <div
            style={{
                width: `${btnWidth}px`,
                height: `${btnHeight}px`,
                fontSize: `${fontSize}px`
            }}
            className={cn(
                "flex flex-col items-center justify-center rounded-xl border transition-all duration-75 select-none relative overflow-hidden",
                active
                    ? "bg-blue-500 border-blue-500 text-black shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-95"
                    : "bg-zinc-900 border-zinc-800 text-zinc-400 opacity-80",
                btnClassName
            )}
        >
            <span className="font-bold font-mono uppercase tracking-tighter leading-tight text-center px-0.5">{label}</span>
            <div
                style={{ fontSize: `${Math.max(6, fontSize - 2)}px` }}
                className={cn(
                    "absolute bottom-0.5 right-0.5 font-mono opacity-50 border border-current px-0.5 rounded",
                    active ? "border-black/50" : "border-zinc-700"
                )}
            >
                {sub}
            </div>
        </div>
    );

    const Spacer = () => <div style={{ width: `${btnWidth}px`, height: `${btnHeight}px` }} />;

    return (
        <div
            className={cn("flex flex-col items-center bg-zinc-950/50 rounded-2xl border border-zinc-900", className)}
            style={{ padding: `${Math.round(20 * scale)}px`, gap: `${Math.round(24 * scale)}px` }}
        >
            {/* Top Row: Sticks */}
            <div className="flex" style={{ gap: `${Math.round(40 * scale)}px` }}>
                {/* Left Stick */}
                <div className="flex flex-col items-center" style={{ gap: `${gap}px` }}>
                    <div className="flex" style={{ gap: `${gap}px` }}>
                        <Spacer />
                        <GridBtn label="SHOULDER UP" sub="L-STICK UP" active={isAxisActive(1, -1)} />
                        <Spacer />
                    </div>
                    <div className="flex" style={{ gap: `${gap}px` }}>
                        <GridBtn label="BASE LEFT" sub="L-STICK L" active={isAxisActive(0, -1)} />
                        <GridBtn label="SHOULDER DN" sub="L-STICK DN" active={isAxisActive(1, 1)} />
                        <GridBtn label="BASE RIGHT" sub="L-STICK R" active={isAxisActive(0, 1)} />
                    </div>
                </div>

                {/* Right Stick */}
                <div className="flex flex-col items-center" style={{ gap: `${gap}px` }}>
                    <div className="flex" style={{ gap: `${gap}px` }}>
                        <Spacer />
                        <GridBtn label="ELBOW UP" sub="R-STICK UP" active={isAxisActive(3, -1)} />
                        <Spacer />
                    </div>
                    <div className="flex" style={{ gap: `${gap}px` }}>
                        <Spacer />
                        <GridBtn label="ELBOW DOWN" sub="R-STICK DN" active={isAxisActive(3, 1)} />
                        <Spacer />
                    </div>
                </div>
            </div>

            {/* Bottom Row: Buttons */}
            <div
                className="flex border-t border-zinc-800/50"
                style={{ gap: `${gap}px`, paddingTop: `${Math.round(16 * scale)}px` }}
            >
                <GridBtn label="PITCH DN" sub="A/X" active={isBtnPressed(0)} />
                <GridBtn label="PITCH UP" sub="Y/△" active={isBtnPressed(3)} />
                <GridBtn label="OPEN" sub="LT" active={getBtnValue(6) > 0.5} />
                <GridBtn label="CLOSE" sub="RT" active={getBtnValue(7) > 0.5} />
                <GridBtn label="ROLL L" sub="LB" active={isBtnPressed(4)} />
                <GridBtn label="ROLL R" sub="RB" active={isBtnPressed(5)} />
            </div>
        </div>
    );
}
