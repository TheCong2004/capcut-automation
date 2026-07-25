import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { type SearchResult, type SettingsSectionId, searchSettings } from './searchable-settings';

interface SettingsSearchProps {
  onNavigate: (section: SettingsSectionId, settingId: string) => void;
}

export function SettingsSearch({ onNavigate }: SettingsSearchProps) {
  const { t } = useTranslation('settings');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim()) {
      const searchResults = searchSettings(query, t);
      setResults(searchResults);
      setSelectedIndex(0);
      setIsOpen(searchResults.length > 0);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [query, t]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      onNavigate(result.section, result.id);
      setQuery('');
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [onNavigate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % results.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
          break;
        case 'Enter':
          e.preventDefault();
          handleSelect(results[selectedIndex]);
          break;
        case 'Escape':
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, results, selectedIndex, handleSelect],
  );

  return (
    <div ref={containerRef} className="relative w-64 sm:w-72">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && results.length > 0 && setIsOpen(true)}
          className="pl-8 pr-8 h-8 text-sm bg-background border-border"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors duration-150"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {isOpen && results.length > 0 ? (
        <div className="absolute top-full left-0 right-0 mt-1 py-1 bg-popover border border-border rounded-md z-50 max-h-80 overflow-auto shadow-none">
          {results.map((result, index) => (
            <button
              key={`${result.section}-${result.id}-${index}`}
              type="button"
              onClick={() => handleSelect(result)}
              className={cn(
                'w-full text-left px-3 py-2 transition-colors duration-150',
                index === selectedIndex ? 'bg-muted' : 'hover:bg-muted/60',
              )}
            >
              <div className="text-sm font-medium text-foreground">{result.label}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">{result.description}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
