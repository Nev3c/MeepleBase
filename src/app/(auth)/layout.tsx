export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-12 bg-background">
      {/* Warm background glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(232,130,26,0.10) 0%, transparent 60%)",
        }}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-sm">
        {children}
      </div>
    </div>
  );
}
