import { redirect } from "next/navigation";

// /discover is now /players — permanent redirect for old bookmarks
export default function DiscoverPage() {
  redirect("/players");
}
