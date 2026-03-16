import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, type TTSJob } from "@/lib/apiClient";

const POLL_INTERVAL = 1500; // ms

/**
 * 追蹤 TTS Job 狀態，自動輪詢直到完成或失敗
 */
export function useTTSJob(jobId: string | null) {
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const query = useQuery<TTSJob>({
    queryKey: ["tts-job", jobId],
    queryFn: () => apiClient.tts.getJob(jobId!),
    enabled: !!jobId,
    staleTime: 0,
  });

  // 輪詢：job 未完成時每隔 1.5s 重新取得
  useEffect(() => {
    if (!jobId) return;
    if (!query.data) return;

    const status = query.data.status;
    if (status === "done" || status === "error") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // queued 或 processing — 開始輪詢
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["tts-job", jobId] });
      }, POLL_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId, query.data?.status, queryClient]);

  // jobId 變更時清除舊輪詢
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [jobId]);

  return query;
}
