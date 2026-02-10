import { readFileSync } from "fs";
import { join } from "path";

export interface PresetConfig {
  repo: string;
  docsPath: string;
  title: string;
  description: string;
}

export interface PresetRegistry {
  [key: string]: PresetConfig;
}

export interface PresetListItem {
  name: string;
  title: string;
  description: string;
}

/**
 * Load all presets from data/presets.json
 * @returns PresetRegistry - Map of preset names to their configurations
 * @throws Error if presets.json cannot be read or parsed
 */
export function loadPresets(): PresetRegistry {
  try {
    const presetsPath = join(process.cwd(), "data", "presets.json");
    const content = readFileSync(presetsPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load presets: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get a specific preset configuration by name
 * @param name - The preset name (e.g., "react", "django")
 * @returns PresetConfig if found, or null if not found
 * @throws Error if presets cannot be loaded
 */
export function getPreset(name: string): PresetConfig | null {
  const presets = loadPresets();
  return presets[name] || null;
}

/**
 * List all available presets with their names, titles, and descriptions
 * @returns Array of PresetListItem objects sorted alphabetically by name
 * @throws Error if presets cannot be loaded
 */
export function listPresets(): PresetListItem[] {
  const presets = loadPresets();
  const items: PresetListItem[] = Object.entries(presets)
    .map(([name, config]) => ({
      name,
      title: config.title,
      description: config.description,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return items;
}
