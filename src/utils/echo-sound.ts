import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface EchoSoundConfig {
  enabled: boolean;
  volume: number; // 0-100
  frequency: number; // Hz
  duration: number; // milliseconds
  pattern: 'single' | 'double' | 'triple' | 'permission' | 'warning' | 'success';
}

export class EchoSoundManager {
  private config: EchoSoundConfig = {
    enabled: true,
    volume: 50,
    frequency: 800,
    duration: 200,
    pattern: 'single'
  };

  constructor(config?: Partial<EchoSoundConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  async playEcho(pattern?: EchoSoundConfig['pattern']): Promise<void> {
    if (!this.config.enabled) return;

    const soundPattern = pattern || this.config.pattern;
    
    try {
      await this.playPattern(soundPattern);
    } catch (error) {
      // Fallback to system beep if advanced sound fails
      await this.fallbackBeep();
    }
  }

  private async playPattern(pattern: EchoSoundConfig['pattern']): Promise<void> {
    switch (pattern) {
      case 'single':
        await this.playTone(this.config.frequency, this.config.duration);
        break;
      
      case 'double':
        await this.playTone(this.config.frequency, this.config.duration);
        await this.sleep(100);
        await this.playTone(this.config.frequency, this.config.duration);
        break;
      
      case 'triple':
        for (let i = 0; i < 3; i++) {
          await this.playTone(this.config.frequency, this.config.duration);
          if (i < 2) await this.sleep(100);
        }
        break;
      
      case 'permission':
        // Echo asking for permission - ascending tones
        await this.playTone(600, 150);
        await this.sleep(50);
        await this.playTone(800, 150);
        await this.sleep(50);
        await this.playTone(1000, 200);
        break;
      
      case 'warning':
        // Warning tone - lower, more urgent
        for (let i = 0; i < 3; i++) {
          await this.playTone(400, 300);
          await this.sleep(200);
        }
        break;
      
      case 'success':
        // Success tone - pleasant ascending
        await this.playTone(800, 100);
        await this.sleep(50);
        await this.playTone(1000, 100);
        await this.sleep(50);
        await this.playTone(1200, 150);
        break;
    }
  }

  private async playTone(frequency: number, duration: number): Promise<void> {
    const platform = process.platform;
    
    try {
      if (platform === 'darwin') {
        // macOS - use osascript to play tone
        await this.playMacOSTone(frequency, duration);
      } else if (platform === 'linux') {
        // Linux - use beep command or speaker-test
        await this.playLinuxTone(frequency, duration);
      } else if (platform === 'win32') {
        // Windows - use powershell
        await this.playWindowsTone(frequency, duration);
      } else {
        // Fallback for other platforms
        await this.fallbackBeep();
      }
    } catch (error) {
      await this.fallbackBeep();
    }
  }

  private async playMacOSTone(frequency: number, duration: number): Promise<void> {
    // Use osascript to generate a tone
    const script = `
      osascript -e 'tell application "System Events" to beep'
    `;
    await execAsync(script);
  }

  private async playLinuxTone(frequency: number, duration: number): Promise<void> {
    try {
      // Try beep command first
      await execAsync(`beep -f ${frequency} -l ${duration} 2>/dev/null`);
    } catch {
      try {
        // Try speaker-test as fallback
        await execAsync(`timeout ${duration / 1000}s speaker-test -t sine -f ${frequency} -c 1 -l 1 2>/dev/null`);
      } catch {
        // Final fallback - system bell
        await execAsync('printf "\\a"');
      }
    }
  }

  private async playWindowsTone(frequency: number, duration: number): Promise<void> {
    const script = `
      [console]::beep(${frequency}, ${duration})
    `;
    await execAsync(`powershell -Command "${script}"`);
  }

  private async fallbackBeep(): Promise<void> {
    try {
      // Universal fallback - ASCII bell character
      process.stdout.write('\x07');
    } catch (error) {
      // Silent fail if even this doesn't work
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateConfig(config: Partial<EchoSoundConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): EchoSoundConfig {
    return { ...this.config };
  }

  async testSound(): Promise<void> {
    console.log('🔊 Testing Echo sound patterns...\n');
    
    console.log('🔔 Single beep...');
    await this.playEcho('single');
    await this.sleep(1000);
    
    console.log('🔔🔔 Double beep...');
    await this.playEcho('double');
    await this.sleep(1000);
    
    console.log('🙋 Permission request (Echo asking)...');
    await this.playEcho('permission');
    await this.sleep(1000);
    
    console.log('⚠️ Warning tone...');
    await this.playEcho('warning');
    await this.sleep(1000);
    
    console.log('✅ Success tone...');
    await this.playEcho('success');
    
    console.log('\n🎵 Sound test complete!');
  }
}

// Global echo sound manager
export const echoSound = new EchoSoundManager();

// Convenience functions
export async function echo(pattern?: EchoSoundConfig['pattern']): Promise<void> {
  await echoSound.playEcho(pattern);
}

export async function echoPermission(): Promise<void> {
  await echoSound.playEcho('permission');
}

export async function echoWarning(): Promise<void> {
  await echoSound.playEcho('warning');
}

export async function echoSuccess(): Promise<void> {
  await echoSound.playEcho('success');
}