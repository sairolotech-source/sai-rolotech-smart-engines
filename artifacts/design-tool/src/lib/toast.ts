import { toast as shadToast } from "../hooks/use-toast";

export const toast = {
  error: (message: string) => {
    shadToast({
      title: "Error",
      description: message,
      variant: "destructive",
    });
  },
  success: (message: string) => {
    shadToast({
      title: "Success",
      description: message,
    });
  },
  warning: (message: string) => {
    shadToast({
      title: "Warning",
      description: message,
    });
  },
};
