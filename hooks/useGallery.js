import useSWR from "swr"

const fetcher = (url) => fetch(url).then((res) => res.json())

export function useGallery() {
  const { data, error, isLoading } = useSWR("/api/seksi-galeri", fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000, // 1 minute deduping
    focusThrottleInterval: 300000, // 5 minutes focus throttle
    errorRetryCount: 2,
    errorRetryInterval: 5000,
  })

  return {
    galleryData: data?.data || [],
    loading: isLoading,
    error: error ? "Failed to load gallery data" : null,
  }
}
