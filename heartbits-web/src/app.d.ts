// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

declare global {
  namespace App {
    // interface Error {}

    interface Locals {
      user: {
        userId: string;
        email: string;
        name: string;
        isDemo: boolean;
      } | null;
    }

    interface PageData {
      user?: {
        userId: string;
        email: string;
        name: string;
        isDemo: boolean;
      } | null;
      isDemo?: boolean;
    }

    // interface PageState {}
    // interface Platform {}
  }
}

export {};
