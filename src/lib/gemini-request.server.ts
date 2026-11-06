/** Retry only a temporary provider outage, within the caller's original deadline. */
export async function requestGemini(url: string, init: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (response.status !== 503) return response;
  await response.body?.cancel();
  await new Promise((resolve) => setTimeout(resolve, 350));
  init.signal?.throwIfAborted();
  return fetch(url, init);
}
