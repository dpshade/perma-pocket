import type { UserProfile, Prompt, PromptMetadata } from '@/types/prompt';

const STORAGE_KEYS = {
  PROFILE: 'permapocket_profile',
  PROMPTS: 'permapocket_prompts',
  THEME: 'permapocket_theme',
} as const;

/**
 * Get user profile from localStorage
 */
export function getProfile(): UserProfile | null {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error reading profile:', error);
    return null;
  }
}

/**
 * Save user profile to localStorage
 */
export function saveProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  } catch (error) {
    console.error('Error saving profile:', error);
  }
}

/**
 * Initialize profile for new user
 */
export function initializeProfile(address: string): UserProfile {
  const profile: UserProfile = {
    address,
    prompts: [],
    lastSync: Date.now(),
  };
  saveProfile(profile);
  return profile;
}

/**
 * Add prompt metadata to profile
 */
export function addPromptToProfile(metadata: PromptMetadata): void {
  const profile = getProfile();
  if (!profile) return;

  // Check if prompt already exists
  const index = profile.prompts.findIndex(p => p.id === metadata.id);
  if (index >= 0) {
    // Update existing
    profile.prompts[index] = metadata;
  } else {
    // Add new
    profile.prompts.unshift(metadata);
  }

  profile.lastSync = Date.now();
  saveProfile(profile);
}

/**
 * Archive prompt (soft delete)
 */
export function archivePrompt(id: string): void {
  const profile = getProfile();
  if (!profile) return;

  const prompt = profile.prompts.find(p => p.id === id);
  if (prompt) {
    prompt.isArchived = true;
    saveProfile(profile);
  }

  // Also update cached prompt
  const cachedPrompts = getCachedPrompts();
  const cachedPrompt = cachedPrompts[id];
  if (cachedPrompt) {
    cachedPrompt.isArchived = true;
    cachePrompt(cachedPrompt);
  }
}

/**
 * Restore archived prompt
 */
export function restorePrompt(id: string): void {
  const profile = getProfile();
  if (!profile) return;

  const prompt = profile.prompts.find(p => p.id === id);
  if (prompt) {
    prompt.isArchived = false;
    saveProfile(profile);
  }

  // Also update cached prompt
  const cachedPrompts = getCachedPrompts();
  const cachedPrompt = cachedPrompts[id];
  if (cachedPrompt) {
    cachedPrompt.isArchived = false;
    cachePrompt(cachedPrompt);
  }
}

/**
 * Get cached prompts from localStorage
 */
export function getCachedPrompts(): Record<string, Prompt> {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROMPTS);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error reading cached prompts:', error);
    return {};
  }
}

/**
 * Cache a single prompt
 */
export function cachePrompt(prompt: Prompt): void {
  try {
    const cached = getCachedPrompts();
    cached[prompt.id] = prompt;
    localStorage.setItem(STORAGE_KEYS.PROMPTS, JSON.stringify(cached));
  } catch (error) {
    console.error('Error caching prompt:', error);
  }
}

/**
 * Get cached prompt by ID
 */
export function getCachedPrompt(id: string): Prompt | null {
  const cached = getCachedPrompts();
  return cached[id] || null;
}

/**
 * Clear all cached prompts (useful for logout)
 */
export function clearCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.PROMPTS);
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
  } catch (error) {
    console.error('Error clearing cache:', error);
  }
}

/**
 * Get theme preference
 */
export function getTheme(): 'light' | 'dark' {
  try {
    const theme = localStorage.getItem(STORAGE_KEYS.THEME);
    return theme === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Save theme preference
 */
export function saveTheme(theme: 'light' | 'dark'): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch (error) {
    console.error('Error saving theme:', error);
  }
}