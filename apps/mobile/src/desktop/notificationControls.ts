export interface DesktopNotificationPreferences {
  approvals: boolean;
  browserTasks: boolean;
  runCompleted: boolean;
  terminalOutput: boolean;
}

export function toggleDesktopNotificationPreference(
  preferences: DesktopNotificationPreferences,
  key: keyof DesktopNotificationPreferences,
): DesktopNotificationPreferences {
  return {
    ...preferences,
    [key]: !preferences[key],
  };
}
