import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Tooltip,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileCopy as CopyIcon
} from '@mui/icons-material';
import { scenarioService, type Scenario, type CreateScenarioRequest, type DuplicateScenarioRequest } from '../../services';

interface ScenarioManagerProps {
  open: boolean;
  onClose: () => void;
  scenarios: Scenario[];
  currentScenarioId: number;
  onScenarioChange: (scenario: Scenario) => void;
  onScenariosUpdated: () => void;
}

const ScenarioManager: React.FC<ScenarioManagerProps> = ({
  open,
  onClose,
  scenarios,
  currentScenarioId,
  onScenarioChange,
  onScenariosUpdated
}) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleCreateScenario = async () => {
    if (!formData.name.trim()) {
      setError('Scenario name is required');
      return;
    }

    try {
      setLoading(true);
      const request: CreateScenarioRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined
      };
      
      await scenarioService.createScenario(request);
      setSuccessMessage('Scenario created successfully!');
      setCreateDialogOpen(false);
      setFormData({ name: '', description: '' });
      onScenariosUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scenario');
    } finally {
      setLoading(false);
    }
  };

  const handleEditScenario = async () => {
    if (!selectedScenario || !formData.name.trim()) {
      setError('Scenario name is required');
      return;
    }

    try {
      setLoading(true);
      await scenarioService.updateScenario(selectedScenario.scenarioId, {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined
      });
      setSuccessMessage('Scenario updated successfully!');
      setEditDialogOpen(false);
      setSelectedScenario(null);
      setFormData({ name: '', description: '' });
      onScenariosUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update scenario');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateScenario = async () => {
    if (!selectedScenario || !formData.name.trim()) {
      setError('Scenario name is required');
      return;
    }

    try {
      setLoading(true);
      const request: DuplicateScenarioRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined
      };
      
      await scenarioService.duplicateScenario(selectedScenario.scenarioId, request);
      setSuccessMessage('Scenario duplicated successfully!');
      setDuplicateDialogOpen(false);
      setSelectedScenario(null);
      setFormData({ name: '', description: '' });
      onScenariosUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate scenario');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteScenario = async (scenario: Scenario) => {
    if (!window.confirm(`Are you sure you want to delete "${scenario.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      await scenarioService.deleteScenario(scenario.scenarioId);
      setSuccessMessage('Scenario deleted successfully!');
      onScenariosUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete scenario');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setFormData({ name: '', description: '' });
    setCreateDialogOpen(true);
  };

  const openEditDialog = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setFormData({ name: scenario.name, description: scenario.description || '' });
    setEditDialogOpen(true);
  };

  const openDuplicateDialog = (scenario: Scenario) => {
    setSelectedScenario(scenario);
    setFormData({ name: `${scenario.name} (Copy)`, description: scenario.description || '' });
    setDuplicateDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Manage Scenarios</Typography>
            <Button
              startIcon={<AddIcon />}
              onClick={openCreateDialog}
              variant="contained"
              disabled={loading}
            >
              New Scenario
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create different financial planning scenarios to compare various budgeting approaches.
          </Typography>
          
          <List>
            {scenarios.map((scenario) => (
              <ListItem
                key={scenario.scenarioId}
                sx={{
                  border: scenario.scenarioId === currentScenarioId ? '2px solid #1976d2' : '1px solid #e0e0e0',
                  borderRadius: 1,
                  mb: 1,
                  backgroundColor: scenario.scenarioId === currentScenarioId ? '#f3f7ff' : 'inherit',
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: scenario.scenarioId === currentScenarioId ? '#f3f7ff' : '#f5f5f5'
                  }
                }}
                onClick={() => onScenarioChange(scenario)}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1" fontWeight="bold">
                        {scenario.name}
                      </Typography>
                      {scenario.scenarioId === currentScenarioId && (
                        <Chip
                          label="Current"
                          size="small"
                          color="primary"
                        />
                      )}
                    </Box>
                  }
                  secondary={scenario.description}
                />
                <ListItemSecondaryAction>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Tooltip title="Duplicate scenario">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDuplicateDialog(scenario);
                        }}
                        disabled={loading}
                      >
                        <CopyIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit scenario">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(scenario);
                        }}
                        disabled={loading}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete scenario">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteScenario(scenario);
                        }}
                        disabled={loading}
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Scenario Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Scenario</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Scenario Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
              placeholder="e.g., Conservative Budget, Aggressive Savings"
            />
            <TextField
              label="Description (Optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
              placeholder="Describe this planning scenario..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCreateScenario}
            variant="contained"
            disabled={loading || !formData.name.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Scenario Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Scenario</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Scenario Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description (Optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleEditScenario}
            variant="contained"
            disabled={loading || !formData.name.trim()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Duplicate Scenario Dialog */}
      <Dialog open={duplicateDialogOpen} onClose={() => setDuplicateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Duplicate Scenario</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            This will copy all budget data from "{selectedScenario?.name}" to a new scenario.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="New Scenario Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description (Optional)"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDuplicateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleDuplicateScenario}
            variant="contained"
            disabled={loading || !formData.name.trim()}
          >
            Duplicate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Message */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage(null)}
      >
        <Alert onClose={() => setSuccessMessage(null)} severity="success">
          {successMessage}
        </Alert>
      </Snackbar>

      {/* Error Message */}
      <Snackbar
        open={!!error}
        autoHideDuration={5000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
    </>
  );
};

export default ScenarioManager;
