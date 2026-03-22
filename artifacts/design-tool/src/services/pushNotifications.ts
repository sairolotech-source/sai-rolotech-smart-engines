import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import type { PushNotificationSchema, Token, ActionPerformed } from "@capacitor/push-notifications";

export interface NotificationHandler {
  onToken?: (token: string) => void;
  onNotification?: (notification: PushNotificationSchema) => void;
  onAction?: (action: ActionPerformed) => void;
}

class PushNotificationService {
  private initialized = false;

  isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  async initialize(handlers: NotificationHandler = {}): Promise<void> {
    if (!this.isNative() || this.initialized) return;

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") {
      console.warn("[Push] Permission not granted");
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener("registration", (token: Token) => {
      console.log("[Push] FCM Token:", token.value);
      handlers.onToken?.(token.value);
    });

    PushNotifications.addListener("registrationError", (err) => {
      console.error("[Push] Registration error:", err.error);
    });

    PushNotifications.addListener(
      "pushNotificationReceived",
      (notification: PushNotificationSchema) => {
        console.log("[Push] Received:", notification);
        handlers.onNotification?.(notification);
      }
    );

    PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action: ActionPerformed) => {
        console.log("[Push] Action:", action);
        handlers.onAction?.(action);
      }
    );

    this.initialized = true;
    console.log("[Push] Service initialized successfully");
  }

  async getDeliveredNotifications() {
    if (!this.isNative()) return [];
    const result = await PushNotifications.getDeliveredNotifications();
    return result.notifications;
  }

  async clearAll() {
    if (!this.isNative()) return;
    await PushNotifications.removeAllDeliveredNotifications();
  }
}

export const pushNotificationService = new PushNotificationService();
