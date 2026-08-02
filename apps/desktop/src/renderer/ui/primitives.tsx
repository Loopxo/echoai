import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Icon, type IconName } from '@echoai/design';
import { cn } from '../lib/cn';

/* ------------------------------- Button ------------------------------- */

export type ButtonVariant = 'default' | 'primary' | 'ghost' | 'subtle' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  trailingIcon?: IconName;
  full?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'default', size = 'md', icon, trailingIcon, full, loading, className, children, disabled, type = 'button', ...rest },
  ref
) {
  const iconSize = size === 'lg' ? 15 : 14;
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={cn('btn', className)}
      data-variant={variant}
      data-size={size}
      data-full={full ? 'true' : undefined}
      disabled={disabled || loading}
    >
      {loading ? <Spinner size={iconSize} /> : icon ? <Icon name={icon} size={iconSize} /> : null}
      {children}
      {trailingIcon ? <Icon name={trailingIcon} size={iconSize} /> : null}
    </button>
  );
});

/* ----------------------------- Icon button ----------------------------- */

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Required: icon-only controls must always carry an accessible name. */
  label: string;
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  tone?: 'default' | 'danger';
  iconSize?: number;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, size = 'md', active, tone = 'default', iconSize, className, type = 'button', ...rest },
  ref
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      aria-label={label}
      title={rest.title ?? label}
      className={cn('icon-btn', className)}
      data-size={size}
      data-active={active ? 'true' : undefined}
      data-tone={tone === 'danger' ? 'danger' : undefined}
    >
      <Icon name={icon} size={iconSize ?? (size === 'sm' ? 13 : size === 'lg' ? 17 : 15)} />
    </button>
  );
});

/* ------------------------------- Inputs ------------------------------- */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input {...rest} ref={ref} className={cn('input', className)} />;
  }
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea {...rest} ref={ref} className={cn('textarea', className)} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...rest }, ref) {
    return <select {...rest} ref={ref} className={cn('select', className)} />;
  }
);

export function SearchField({
  value,
  onValueChange,
  placeholder,
  onSubmit,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('search-field', className)}>
      <Icon name="search" size={13} />
      <Input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && onSubmit) {
            onSubmit();
          }
        }}
      />
    </div>
  );
}

/* -------------------------------- Field -------------------------------- */

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('field', className)}>
      {label ? <span className="field-label">{label}</span> : null}
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

/** Label + description on the left, control on the right. Settings workhorse. */
export function SettingRow({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="field-row">
      <div className="field-row-text">
        <span className="field-label">{title}</span>
        {description ? <span className="field-hint">{description}</span> : null}
      </div>
      <div className="field-row-control">{children}</div>
    </div>
  );
}

/* ------------------------------- Toggles ------------------------------- */

export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="switch"
      data-checked={checked ? 'true' : 'false'}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
    />
  );
}

export function Checkbox({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      className="checkbox"
      data-checked={checked ? 'true' : 'false'}
      onClick={() => onCheckedChange(!checked)}
    >
      <Icon name="check" size={11} strokeWidth={2.6} />
    </button>
  );
}

/* -------------------------------- Badge -------------------------------- */

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export function Badge({
  tone = 'neutral',
  plain,
  icon,
  children,
  className,
}: {
  tone?: Tone;
  plain?: boolean;
  icon?: IconName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn('badge', className)}
      data-tone={tone === 'neutral' ? undefined : tone}
      data-plain={plain ? 'true' : undefined}
    >
      {icon ? <Icon name={icon} size={10} /> : null}
      {children}
    </span>
  );
}

export function Dot({ tone = 'neutral', pulse }: { tone?: Tone; pulse?: boolean }) {
  return (
    <span
      className="dot"
      data-tone={tone === 'neutral' ? undefined : tone}
      data-pulse={pulse ? 'true' : undefined}
    />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Chip({
  children,
  icon,
  onRemove,
  removeLabel,
  className,
}: {
  children: ReactNode;
  icon?: IconName;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
}) {
  return (
    <span className={cn('chip', className)} data-plain={onRemove ? undefined : 'true'}>
      {icon ? <Icon name={icon} size={11} /> : null}
      <span>{children}</span>
      {onRemove ? (
        <IconButton icon="x" label={removeLabel ?? 'Remove'} size="sm" iconSize={11} onClick={onRemove} />
      ) : null}
    </span>
  );
}

/* ------------------------------ Feedback ------------------------------ */

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className="spinner"
      style={{ width: size, height: size }}
    />
  );
}

export function Skeleton({
  width = '100%',
  height = 12,
  radius,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
}) {
  return <span aria-hidden className="skeleton" style={{ width, height, borderRadius: radius }} />;
}

export function Progress({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="progress" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon ? (
        <span className="empty-icon">
          <Icon name={icon} size={18} />
        </span>
      ) : null}
      <span className="empty-title">{title}</span>
      {description ? <span className="empty-desc">{description}</span> : null}
      {action}
    </div>
  );
}

/* ------------------------------ Structure ------------------------------ */

export function Separator({ orientation = 'horizontal' }: { orientation?: 'horizontal' | 'vertical' }) {
  return <span className="sep" data-orientation={orientation} role="separator" />;
}

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cn('card', className)}>
      {children}
    </div>
  );
}

export function SectionHead({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <div className="section-title">{title}</div>
        {description ? <div className="section-desc">{description}</div> : null}
      </div>
      {actions ? <div className="field-row-control">{actions}</div> : null}
    </div>
  );
}

export function Avatar({ label, size = 'md' }: { label: string; size?: 'md' | 'lg' }) {
  const initials = label
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('');
  return (
    <span className="avatar" data-size={size === 'lg' ? 'lg' : undefined} aria-hidden>
      {initials || '?'}
    </span>
  );
}

export function Tabs<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: IconName }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('tabs', className)} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className="tab"
          data-active={option.value === value ? 'true' : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <Icon name={option.icon} size={13} /> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: IconName }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          data-active={option.value === value ? 'true' : undefined}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <Icon name={option.icon} size={12} /> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}
