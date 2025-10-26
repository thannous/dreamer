/**
 * Dream icon mapping system
 * Maps dreamType strings to appropriate icons based on keyword detection
 */

export type DreamIconType =
  | 'plane'
  | 'brain'
  | 'gear'
  | 'wave'
  | 'star'
  | 'heart'
  | 'bolt'
  | 'eye'
  | 'dream';

interface IconMapping {
  keywords: string[];
  icon: DreamIconType;
}

const ICON_MAPPINGS: IconMapping[] = [
  {
    keywords: ['lucid', 'flying', 'flight', 'soaring', 'fly', 'airplane', 'wings'],
    icon: 'plane',
  },
  {
    keywords: ['mystery', 'mysterious', 'psychology', 'psycho', 'mind', 'thought', 'thinking', 'whisper', 'secret'],
    icon: 'brain',
  },
  {
    keywords: ['clockwork', 'mechanical', 'machine', 'gear', 'steampunk', 'automaton', 'robot', 'cog'],
    icon: 'gear',
  },
  {
    keywords: ['water', 'ocean', 'sea', 'swimming', 'wave', 'underwater', 'aquatic', 'river', 'lake'],
    icon: 'wave',
  },
  {
    keywords: ['cosmic', 'space', 'star', 'galaxy', 'constellation', 'universe', 'celestial', 'astral'],
    icon: 'star',
  },
  {
    keywords: ['love', 'heart', 'emotion', 'peaceful', 'peace', 'calm', 'serene', 'gentle', 'tender', 'romance'],
    icon: 'heart',
  },
  {
    keywords: ['nightmare', 'intense', 'electric', 'lightning', 'bolt', 'storm', 'thunder', 'violent', 'chaos'],
    icon: 'bolt',
  },
  {
    keywords: ['vision', 'seeing', 'eye', 'watching', 'observe', 'revelation', 'prophecy', 'witness'],
    icon: 'eye',
  },
];

/**
 * Determines the appropriate icon for a dream based on its dreamType
 * Uses keyword matching with fallback to default icon
 */
export function getDreamIcon(dreamType: string): DreamIconType {
  if (!dreamType) return 'dream';

  const normalizedType = dreamType.toLowerCase();

  // Find first matching icon based on keywords
  for (const mapping of ICON_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      if (normalizedType.includes(keyword)) {
        return mapping.icon;
      }
    }
  }

  // Default fallback
  return 'dream';
}

/**
 * Returns a readable label for the icon type
 */
export function getIconLabel(iconType: DreamIconType): string {
  const labels: Record<DreamIconType, string> = {
    plane: 'Lucid Dream',
    brain: 'Mysterious',
    gear: 'Mechanical',
    wave: 'Aquatic',
    star: 'Cosmic',
    heart: 'Peaceful',
    bolt: 'Intense',
    eye: 'Vision',
    dream: 'Dream',
  };

  return labels[iconType];
}
