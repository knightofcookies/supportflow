// src/components/Dashboard/CustomerDashboard.jsx
import React, { useState, useEffect, useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar, Toolbar, Typography, Button, Container, Grid, Box, Paper,
  Card, CardContent, CardActions, Divider, Chip, CircularProgress, Stack,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions, Fab, Tooltip
} from "@mui/material";
import AddCommentIcon from '@mui/icons-material/AddComment';
import ChatIcon from '@mui/icons-material/Chat';
import RefreshIcon from '@mui/icons-material/Refresh';
import { AppContext, UserRole } from "../../App";
import getStatusChip from "../../utils/getStatusChip";
import { formatBackendStringToIstDisplay } from "../../utils/dateTimeUtils";
import IconButton from "@mui/material/IconButton";

export default function CustomerDashboard() {
  const { currentUser, makeApiCall, showSnackbar, handleLogout, handleOpenFaqModal } = useContext(AppContext);
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newConversationSubject, setNewConversationSubject] = useState("");
  const [newConversationMessage, setNewConversationMessage] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!currentUser || currentUser.role !== UserRole.customer) return;
    setLoadingConversations(true);
    try {
      const data = await makeApiCall("get", "/conversations/"); // Fetches conversations for the current user
      setConversations(Array.isArray(data) ? data.sort((a,b) => new Date(b.last_message_at || b.created_at) - new Date(a.last_message_at || a.created_at)) : []);
    } catch (error) {
      showSnackbar("Failed to load conversations.", "error");
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  }, [currentUser, makeApiCall, showSnackbar]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleOpenCreateModal = () => setCreateModalOpen(true);
  const handleCloseCreateModal = () => {
    setCreateModalOpen(false);
    setNewConversationSubject("");
    setNewConversationMessage("");
    setIsCreating(false);
  };

  const handleCreateConversation = async () => {
    if (!newConversationMessage.trim()) {
      showSnackbar("Initial message cannot be empty.", "warning");
      return;
    }
    setIsCreating(true);
    try {
      const payload = {
        subject: newConversationSubject.trim() || null,
        initial_message_text: newConversationMessage.trim(),
      };
      const newConv = await makeApiCall("post", "/conversations/", payload);
      showSnackbar("Conversation created successfully!", "success");
      handleCloseCreateModal();
      fetchConversations(); // Refresh list
      navigate(`/chat/${newConv.id}`); // Navigate to the new chat
    } catch (error) {
      // Error handled by makeApiCall
      setIsCreating(false); // Keep modal open on error
    }
  };

  const handleViewConversation = (conversationId) => {
    navigate(`/chat/${conversationId}`);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="sticky">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>My Conversations</Typography>
          <Typography variant="caption" sx={{ mr: 1, display: {xs: 'none', sm: 'block'} }}>{currentUser?.full_name || currentUser?.email}</Typography>
          <Button color="inherit" onClick={handleOpenFaqModal} sx={{mr:1}}>FAQs</Button>
          <Button color="inherit" variant="outlined" onClick={handleLogout}>Logout</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ flexGrow: 1, py: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h5">Support History</Typography>
            <Stack direction="row" spacing={1}>
                <Tooltip title="Refresh Conversations">
                    <IconButton onClick={fetchConversations} disabled={loadingConversations}>
                        {loadingConversations ? <CircularProgress size={24}/> : <RefreshIcon />}
                    </IconButton>
                </Tooltip>
                <Button variant="contained" startIcon={<AddCommentIcon />} onClick={handleOpenCreateModal}>
                    New Conversation
                </Button>
            </Stack>
        </Box>

        {loadingConversations ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}><CircularProgress /></Box>
        ) : conversations.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center', mt: 3 }}>
            <Typography variant="subtitle1" color="textSecondary">
              You have no conversations yet.
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{mt:1}}>
              Click "New Conversation" to start a new support request.
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {conversations.map((conv) => {
              const statusInfo = getStatusChip(conv.status);
              return (
                <Grid item xs={12} key={conv.id}>
                  <Card variant="outlined" sx={{ borderLeft: 5, borderColor: `${statusInfo.color === "default" ? "grey" : statusInfo.color}.main`}}>
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box sx={{flexGrow: 1}}>
                          <Typography variant="h6" gutterBottom sx={{fontSize: '1.1rem'}}>
                            {conv.subject || `Conversation #${conv.id}`}
                          </Typography>
                          <Typography variant="caption" color="textSecondary" display="block">
                            Last update: {formatBackendStringToIstDisplay(conv.last_message_at || conv.created_at)}
                          </Typography>
                          {conv.agent && (
                            <Typography variant="caption" color="textSecondary" display="block">
                                Agent: {conv.agent.full_name || conv.agent.email}
                            </Typography>
                          )}
                        </Box>
                        <Chip icon={statusInfo.icon} label={statusInfo.label} color={statusInfo.color} size="small" sx={{mt:0.5}}/>
                      </Stack>
                    </CardContent>
                    <CardActions sx={{justifyContent: 'flex-end'}}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<ChatIcon />}
                        onClick={() => handleViewConversation(conv.id)}
                      >
                        {conv.status === "closed" || conv.status === "resolved" ? "View" : "Open Chat"}
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Container>

      {/* Create New Conversation Dialog */}
      <Dialog open={createModalOpen} onClose={handleCloseCreateModal} fullWidth maxWidth="sm">
        <DialogTitle>Start a New Conversation</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            id="subject"
            label="Subject (Optional)"
            type="text"
            fullWidth
            variant="outlined"
            value={newConversationSubject}
            onChange={(e) => setNewConversationSubject(e.target.value)}
            disabled={isCreating}
            sx={{mb: 2}}
          />
          <TextField
            margin="dense"
            id="message"
            label="Your Initial Message"
            type="text"
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            value={newConversationMessage}
            onChange={(e) => setNewConversationMessage(e.target.value)}
            required
            disabled={isCreating}
            helperText="Please describe your issue or question."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreateModal} disabled={isCreating}>Cancel</Button>
          <Button onClick={handleCreateConversation} variant="contained" disabled={isCreating || !newConversationMessage.trim()}>
            {isCreating ? <CircularProgress size={24} /> : "Create & Open Chat"}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Consider adding a global Footer component here if desired */}
    </Box>
  );
}
