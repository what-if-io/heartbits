// HeartBits app stores — Svelte 5 runes

export interface UserProfile {
  name: string;
  bpm: number;
}

// Current user state
export const currentUser = $state<UserProfile>({ name: 'You', bpm: 72 });

// WebSocket relay state
export const wsRelay = $state<{ socket: WebSocket | null }>({ socket: null });
