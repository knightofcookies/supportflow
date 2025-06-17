// src/components/Admin/UserManagement.jsx
import React, { useState, useEffect, useCallback, useMemo, useContext } from "react";
import {
  Box, Chip, Tooltip, IconButton, CircularProgress, Typography, Avatar,
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Select, MenuItem, FormControlLabel, Switch, TextField
} from "@mui/material";
import { DataGrid, GridActionsCellItem } from "@mui/x-data-grid";
import PersonIcon from "@mui/icons-material/Person";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import SupportAgentIcon from '@mui/icons-material/SupportAgent'; // For Agent
import BlockIcon from "@mui/icons-material/Block";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditIcon from "@mui/icons-material/Edit";
import { AppContext, UserRole } from "../../App";
import { formatBackendStringToIstDisplay } from "../../utils/dateTimeUtils";

const UserEditModal = ({ open, onClose, user, onSave }) => {
  const { makeApiCall, showSnackbar } = useContext(AppContext);
  const [formData, setFormData] = useState({
    full_name: "",
    role: UserRole.customer,
    is_active: true,
    is_blocked: false,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || "",
        role: user.role || UserRole.customer,
        is_active: user.is_active !== undefined ? user.is_active : true,
        is_blocked: user.is_blocked || false,
      });
    }
  }, [user]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Construct payload with only changed fields to be safe, or send all as per UserUpdateByAdmin
      const payload = {
        full_name: formData.full_name !== user.full_name ? formData.full_name : undefined,
        role: formData.role !== user.role ? formData.role : undefined,
        is_active: formData.is_active !== user.is_active ? formData.is_active : undefined,
        is_blocked: formData.is_blocked !== user.is_blocked ? formData.is_blocked : undefined,
      };
      // Filter out undefined values
      const definedPayload = Object.fromEntries(Object.entries(payload).filter(([_, v]) => v !== undefined));

      if (Object.keys(definedPayload).length === 0) {
        showSnackbar("No changes detected.", "info");
        onClose();
        setLoading(false);
        return;
      }

      await makeApiCall("patch", `/admin/users/${user.id}`, definedPayload);
      showSnackbar(`User ${user.email} updated successfully.`, "success");
      onSave(); // This will trigger a refetch in UserManagement
      onClose();
    } catch (error) {
      // Error is handled by makeApiCall
      showSnackbar(`Failed to update user: ${error.message || 'Unknown error'}`, "error");
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Edit User: {user.email}</DialogTitle>
      <DialogContent>
        <TextField
          label="Full Name"
          name="full_name"
          value={formData.full_name}
          onChange={handleChange}
          fullWidth
          margin="normal"
          variant="outlined"
        />
        <FormControlLabel
          control={
            <Select
              name="role"
              value={formData.role}
              onChange={handleChange}
              fullWidth
              variant="outlined"
            >
              {Object.values(UserRole).map(role => (
                <MenuItem key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</MenuItem>
              ))}
            </Select>
          }
          label="Role"
          labelPlacement="top"
          sx={{mt:1, width: '100%'}}
        />
        <FormControlLabel
          control={<Switch checked={formData.is_active} onChange={handleChange} name="is_active" />}
          label="Active"
          sx={{mt:1}}
        />
        <FormControlLabel
          control={<Switch checked={formData.is_blocked} onChange={handleChange} name="is_blocked" />}
          label="Blocked"
          sx={{mt:1}}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={loading}>
          {loading ? <CircularProgress size={24} /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};


const UserManagement = () => {
  const { makeApiCall, showSnackbar, currentUser } = useContext(AppContext);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
  const [rowCount, setRowCount] = useState(0);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);


  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // For simplicity, fetching all users. Implement server-side pagination if list grows very large.
      const data = await makeApiCall("get", `/admin/users?skip=${paginationModel.page * paginationModel.pageSize}&limit=${paginationModel.pageSize}`);
      // Assuming API might return total count in future: { items: [], total: number }
      // For now, if it's just an array:
      setUsers(Array.isArray(data) ? data : []);
      // If your API doesn't provide total, you might need to adjust DataGrid's rowCount logic
      // or fetch all and do client-side pagination (not ideal for very large datasets).
      // For this example, let's assume client-side pagination if no total or manual count.
      // For server-side, you'd get 'total' from API.
      // setRowCount(data.total || (Array.isArray(data) ? data.length : 0));
      setRowCount(Array.isArray(data) ? data.length : 0); // Simplistic for now
      if(paginationModel.pageSize * (paginationModel.page +1) < (data.total || data.length)){
         // This is a basic check, actual server-side pagination needs more robust rowCount
         // For now, if the API directly supports skip/limit, DataGrid can use it.
         // If API returns total, use that.
         // If API always returns one page of data, then rowCount might need to be approximated or fetched separately.
      }

    } catch (error) {
      setUsers([]);
      setRowCount(0);
    } finally {
      setLoading(false);
    }
  }, [makeApiCall, paginationModel.page, paginationModel.pageSize]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleEditUser = (userToEdit) => {
    setEditingUser(userToEdit);
    setEditModalOpen(true);
  };
  
  const handleCloseEditModal = () => {
    setEditModalOpen(false);
    setEditingUser(null);
  };
  
  const handleSaveUser = () => {
    fetchUsers(); // Re-fetch users after saving changes
  };

  const columns = useMemo(() => [
    { field: "id", headerName: "ID", width: 70 },
    { 
      field: "profile_pic_url", 
      headerName: "Avatar", 
      width: 80,
      renderCell: (params) => <Avatar src={params.value} alt={params.row.full_name} />,
      sortable: false,
      filterable: false,
    },
    { field: "full_name", headerName: "Name", width: 180, valueGetter: (value, row) => row.full_name || "N/A" },
    { field: "email", headerName: "Email", width: 250 },
    {
      field: "role", headerName: "Role", width: 120,
      renderCell: (params) => {
        let icon = <PersonIcon />;
        if (params.value === UserRole.admin) icon = <AdminPanelSettingsIcon />;
        else if (params.value === UserRole.agent) icon = <SupportAgentIcon />;
        return <Chip icon={icon} label={params.value.charAt(0).toUpperCase() + params.value.slice(1)} size="small" variant="outlined" />;
      },
    },
    {
      field: "is_active", headerName: "Active", width: 100, type: 'boolean',
      renderCell: (params) => params.value ? <CheckCircleOutlineIcon color="success"/> : <BlockIcon color="disabled"/>
    },
    {
      field: "is_blocked", headerName: "Blocked", width: 100, type: 'boolean',
      renderCell: (params) => params.value ? <BlockIcon color="error"/> : <CheckCircleOutlineIcon color="disabled"/>
    },
    {
      field: "created_at", headerName: "Joined (IST)", width: 180,
      renderCell: (params) => formatBackendStringToIstDisplay(params.row.created_at),
    },
    {
      field: "actions", type: "actions", headerName: "Actions", width: 100,
      getActions: ({ row }) => [
        <GridActionsCellItem
          icon={<EditIcon />}
          label="Edit"
          onClick={() => handleEditUser(row)}
          disabled={row.id === currentUser?.id && row.role === UserRole.admin} // Prevent admin editing self this way
        />,
      ],
    },
  ], [currentUser, handleEditUser]);

  return (
    <Box sx={{ height: "100%", width: "100%" }}> {/* Adjust height as needed */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5">User Management</Typography>
        <Tooltip title="Refresh Users">
          <IconButton onClick={fetchUsers} disabled={loading}>
            {loading ? <CircularProgress size={24} /> : <RefreshIcon />}
          </IconButton>
        </Tooltip>
      </Box>
      <DataGrid
        rows={users}
        columns={columns}
        loading={loading}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[10, 25, 50]}
        rowCount={rowCount} // Use this if server-side pagination, otherwise DataGrid handles it for client-side
        paginationMode="server" // Change to "client" if not using server-side pagination for users
        checkboxSelection={false}
        disableRowSelectionOnClick
        autoHeight={false} // Important for fixed height container
        sx={{ border: 0 }}
      />
      {editingUser && (
        <UserEditModal
          open={editModalOpen}
          onClose={handleCloseEditModal}
          user={editingUser}
          onSave={handleSaveUser}
        />
      )}
    </Box>
  );
};

export default UserManagement;
