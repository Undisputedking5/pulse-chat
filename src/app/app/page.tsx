import { Suspense } from "react";
import ChatsView from "@/components/ChatsView";

export default function Page() {
  return (
    <Suspense>
      <ChatsView />
    </Suspense>
  );
}
