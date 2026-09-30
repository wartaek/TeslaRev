import { audioProfiles } from '../audio/profile';
import type { GearboxMode } from '../engine/virtualEngine';
export interface Settings { volume: number; profileId: string; gearboxMode: GearboxMode; maxRpm: number }
export const SETTINGS_KEY = 'rev.settings.v1';
export function parseSettings(raw: string | null): Settings {
  const defaults: Settings = { volume: 20, profileId: audioProfiles[0].id, gearboxMode: 'calm', maxRpm: 6500 };
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return defaults;
    return {
      volume: typeof value.volume === 'number' && Number.isFinite(value.volume) ? Math.min(100,Math.max(0,value.volume)) : defaults.volume,
      profileId: audioProfiles.some(p=>p.id===value.profileId) ? value.profileId : defaults.profileId,
      gearboxMode: value.gearboxMode === 'sport' ? 'sport' : 'calm',
      maxRpm: typeof value.maxRpm === 'number' && Number.isFinite(value.maxRpm) ? Math.round(Math.min(7500,Math.max(5500,value.maxRpm))/250)*250 : defaults.maxRpm,
    };
  } catch { return defaults; }
}
export function loadSettings(): Settings {
  try { return parseSettings(localStorage.getItem(SETTINGS_KEY)); } catch { return parseSettings(null); }
}
export function saveSettings(settings: Settings): boolean {
  try { localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings)); return true; } catch { return false; }
}
