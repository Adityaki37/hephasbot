import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/20">
            <Sidebar />
            <main className="flex-1 flex flex-col overflow-y-auto relative">
                {/* Background Ambient */}
                <div className="fixed inset-0 z-0 pointer-events-none opacity-20">
                    <div className="absolute top-[10%] right-[10%] w-[30%] h-[30%] bg-blue-500/20 blur-[120px] rounded-full mix-blend-screen" />
                </div>

                <div className="relative z-10 flex-1 p-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
