import React, { useCallback, useEffect, useState } from 'react';

import { GatewayService, getServices } from '../api/flowordClient';

interface ServicesViewProps {
  onOpenCapCutAutomation?: () => void;
}

const STATUS_STYLES: Record<GatewayService['status'], string> = {
  ready: 'bg-green-500/10 text-green-400',
  degraded: 'bg-amber-500/10 text-amber-400',
  offline: 'bg-zinc-500/10 text-zinc-400',
  not_configured: 'bg-zinc-500/10 text-zinc-400',
  error: 'bg-red-500/10 text-red-400',
};

const SERVICE_ORDER = ['omniroute', 'ffmpeg', 'mediacrawler', 'tts', 'playwright', 'capcut'];

function statusLabel(status: GatewayService['status']): string {
  return status.replace('_', ' ');
}

function healthMessage(service: GatewayService): string | null {
  const message = service.health.message;
  return typeof message === 'string' && message ? message : null;
}

export const ServicesView: React.FC<ServicesViewProps> = ({ onOpenCapCutAutomation }) => {
  const [services, setServices] = useState<GatewayService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getServices();
      const byId = new Map(response.services.map((service) => [service.id, service]));
      setServices(SERVICE_ORDER.flatMap((id) => {
        const service = byId.get(id);
        return service ? [service] : [];
      }));
    } catch (requestError) {
      setServices([]);
      setError(requestError instanceof Error ? requestError.message : 'Backend gateway is unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="flex w-full flex-col gap-5">
      <header className="flex justify-end">
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="floword-button floword-button-secondary text-zinc-200 disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </header>

      <span className="sr-only" role="status" aria-live="polite">
        {loading ? 'Checking service status' : `${services.length} services loaded`}
      </span>

      {error && (
        <div role="alert" className="rounded-[14px] border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {services.map((service) => (
          <article key={service.id} className="floword-card flex min-h-48 flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">{service.category}</p>
                <h3 className="mt-1.5 text-base font-semibold text-white">{service.name}</h3>
              </div>
              <div className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[service.status]}`}>
                {statusLabel(service.status)}
              </div>
            </div>

            <p className="mt-4 flex-1 text-sm leading-6 text-zinc-400">
              {healthMessage(service) ?? service.capabilities.join(' · ')}
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {service.capabilities.slice(0, 3).map((capability) => (
                <span key={capability} className="rounded-md bg-white/[0.04] px-2 py-1 text-[10px] font-medium text-zinc-500">
                  {capability}
                </span>
              ))}
            </div>

            {service.id === 'capcut' && service.uiMode === 'separate' && onOpenCapCutAutomation && (
              <button
                type="button"
                onClick={onOpenCapCutAutomation}
                className="floword-button floword-button-primary mt-4 self-start"
              >
                Open App
              </button>
            )}
          </article>
        ))}
      </div>

      {!loading && !error && services.length === 0 && (
        <div className="floword-card p-8 text-center text-sm text-zinc-500">
          No services were reported by the backend.
        </div>
      )}
    </section>
  );
};
