// src/components/Agent/AgentDashboard.jsx
import React, { useState, useEffect, useCallback, useContext } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Grid,
  Box,
  Paper,
  Card,
  CardContent,
  CardActions,
  Divider,
  Chip,
  CircularProgress,
  Stack,
  Tabs,
  Tab,
  Tooltip,
  IconButton,
} from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import RefreshIcon from "@mui/icons-material/Refresh";
import { AppContext } from "../../App"; // UserRole is no longer needed here
import getStatusChip, {
  ConversationStatusEnum,
} from "../../utils/getStatusChip";
import { formatBackendStringToIstDisplay } from "../../utils/dateTimeUtils";
import TabPanel from "../Common/TabPanel";

function a11yProps(index) {
  return {
    id: `agent-tab-${index}`,
    "aria-controls": `agent-tabpanel-${index}`,
  };
}

export default function AgentDashboard() {
  const {
    currentUser,
    makeApiCall,
    showSnackbar,
    handleLogout,
    handleOpenFaqModal,
  } = useContext(AppContext);
  const navigate = useNavigate();

  // We'll now have two separate states for the two lists
  const [assignedConversations, setAssignedConversations] = useState([]);
  const [openConversations, setOpenConversations] = useState([]);

  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);

  // *** REFACTORED: Create two separate, clear fetch functions ***
  const fetchAssignedConversations = useCallback(async () => {
    setLoading(true);
    try {
      // This endpoint is for the agent's assigned conversations.
      // The backend now correctly handles returning only conversations assigned to the logged-in agent.
      const data = await makeApiCall("get", "/conversations/");
      setAssignedConversations(Array.isArray(data) ? data : []);
    } catch (error) {
      // The `makeApiCall` hook already shows a snackbar on error.
      console.error("Failed to load assigned conversations:", error);
      setAssignedConversations([]); // Clear on error
    } finally {
      setLoading(false);
    }
  }, [makeApiCall]);

  const fetchOpenConversations = useCallback(async () => {
    setLoading(true);
    try {
      // This uses the NEW dedicated agent endpoint for the open queue.
      // It's secure and clear.
      const data = await makeApiCall(
        "get",
        "/agent/conversations?status=open&limit=50"
      );
      setOpenConversations(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load open conversations:", error);
      setOpenConversations([]); // Clear on error
    } finally {
      setLoading(false);
    }
  }, [makeApiCall]);

  // *** REFACTORED: Use a single useEffect to fetch based on the active tab ***
  useEffect(() => {
    if (tabValue === 0) {
      fetchAssignedConversations();
    } else if (tabValue === 1) {
      fetchOpenConversations();
    }
  }, [tabValue, fetchAssignedConversations, fetchOpenConversations]);

  const handleRefresh = () => {
    if (tabValue === 0) {
      fetchAssignedConversations();
    } else {
      fetchOpenConversations();
    }
  };

  const handleViewConversation = (conversationId) => {
    navigate(`/agent/chat/${conversationId}`);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  // *** REFACTORED: This function is now simpler and just renders the list it's given ***
  const renderConversationsList = (convList) => {
    if (loading) {
      return (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "50vh",
          }}
        >
          <CircularProgress />
        </Box>
      );
    }
    if (convList.length === 0) {
      return (
        <Paper
          sx={{
            p: 3,
            textAlign: "center",
            mt: 3,
            background: "rgba(0,0,0,0.1)",
          }}
        >
          <Typography variant="subtitle1" color="textSecondary">
            No conversations in this queue.
          </Typography>
        </Paper>
      );
    }
    return (
      <Grid container spacing={2} sx={{ mt: 1 }}>
        {convList.map((conv) => {
          const statusInfo = getStatusChip(conv.status);
          return (
            <Grid item xs={12} sm={6} md={4} key={conv.id}>
              <Card
                variant="outlined"
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  borderLeft: 5,
                  borderColor: `${
                    statusInfo.color === "default" ? "grey" : statusInfo.color
                  }.main`,
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    spacing={1}
                  >
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography
                        variant="h6"
                        gutterBottom
                        sx={{ fontSize: "1.1rem" }}
                      >
                        {conv.subject || `Conversation #${conv.id}`}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        display="block"
                      >
                        Customer:{" "}
                        {conv.customer?.full_name ||
                          conv.customer?.email ||
                          "N/A"}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="textSecondary"
                        display="block"
                      >
                        Last update:{" "}
                        {formatBackendStringToIstDisplay(
                          conv.last_message_at || conv.created_at
                        )}
                      </Typography>
                    </Box>
                    <Chip
                      icon={statusInfo.icon}
                      label={statusInfo.label}
                      color={statusInfo.color}
                      size="small"
                      sx={{ mt: 0.5 }}
                    />
                  </Stack>
                </CardContent>
                <CardActions sx={{ justifyContent: "flex-end" }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ChatIcon />}
                    onClick={() => handleViewConversation(conv.id)}
                  >
                    {conv.status === ConversationStatusEnum.closed ||
                    conv.status === ConversationStatusEnum.resolved
                      ? "View"
                      : "Open Chat"}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        bgcolor: "background.default",
      }}
    >
      <AppBar position="sticky">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Agent Dashboard
          </Typography>
          <Typography
            variant="caption"
            sx={{ mr: 1, display: { xs: "none", sm: "block" } }}
          >
            {currentUser?.full_name || currentUser?.email} ({currentUser?.role})
          </Typography>
          <Button color="inherit" onClick={handleOpenFaqModal} sx={{ mr: 1 }}>
            FAQs
          </Button>
          <Button color="inherit" variant="outlined" onClick={handleLogout}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ flexGrow: 1, py: 3 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
          }}
        >
          <Typography variant="h5">Conversations</Typography>
          <Tooltip title="Refresh Conversations">
            {/* The refresh button now correctly re-fetches the data for the current tab */}
            <IconButton onClick={handleRefresh} disabled={loading}>
              {loading ? <CircularProgress size={24} /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        <Paper elevation={1}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            indicatorColor="primary"
            textColor="primary"
            variant="fullWidth"
          >
            <Tab label="My Assigned" {...a11yProps(0)} />
            <Tab label="Open Queue" {...a11yProps(1)} />
          </Tabs>
        </Paper>

        {/* *** REFACTORED: Each TabPanel now renders its own, separate list *** */}
        <TabPanel value={tabValue} index={0}>
          {renderConversationsList(assignedConversations)}
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          {renderConversationsList(openConversations)}
        </TabPanel>
      </Container>
    </Box>
  );
}
