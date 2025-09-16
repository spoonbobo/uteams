import React from 'react';
import { Snackbar, Alert, Stack, LinearProgress, Box } from '@mui/material';
import { useToastStore } from '@/stores/useToastStore';
import type { ToastMessage } from '@/types/message';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, removeToast } = useToastStore();

  const handleClose = (id: string) => {
    removeToast(id);
  };

  return (
    <>
      {children}

      <Stack
        spacing={2}
        sx={{ position: 'fixed', top: 24, right: 24, zIndex: 2000 }}
      >
        {toasts.map((toast: ToastMessage) => (
          <Snackbar
            key={toast.id}
            open
            autoHideDuration={toast.autoHideDuration}
            onClose={() => handleClose(toast.id)}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            sx={{ position: 'static', transform: 'none' }}
          >
            <Box sx={{ width: '100%' }}>
              <Alert
                onClose={() => handleClose(toast.id)}
                severity={toast.type}
                variant="filled"
                sx={{ width: '100%' }}
              >
                {toast.message}
              </Alert>
              {toast.showProgress && (
                <LinearProgress
                  variant="determinate"
                  value={toast.progress}
                  sx={{
                    height: 4,
                    borderBottomLeftRadius: 4,
                    borderBottomRightRadius: 4,
                  }}
                />
              )}
            </Box>
          </Snackbar>
        ))}
      </Stack>
    </>
  );
}
