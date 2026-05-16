import type { EchoAIPushNativeModule } from "../native";
import type { MobileApprovalRequest, MobileDevice, MobileEntityId } from "../protocol";

export interface ApprovalPushRegistration {
  device: MobileDevice;
  workspaceId: MobileEntityId;
}

export class ApprovalPushNotifications {
  constructor(private readonly push: EchoAIPushNativeModule) {}

  async register(workspaceId: MobileEntityId, onApproval: (approval: MobileApprovalRequest) => void): Promise<ApprovalPushRegistration> {
    const device = await this.push.registerDevice(workspaceId);
    this.push.setApprovalHandler(onApproval);
    return { device, workspaceId };
  }

  createDeepLink(approval: MobileApprovalRequest): string {
    return `echoai://approvals/${approval.id}`;
  }
}

export function createApprovalPushNotifications(push: EchoAIPushNativeModule): ApprovalPushNotifications {
  return new ApprovalPushNotifications(push);
}
