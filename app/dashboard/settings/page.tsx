export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">Settings</h1>
                <p className="text-muted-foreground">Manage your account and preferences.</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-medium mb-4">General Preferences</h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Dark Mode</span>
                        <div className="w-10 h-6 rounded-full bg-primary/20 relative cursor-not-allowed">
                            <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-primary" />
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Auto-Connect to Robots</span>
                        <div className="w-10 h-6 rounded-full bg-primary/20 relative cursor-not-allowed">
                            <div className="absolute right-1 top-1 w-4 h-4 rounded-full bg-primary" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
