import { Icon, type IconName } from '@echoai/design';
import { Button, IconButton } from '../ui';

export interface Banner {
  id: string;
  tone: 'neutral' | 'primary' | 'warning' | 'danger';
  icon: IconName;
  title: string;
  body?: string;
  action?: { label: string; run: () => void };
  onDismiss?: () => void;
}

/**
 * Top-of-thread banners.
 *
 * Reserved for things that block or change the next run — no provider
 * configured, an update waiting, a failed MCP server. Anything transient goes
 * to the toast stack instead, so a banner always means "you need to act".
 */
export function Banners({ banners }: { banners: Banner[] }) {
  if (banners.length === 0) {
    return null;
  }

  return (
    <div className="banner-stack">
      {banners.map((banner) => (
        <div className="banner" data-tone={banner.tone} key={banner.id} role="status">
          <span className="banner-icon">
            <Icon name={banner.icon} size={13} />
          </span>
          <span className="banner-text">
            <span className="banner-title">{banner.title}</span>
            {banner.body ? <span className="banner-body">{banner.body}</span> : null}
          </span>
          <span className="banner-actions">
            {banner.action ? (
              <Button size="sm" variant="default" onClick={banner.action.run}>
                {banner.action.label}
              </Button>
            ) : null}
            {banner.onDismiss ? (
              <IconButton icon="x" label="Dismiss" size="sm" onClick={banner.onDismiss} />
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}
