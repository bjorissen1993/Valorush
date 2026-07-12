/** Fetch a Twitch profile picture URL for a username. */
export async function fetchTwitchAvatar(username: string): Promise<string | undefined> {
  const normalized = username.trim();
  if (!normalized) return undefined;

  try {
    const response = await fetch(
      `https://decapi.me/twitch/avatar/${encodeURIComponent(normalized)}`
    );

    if (!response.ok) return undefined;

    const avatarUrl = (await response.text()).trim();
    if (!avatarUrl || avatarUrl.startsWith("Error")) return undefined;

    return avatarUrl;
  } catch {
    return `https://unavatar.io/twitch/${encodeURIComponent(normalized)}`;
  }
}
