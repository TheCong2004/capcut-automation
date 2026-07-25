export type ThemeName = 'midnight' | 'aurora' | 'sunset' | 'ocean' | 'forest' | 'candy';
export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  primary: string;
  primaryForeground: string;
  accent: string;
  accentForeground: string;
}

export interface GradientColors {
  from: string;
  via?: string;
  to: string;
}

export interface Theme {
  name: ThemeName;
  label: string;
  emoji: string;
  gradient: {
    light: GradientColors;
    dark: GradientColors;
  };
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
  };
}

/**
 * North accent palettes for the settings theme picker.
 * Surfaces (background/card/border) come from index.css; these only shift primary/accent.
 * Default product accent is teal (aurora / :root).
 */
export const themes: Theme[] = [
  {
    name: 'aurora',
    label: 'North',
    emoji: '◆',
    gradient: {
      light: { from: '168 70% 40%', via: '175 65% 42%', to: '185 55% 40%' },
      dark: { from: '168 70% 42%', via: '175 65% 44%', to: '185 55% 40%' },
    },
    colors: {
      light: {
        primary: '168 70% 36%',
        primaryForeground: '0 0% 100%',
        accent: '168 30% 94%',
        accentForeground: '168 70% 24%',
      },
      dark: {
        primary: '168 70% 48%',
        primaryForeground: '222 20% 6%',
        accent: '168 30% 14%',
        accentForeground: '168 70% 72%',
      },
    },
  },
  {
    name: 'ocean',
    label: 'Ocean',
    emoji: '◇',
    gradient: {
      light: { from: '198 78% 42%', via: '200 72% 44%', to: '210 65% 44%' },
      dark: { from: '190 75% 44%', via: '198 72% 46%', to: '210 60% 44%' },
    },
    colors: {
      light: {
        primary: '198 78% 40%',
        primaryForeground: '0 0% 100%',
        accent: '198 50% 94%',
        accentForeground: '198 78% 24%',
      },
      dark: {
        primary: '190 80% 52%',
        primaryForeground: '222 20% 6%',
        accent: '198 35% 15%',
        accentForeground: '190 80% 78%',
      },
    },
  },
  {
    name: 'forest',
    label: 'Forest',
    emoji: '▣',
    gradient: {
      light: { from: '148 55% 36%', via: '156 55% 38%', to: '164 50% 36%' },
      dark: { from: '148 55% 38%', via: '156 55% 40%', to: '164 50% 38%' },
    },
    colors: {
      light: {
        primary: '152 60% 34%',
        primaryForeground: '0 0% 100%',
        accent: '150 40% 94%',
        accentForeground: '152 60% 22%',
      },
      dark: {
        primary: '152 58% 48%',
        primaryForeground: '222 20% 6%',
        accent: '150 30% 14%',
        accentForeground: '152 58% 76%',
      },
    },
  },
  {
    name: 'midnight',
    label: 'Violet',
    emoji: '◈',
    gradient: {
      light: { from: '262 70% 50%', via: '270 65% 52%', to: '280 60% 50%' },
      dark: { from: '262 60% 48%', via: '270 65% 52%', to: '280 55% 48%' },
    },
    colors: {
      light: {
        primary: '262 70% 52%',
        primaryForeground: '0 0% 100%',
        accent: '270 40% 95%',
        accentForeground: '262 70% 28%',
      },
      dark: {
        primary: '270 72% 68%',
        primaryForeground: '222 20% 6%',
        accent: '270 30% 16%',
        accentForeground: '270 72% 84%',
      },
    },
  },
  {
    name: 'sunset',
    label: 'Ember',
    emoji: '◉',
    gradient: {
      light: { from: '20 90% 50%', via: '28 88% 50%', to: '36 80% 48%' },
      dark: { from: '20 85% 46%', via: '28 88% 50%', to: '36 80% 46%' },
    },
    colors: {
      light: {
        primary: '24 90% 48%',
        primaryForeground: '0 0% 100%',
        accent: '28 90% 95%',
        accentForeground: '24 90% 28%',
      },
      dark: {
        primary: '28 92% 56%',
        primaryForeground: '222 20% 6%',
        accent: '24 40% 16%',
        accentForeground: '28 92% 78%',
      },
    },
  },
  {
    name: 'candy',
    label: 'Rose',
    emoji: '◍',
    gradient: {
      light: { from: '330 70% 50%', via: '338 68% 52%', to: '348 65% 50%' },
      dark: { from: '330 65% 48%', via: '338 65% 50%', to: '348 60% 48%' },
    },
    colors: {
      light: {
        primary: '330 70% 48%',
        primaryForeground: '0 0% 100%',
        accent: '330 50% 96%',
        accentForeground: '330 70% 28%',
      },
      dark: {
        primary: '330 72% 62%',
        primaryForeground: '222 20% 6%',
        accent: '330 28% 15%',
        accentForeground: '330 72% 84%',
      },
    },
  },
];

export const getTheme = (name: ThemeName): Theme => {
  return themes.find((t) => t.name === name) || themes[0];
};
