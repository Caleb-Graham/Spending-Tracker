import React from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControlLabel,
  Paper,
  Switch,
  Typography,
} from "@mui/material";
import { ManageAccounts as ManageAccountsIcon } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/auth";
import { useAppSettings } from "../../hooks/useAppSettings";

const Settings: React.FC = () => {
  const { user } = useAuth();
  const { settings, updateSettings } = useAppSettings(user?.id);
  const navigate = useNavigate();

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 900, mx: "auto" }}>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Settings
      </Typography>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography variant="h6" component="h2">
          Account
        </Typography>
        <Box
          sx={{
            mt: 1.5,
            display: "flex",
            alignItems: { xs: "flex-start", sm: "center" },
            justifyContent: "space-between",
            gap: 2,
            flexDirection: { xs: "column", sm: "row" },
          }}
        >
          <Box>
            <Typography variant="body1">
              {user?.displayName || user?.primaryEmail || "Signed-in account"}
            </Typography>
            {user?.displayName && user?.primaryEmail && (
              <Typography variant="body2" color="text.secondary">
                {user.primaryEmail}
              </Typography>
            )}
          </Box>
          <Button
            variant="outlined"
            startIcon={<ManageAccountsIcon />}
            onClick={() => navigate("/handler/account-settings")}
          >
            Manage Account
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" component="h2">
          Integrations
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Enable optional data sources and import tools for this browser.
        </Typography>
        <Divider sx={{ my: 2 }} />

        <FormControlLabel
          sx={{ alignItems: "flex-start", m: 0 }}
          control={
            <Switch
              checked={settings.wellsFargoImportEnabled}
              onChange={(event) =>
                updateSettings({ wellsFargoImportEnabled: event.target.checked })
              }
              inputProps={{ "aria-label": "Enable Wells Fargo CSV import" }}
            />
          }
          label={
            <Box sx={{ ml: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Enable Wells Fargo CSV import
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Import a Wells Fargo checking-account CSV.
              </Typography>
            </Box>
          }
        />

        {settings.wellsFargoImportEnabled && (
          <Alert severity="info" sx={{ mt: 2 }}>
            The import button is now visible. Every CSV is previewed before any
            transactions are saved.
          </Alert>
        )}
      </Paper>
    </Box>
  );
};

export default Settings;
