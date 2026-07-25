import { Check, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTheme } from '@/contexts/ThemeContext';
import type { ThemeName } from '@/lib/themes';
import { themes } from '@/lib/themes';
import { cn } from '@/lib/utils';

/** Solid North swatches from theme primary (dark) values — no multi-stop brand gradients */
const themeSwatches: Record<ThemeName, string> = {
  aurora: 'bg-[hsl(168_70%_48%)]',
  ocean: 'bg-[hsl(190_80%_52%)]',
  forest: 'bg-[hsl(152_58%_48%)]',
  midnight: 'bg-[hsl(270_72%_68%)]',
  sunset: 'bg-[hsl(28_92%_56%)]',
  candy: 'bg-[hsl(330_72%_62%)]',
};

export function ThemePicker() {
  const { theme, setTheme } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Palette className="h-4 w-4" />
          <span className="sr-only">Change theme</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-3" align="end">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Accent
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {themes.map((t) => {
              const selected = theme === t.name;
              return (
                <button
                  type="button"
                  key={t.name}
                  onClick={() => setTheme(t.name)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-2 rounded-md border transition-[color,background-color,border-color] duration-150',
                    selected
                      ? 'border-primary bg-primary/10'
                      : 'border-transparent hover:bg-muted/60',
                  )}
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-md border border-border/60 flex items-center justify-center',
                      themeSwatches[t.name],
                    )}
                  >
                    {selected ? (
                      <Check className="w-3.5 h-3.5 text-primary-foreground" />
                    ) : (
                      <span className="text-[10px] text-primary-foreground/90">{t.emoji}</span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-foreground">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
