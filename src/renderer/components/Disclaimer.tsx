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
  Analytics as AnalyticsIcon,
  Security as SecurityIcon,
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
        {isNewUser && (
          <Alert severity="info" icon={false} sx={{ mb: 3 }}>
            {intl.formatMessage({ id: 'disclaimer.welcome' }, { productName })}
          </Alert>
        )}

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
              <AnalyticsIcon color="primary" fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={intl.formatMessage({ id: 'disclaimer.analytics.title' })}
              secondary={intl.formatMessage({ id: 'disclaimer.analytics.description' })}
            />
          </ListItem>

          <Divider variant="inset" component="li" />

          <ListItem>
            <ListItemIcon sx={{ minWidth: 40 }}>
              <SecurityIcon color="primary" fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={intl.formatMessage({ id: 'disclaimer.p2p.title' })}
              secondary={intl.formatMessage({ id: 'disclaimer.p2p.description' })}
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

        {isNewUser && (
          <Alert severity="warning" icon={false} sx={{ mt: 3 }}>
            {intl.formatMessage({ id: 'disclaimer.agreement' })}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        {isNewUser ? (
          <>
            <Button onClick={onDecline} color="inherit">
              {intl.formatMessage({ id: 'disclaimer.decline' })}
            </Button>
            <Button onClick={onAccept} variant="contained" color="primary">
              {intl.formatMessage({ id: 'disclaimer.accept' })}
            </Button>
          </>
        ) : (
          <Button onClick={onClose} variant="contained" color="primary">
            {intl.formatMessage({ id: 'common.close' })}
          </Button>
        )}
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
