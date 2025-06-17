// src/components/Admin/AdminDashboard.jsx
import React, { useState, useContext } from "react";
import {
  Routes,
  Route,
  Link as RouterLink,
  Outlet,
  useLocation,
} from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Toolbar,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Drawer,
  IconButton,
  Divider,
} from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import PeopleIcon from "@mui/icons-material/People";
import ForumIcon from "@mui/icons-material/Forum";
import MenuIcon from "@mui/icons-material/Menu";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { AppContext } from "../../App";
import UserManagement from "./UserManagement";
import ConversationManagement from "./ConversationManagement";

const drawerWidth = 240;

const drawerItems = [
  { text: "Users", icon: <PeopleIcon />, path: "/admin/users" },
  { text: "Conversations", icon: <ForumIcon />, path: "/admin/conversations" },
];

function AdminDashboard() {
  const { currentUser, handleLogout, handleOpenFaqModal } =
    useContext(AppContext);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <Box>
      <Toolbar>
        <AdminPanelSettingsIcon sx={{ mr: 1 }} />
        <Typography variant="h6">Admin</Typography>
      </Toolbar>
      <Divider />
      <List>
        {drawerItems.map((item) => (
          <ListItem
            key={item.text}
            disablePadding
            component={RouterLink}
            to={item.path}
            onClick={handleDrawerToggle}
            sx={{ color: "text.primary" }}
          >
            <ListItemButton selected={location.pathname === item.path}>
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider sx={{ mt: 2 }} />
      <Button color="inherit" onClick={handleOpenFaqModal} sx={{ m: 2 }}>
        FAQs
      </Button>
      <Button
        color="error"
        variant="outlined"
        onClick={handleLogout}
        sx={{ m: 2 }}
      >
        Logout
      </Button>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <AdminPanelSettingsIcon
            sx={{ display: { xs: "none", md: "flex" }, mr: 1 }}
          />
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Admin Panel
          </Typography>

          {/* Desktop Navigation in AppBar */}
          <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1, mr: 2 }}>
            {drawerItems.map((item) => (
              <Button
                key={item.text}
                component={RouterLink}
                to={item.path}
                color="inherit"
                variant={location.pathname === item.path ? "outlined" : "text"}
              >
                {item.text}
              </Button>
            ))}
          </Box>

          <Typography
            variant="caption"
            sx={{ mr: 2, display: { xs: "none", sm: "block" } }}
          >
            {currentUser?.full_name || currentUser?.email}
          </Typography>

          <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1 }}>
            <Button color="inherit" onClick={handleOpenFaqModal}>
              FAQs
            </Button>
            <Button color="inherit" variant="outlined" onClick={handleLogout}>
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Mobile-only Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth },
        }}
      >
        {drawer}
      </Drawer>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, sm: 3 },
          mt: "64px", // For AppBar height
          bgcolor: "background.default",
          height: "calc(100vh - 64px)",
          overflow: "auto",
        }}
      >
        <Routes>
          <Route
            index
            element={
              <Typography variant="h5">
                Welcome, Admin! Select a section.
              </Typography>
            }
          />
          <Route path="users" element={<UserManagement />} />
          <Route path="conversations" element={<ConversationManagement />} />
        </Routes>
        <Outlet />
      </Box>
    </Box>
  );
}

export default AdminDashboard;
