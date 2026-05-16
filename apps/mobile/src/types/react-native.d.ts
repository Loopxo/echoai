declare module "react-native" {
  import type { ComponentType, ReactNode } from "react";

  export interface ViewStyle {
    [key: string]: unknown;
  }

  export interface TextStyle {
    [key: string]: unknown;
  }

  export interface ImageStyle {
    [key: string]: unknown;
  }

  export type Style = ViewStyle | TextStyle | ImageStyle;

  export const AppRegistry: {
    registerComponent(name: string, getComponentFunc: () => ComponentType): void;
  };

  export const SafeAreaView: ComponentType<{ children?: ReactNode; style?: Style }>;
  export const StatusBar: ComponentType<{ barStyle?: "default" | "light-content" | "dark-content" }>;
  export const Text: ComponentType<{ children?: ReactNode; style?: Style }>;
  export const View: ComponentType<{ children?: ReactNode; style?: Style }>;
  export const Pressable: ComponentType<{ children?: ReactNode; style?: Style; onPress?: () => void }>;
  export const Linking: {
    openURL(url: string): Promise<void>;
  };

  export const StyleSheet: {
    create<T extends Record<string, Style>>(styles: T): T;
  };
}
