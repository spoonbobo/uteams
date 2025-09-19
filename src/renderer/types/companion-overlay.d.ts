declare module 'views/CompanionOverlay' {
  // Fallback declaration to satisfy TS resolving during incremental builds
  import type React from 'react';
  export const CompanionOverlay: React.ComponentType<{
    sessionId: string;
    sessionName: string;
  }>;
}
