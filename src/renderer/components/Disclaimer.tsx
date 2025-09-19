import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  alpha,
  Divider,
  Alert,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Info as InfoIcon,
  VpnKey as VpnKeyIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useIntl } from 'react-intl';

interface DisclaimerProps {
  open: boolean;
  onClose?: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  isNewUser?: boolean;
}

export const Disclaimer: React.FC<DisclaimerProps> = ({
  open,
  onClose,
  onAccept,
  onDecline,
  isNewUser = true,
}) => {
  const intl = useIntl();
  const theme = useTheme();
  const [productName, setProductName] = useState<string>('EzzzBet');

  useEffect(() => {
    const fetchProductName = async () => {
      try {
        const ipc = (window as any)?.electron;
        if (ipc?.ipcRenderer?.invoke) {
          const name = await ipc.ipcRenderer.invoke('app:get-product-name');
          if (name) setProductName(name);
        }
      } catch {}
    };
    if (open) fetchProductName();
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          backgroundColor: theme.palette.background.paper,
        },
      }}
    >
      <DialogTitle
        sx={{
          pb: 1,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Typography variant="h6" component="span" fontWeight={600}>
          {intl.formatMessage({ id: 'disclaimer.title' })}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ py: 3 }}>
        <Typography
          variant="body1"
          sx={{
            mb: 2,
            color: 'text.secondary',
            lineHeight: 1.6,
          }}
        >
          {intl.formatMessage({ id: 'disclaimer.description' }, { productName })}
        </Typography>

        <List>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <InfoIcon color="primary" fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={intl.formatMessage({ id: 'disclaimer.aiResults.title' })}
              secondary={intl.formatMessage({ id: 'disclaimer.aiResults.description' })}
            />
          </ListItem>

          <Divider variant="inset" component="li" />

          <ListItem>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <VpnKeyIcon color="primary" fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={intl.formatMessage({ id: 'disclaimer.credentials.title' })}
              secondary={intl.formatMessage({ id: 'disclaimer.credentials.description' })}
            />
          </ListItem>
        </List>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onAccept || onClose} variant="contained" color="primary">
          {intl.formatMessage({ id: 'disclaimer.understand' })}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Hook for using the disclaimer dialog
export const useDisclaimer = () => {
  const [open, setOpen] = useState(false);

  const showDisclaimer = () => setOpen(true);
  const hideDisclaimer = () => setOpen(false);

  return {
    open,
    showDisclaimer,
    hideDisclaimer,
  };
};
