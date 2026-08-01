import { Suspense } from "react";

import { YourClientsBookPage } from "@/components/workspace/your-clients-book-page";

export default function YourClientsPage() {
  return (
    <Suspense fallback={null}>
      <YourClientsBookPage />
    </Suspense>
  );
}
