// src/components/Admin/ConversationManagement.jsx
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useContext,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Chip,
  Tooltip,
  IconButton,
  CircularProgress,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid as MuiGrid,
  Paper,
  TextField,
  Autocomplete,
} from "@mui/material";
import { DataGrid, GridActionsCellItem } from "@mui/x-data-grid";
import ChatIcon from "@mui/icons-material/Chat";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import SummarizeIcon from "@mui/icons-material/Summarize";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import { AppContext, UserRole } from "../../App";
import getStatusChip, {
  ConversationStatusEnum,
} from "../../utils/getStatusChip";
import { formatBackendStringToIstDisplay } from "../../utils/dateTimeUtils";

const AssignAgentModal = ({
  open,
  onClose,
  conversation,
  agents,
  onAssigned,
}) => {
  const { makeApiCall, showSnackbar } = useContext(AppContext);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (conversation) {
      setSelectedAgentId(conversation.agent_id || "");
    }
  }, [conversation]);

  const handleAssign = async () => {
    if (!conversation || !selectedAgentId) {
      showSnackbar("Please select an agent.", "warning");
      return;
    }
    setLoading(true);
    try {
      await makeApiCall(
        "post",
        `/admin/conversations/${conversation.id}/assign`,
        { agent_id: selectedAgentId }
      );
      showSnackbar(`Conversation assigned successfully.`, "success");
      onAssigned();
      onClose();
    } catch (error) {
      // makeApiCall handles snackbar
    } finally {
      setLoading(false);
    }
  };

  if (!conversation) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Assign Agent to Conv. #{conversation.id}</DialogTitle>
      <DialogContent>
        <FormControl fullWidth margin="normal">
          <InputLabel id="agent-select-label">Agent</InputLabel>
          <Select
            labelId="agent-select-label"
            value={selectedAgentId}
            label="Agent"
            onChange={(e) => setSelectedAgentId(e.target.value)}
            disabled={loading}
          >
            <MenuItem value="">
              <em>Unassign / Select Agent</em>
            </MenuItem>
            {agents.map((agent) => (
              <MenuItem key={agent.id} value={agent.id}>
                {agent.full_name || agent.email} ({agent.email})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleAssign}
          variant="contained"
          disabled={loading || !selectedAgentId}
        >
          {loading ? <CircularProgress size={24} /> : "Assign"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const UpdateStatusModal = ({
  open,
  onClose,
  conversation,
  onStatusUpdated,
}) => {
  const { makeApiCall, showSnackbar } = useContext(AppContext);
  const [newStatus, setNewStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (conversation) {
      setNewStatus(conversation.status || "");
    }
  }, [conversation]);

  const handleUpdate = async () => {
    if (!conversation || !newStatus) {
      showSnackbar("Please select a status.", "warning");
      return;
    }
    setLoading(true);
    try {
      await makeApiCall("patch", `/conversations/${conversation.id}/status`, {
        new_status: newStatus,
      });
      showSnackbar("Conversation status updated.", "success");
      onStatusUpdated();
      onClose();
    } catch (error) {
      /* Handled by makeApiCall */
    } finally {
      setLoading(false);
    }
  };
  if (!conversation) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Update Status for Conv. #{conversation.id}</DialogTitle>
      <DialogContent>
        <FormControl fullWidth margin="normal">
          <InputLabel id="status-select-label">Status</InputLabel>
          <Select
            labelId="status-select-label"
            value={newStatus}
            label="Status"
            onChange={(e) => setNewStatus(e.target.value)}
            disabled={loading}
          >
            {Object.values(ConversationStatusEnum).map((statusVal) => (
              <MenuItem key={statusVal} value={statusVal}>
                {statusVal.charAt(0).toUpperCase() +
                  statusVal.slice(1).replace("_", " ")}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleUpdate}
          variant="contained"
          disabled={loading || !newStatus}
        >
          Update
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ConversationManagement = () => {
  const { makeApiCall, showSnackbar } = useContext(AppContext);
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 10,
  });
  const [rowCount, setRowCount] = useState(0);
  const [filters, setFilters] = useState({
    status: "",
    customer_id: null,
    agent_id: null,
  });

  const [users, setUsers] = useState([]);
  const [agents, setAgents] = useState([]);

  const [assignModal, setAssignModal] = useState({
    open: false,
    conversation: null,
  });
  const [statusModal, setStatusModal] = useState({
    open: false,
    conversation: null,
  });

  const fetchInitialData = useCallback(async () => {
    try {
      const usersData = await makeApiCall("get", "/admin/users?limit=1000");
      setUsers(Array.isArray(usersData) ? usersData : []);
      setAgents(
        Array.isArray(usersData)
          ? usersData.filter(
              (u) => u.role === UserRole.agent || u.role === UserRole.admin
            )
          : []
      );
    } catch (error) {
      showSnackbar("Failed to load user data for filters.", "error");
    }
  }, [makeApiCall, showSnackbar]);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    let queryParams = `skip=${
      paginationModel.page * paginationModel.pageSize
    }&limit=${paginationModel.pageSize}`;
    if (filters.status) queryParams += `&status=${filters.status}`;
    if (filters.customer_id)
      queryParams += `&customer_id=${filters.customer_id}`;
    if (filters.agent_id) queryParams += `&agent_id=${filters.agent_id}`;

    try {
      const data = await makeApiCall(
        "get",
        `/admin/conversations?${queryParams}`
      );
      setConversations(Array.isArray(data) ? data : []);
      setRowCount(Array.isArray(data) ? data.length : 0);
    } catch (error) {
      setConversations([]);
      setRowCount(0);
    } finally {
      setLoading(false);
    }
  }, [makeApiCall, paginationModel, filters]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleFilterChange = (filterName, value) => {
    setFilters((prev) => ({ ...prev, [filterName]: value }));
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  };

  const handleSummarize = async (convId) => {
    if (
      !window.confirm(
        `Generate summary for Conversation #${convId}? This may take a moment.`
      )
    )
      return;
    try {
      setLoading(true);
      await makeApiCall("post", `/admin/conversations/${convId}/summarize`);
      showSnackbar(
        "Summary generation initiated. Refresh to see results.",
        "success"
      );
      fetchConversations();
    } catch (error) {
      // makeApiCall shows error
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo(
    () => [
      { field: "id", headerName: "ID", width: 90 },
      {
        field: "subject",
        headerName: "Subject",
        width: 200,
        valueGetter: (v, row) => row.subject || "N/A",
      },
      {
        field: "customer",
        headerName: "Customer",
        width: 200,
        valueGetter: (v, row) =>
          row.customer?.full_name ||
          row.customer?.email ||
          `ID: ${row.customer_id}`,
      },
      {
        field: "agent",
        headerName: "Agent",
        width: 200,
        valueGetter: (v, row) =>
          row.agent?.full_name ||
          row.agent?.email ||
          (row.agent_id ? `ID: ${row.agent_id}` : "Unassigned"),
      },
      {
        field: "status",
        headerName: "Status",
        width: 150,
        renderCell: (params) => {
          const statusInfo = getStatusChip(params.value);
          return (
            <Chip
              icon={statusInfo.icon}
              label={statusInfo.label}
              color={statusInfo.color}
              size="small"
            />
          );
        },
      },
      {
        field: "summary",
        headerName: "Summary",
        width: 150,
        valueGetter: (v, row) => (row.summary ? "Generated" : "None"),
        renderCell: (params) =>
          params.row.summary ? (
            <Tooltip title={params.row.summary}>
              <Chip label="View" size="small" variant="outlined" />
            </Tooltip>
          ) : (
            "None"
          ),
      },
      {
        field: "last_message_at",
        headerName: "Last Update (IST)",
        width: 180,
        valueGetter: (v, row) =>
          formatBackendStringToIstDisplay(
            row.last_message_at || row.created_at
          ),
      },
      {
        field: "actions",
        type: "actions",
        headerName: "Actions",
        width: 180,
        getActions: ({ row }) => [
          <GridActionsCellItem
            icon={<ChatIcon />}
            label="Open Chat"
            onClick={() => navigate(`/admin/chat/${row.id}`)}
          />,
          <GridActionsCellItem
            icon={<AssignmentIndIcon />}
            label="Assign Agent"
            onClick={() => setAssignModal({ open: true, conversation: row })}
          />,
          <GridActionsCellItem
            icon={<EditIcon />}
            label="Update Status"
            onClick={() => setStatusModal({ open: true, conversation: row })}
          />,
          <GridActionsCellItem
            icon={<SummarizeIcon />}
            label="Generate Summary"
            onClick={() => handleSummarize(row.id)}
            disabled={
              !(
                row.status === ConversationStatusEnum.resolved ||
                row.status === ConversationStatusEnum.closed
              )
            }
          />,
        ],
      },
    ],
    [navigate, handleSummarize]
  );

  return (
    <Box sx={{ height: "100%", width: "100%" }}>
      <Typography variant="h5" gutterBottom>
        Conversation Management
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <MuiGrid container spacing={2} alignItems="center">
          <MuiGrid item xs={12} sm={4}>
            <FormControl fullWidth size="small" sx={{ minWidth: 90 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.status}
                label="Status"
                onChange={(e) => handleFilterChange("status", e.target.value)}
              >
                <MenuItem value="">
                  <em>All Statuses</em>
                </MenuItem>
                {Object.values(ConversationStatusEnum).map((s) => (
                  <MenuItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </MuiGrid>
          <MuiGrid item xs={12} sm={3}>
            <Autocomplete
              options={users}
              getOptionLabel={(option) => option.full_name || option.email}
              onChange={(event, newValue) =>
                handleFilterChange("customer_id", newValue ? newValue.id : null)
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Customer"
                  variant="outlined"
                  size="small"
                />
              )}
              size="large"
              sx={{ minWidth: 115 }}
            />
          </MuiGrid>
          <MuiGrid item xs={12} sm={3}>
            <Autocomplete
              options={agents}
              getOptionLabel={(option) => option.full_name || option.email}
              onChange={(event, newValue) =>
                handleFilterChange("agent_id", newValue ? newValue.id : null)
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Agent"
                  variant="outlined"
                  size="small"
                />
              )}
              size="large"
            />
          </MuiGrid>
          <MuiGrid
            item
            xs={12}
            sm={2}
            sx={{ textAlign: { xs: "left", sm: "right" } }}
          >
            <Tooltip title="Refresh Conversations">
              <IconButton onClick={fetchConversations} disabled={loading}>
                {loading ? <CircularProgress size={24} /> : <RefreshIcon />}
              </IconButton>
            </Tooltip>
          </MuiGrid>
        </MuiGrid>
      </Paper>

      <DataGrid
        rows={conversations}
        columns={columns}
        loading={loading}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[10, 25, 50]}
        rowCount={rowCount}
        paginationMode="server"
        checkboxSelection={false}
        disableRowSelectionOnClick
        autoHeight={false}
        sx={{ border: 0 }}
      />

      {assignModal.open && (
        <AssignAgentModal
          open={assignModal.open}
          onClose={() => setAssignModal({ open: false, conversation: null })}
          conversation={assignModal.conversation}
          agents={agents}
          onAssigned={fetchConversations}
        />
      )}
      {statusModal.open && (
        <UpdateStatusModal
          open={statusModal.open}
          onClose={() => setStatusModal({ open: false, conversation: null })}
          conversation={statusModal.conversation}
          onStatusUpdated={fetchConversations}
        />
      )}
    </Box>
  );
};

export default ConversationManagement;
