"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function SpreadError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Spread error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="text-center p-8 max-w-md">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Spread Error</h2>
        <p className="text-gray-600 mb-6">
          There was an error loading this spread. The page might not exist or
          there could be an issue with the data.
        </p>
        <div className="space-y-3">
          <Button onClick={reset} className="w-full">
            Try again
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/book")}
            className="w-full"
          >
            Back to book
          </Button>
        </div>
      </div>
    </div>
  );
}
