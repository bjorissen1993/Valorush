export {};

declare global {
  interface Window {
    valorushDesktop?: {
      isDesktop: boolean;
      mode: "host" | "join";
    };
  }
}
