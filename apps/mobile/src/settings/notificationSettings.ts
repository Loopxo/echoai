export interface NotificationSettings {
  approvals: boolean;
  automations: boolean;
  billing: boolean;
  devices: boolean;
  runCompleted: boolean;
}

export function toggleNotificationSetting(settings: NotificationSettings, key: keyof NotificationSettings): NotificationSettings {
  return { ...settings, [key]: !settings[key] };
}
