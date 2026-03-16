import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import clsx from "clsx";

export default function BackendStatus() {
  const { data: isHealthy, isLoading } = useQuery({
    queryKey: ["backend-health"],
    queryFn: () => apiClient.health(),
    refetchInterval: 10_000,
    retry: false,
  });

  return (
    <div className="flex items-center gap-1.5 text-xs text-surface-500">
      <span
        className={clsx(
          "w-1.5 h-1.5 rounded-full transition-colors",
          isLoading
            ? "bg-yellow-500 animate-pulse"
            : isHealthy
              ? "bg-green-500"
              : "bg-red-500"
        )}
      />
      <span>
        {isLoading ? "連線中..." : isHealthy ? "後端運作中" : "後端未連線"}
      </span>
    </div>
  );
}
