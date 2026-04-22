import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/shared/bottom-nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let unreadMessages = 0;
  if (user) {
    const { data } = await supabase
      .from("messages")
      .select("id")
      .eq("to_id", user.id)
      .is("read_at", null);
    unreadMessages = (data ?? []).length;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 pb-[72px]">
        {children}
      </main>
      <BottomNav unreadMessages={unreadMessages} />
    </div>
  );
}
