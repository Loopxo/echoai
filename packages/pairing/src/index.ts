/**
 * EchoAI Pairing - Device Pairing and Linking
 */
import { randomBytes, createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";

const STATE_DIR = process.env.ECHOAI_STATE_DIR || path.join(os.homedir(), ".echoai");
const PAIRING_FILE = path.join(STATE_DIR, "paired-devices.json");

export interface PairedDevice {
    id: string;
    name: string;
    type: "mobile" | "desktop" | "browser" | "other";
    publicKey: string;
    pairedAt: number;
    lastSeen?: number;
    capabilities?: string[];
}

export interface PairingCode {
    code: string;
    expiresAt: number;
    deviceName?: string;
}

export function generatePairingCode(expiresInMs = 300000): PairingCode {
    const code = randomBytes(4).toString("hex").toUpperCase();
    return { code, expiresAt: Date.now() + expiresInMs };
}

export function generateDeviceId(): string {
    return randomBytes(16).toString("hex");
}

export class PairingManager extends EventEmitter {
    private devices: Map<string, PairedDevice> = new Map();
    private pendingCodes: Map<string, PairingCode> = new Map();

    async load(): Promise<void> {
        try {
            const data = await fs.readFile(PAIRING_FILE, "utf8");
            const arr = JSON.parse(data) as PairedDevice[];
            for (const d of arr) this.devices.set(d.id, d);
        } catch { /* No existing file */ }
    }

    async save(): Promise<void> {
        await fs.mkdir(STATE_DIR, { recursive: true });
        await fs.writeFile(PAIRING_FILE, JSON.stringify([...this.devices.values()], null, 2));
    }

    createPairingCode(deviceName?: string): PairingCode {
        const code = generatePairingCode();
        if (deviceName) code.deviceName = deviceName;
        this.pendingCodes.set(code.code, code);
        setTimeout(() => this.pendingCodes.delete(code.code), 300000); // 5 min
        return code;
    }

    async completePairing(code: string, device: Omit<PairedDevice, "id" | "pairedAt">): Promise<PairedDevice | null> {
        const pending = this.pendingCodes.get(code);
        if (!pending || Date.now() > pending.expiresAt) return null;

        this.pendingCodes.delete(code);
        const paired: PairedDevice = {
            ...device,
            id: generateDeviceId(),
            pairedAt: Date.now(),
        };
        this.devices.set(paired.id, paired);
        await this.save();
        this.emit("paired", paired);
        return paired;
    }

    async unpair(deviceId: string): Promise<boolean> {
        if (!this.devices.has(deviceId)) return false;
        this.devices.delete(deviceId);
        await this.save();
        this.emit("unpaired", deviceId);
        return true;
    }

    updateLastSeen(deviceId: string): void {
        const device = this.devices.get(deviceId);
        if (device) device.lastSeen = Date.now();
    }

    getDevice(deviceId: string): PairedDevice | undefined { return this.devices.get(deviceId); }
    listDevices(): PairedDevice[] { return [...this.devices.values()]; }
    isPaired(deviceId: string): boolean { return this.devices.has(deviceId); }
}

export async function createPairingManager(): Promise<PairingManager> {
    const mgr = new PairingManager();
    await mgr.load();
    return mgr;
}
