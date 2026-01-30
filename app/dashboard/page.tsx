export default function DashboardPage() {
    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Dashboard</h1>
                <p className="text-muted-foreground">Manage your fleet and start sessions.</p>
            </div>

            {/* Quick Actions / Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm shadow-sm hover:border-primary/50 transition-colors group cursor-pointer">
                    <h3 className="font-medium text-muted-foreground mb-4">Active Robots</h3>
                    <div className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 group-hover:from-primary group-hover:to-blue-500 transition-all">
                        0
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">No robots connected</p>
                </div>

                <div className="p-6 rounded-xl border border-border bg-card/50 backdrop-blur-sm shadow-sm hover:border-primary/50 transition-colors group cursor-pointer">
                    <h3 className="font-medium text-muted-foreground mb-4">Total Sessions</h3>
                    <div className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60 group-hover:from-primary group-hover:to-blue-500 transition-all">
                        0
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Start your first session</p>
                </div>

                <div className="p-6 rounded-xl border border-dashed border-border bg-transparent hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-4 cursor-pointer text-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <span className="text-2xl">+</span>
                    </div>
                    <div>
                        <h3 className="font-semibold">Connect Robot</h3>
                        <p className="text-sm text-muted-foreground">Plug & Play setup</p>
                    </div>
                </div>
            </div>

            {/* Recent Activity Mockup */}
            <div className="rounded-xl border border-border bg-card/30 backdrop-blur-sm overflow-hidden">
                <div className="p-6 border-b border-border/50">
                    <h3 className="font-semibold">Recent Activity</h3>
                </div>
                <div className="p-12 text-center text-muted-foreground text-sm">
                    No recent activity found. Connect a robot to get started.
                </div>
            </div>
        </div>
    )
}
