// src/components/Chat/ParticipantsDialog.jsx
import React from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button,
  List, ListItem, ListItemAvatar, Avatar, ListItemText, Typography,
} from "@mui/material";
import PersonIcon from "@mui/icons-material/Person";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings"; // For admin
import { UserRole } from "../../App"; // Import UserRole

function ParticipantsDialog({ open, onClose, participants = [] }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Participants in Conversation</DialogTitle>
      <DialogContent dividers>
        {participants.length > 0 ? (
          <List dense>
            {participants.map((p, index) => ( // p should be { user_id, name, role }
              <ListItem key={`${p.user_id}-${index}`} disablePadding>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: p.role === UserRole.admin ? "error.main" : p.role === UserRole.agent ? "secondary.main" : "primary.main", width: 32, height: 32 }}>
                    {p.role === UserRole.admin ? <AdminPanelSettingsIcon fontSize="small" /> : p.role === UserRole.agent ? <SupportAgentIcon fontSize="small" /> : <PersonIcon fontSize="small" />}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={p.name || `User ID: ${p.user_id}`}
                  secondary={p.role ? p.role.charAt(0).toUpperCase() + p.role.slice(1) : "Unknown"}
                  primaryTypographyProps={{ variant: "body2" }}
                  secondaryTypographyProps={{ variant: "caption" }}
                />
              </ListItem>
            ))}
          </List>
        ) : (
          <Typography variant="body2" color="textSecondary" align="center" sx={{ p: 2 }}>
            No other participants currently in this conversation.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default ParticipantsDialog;
