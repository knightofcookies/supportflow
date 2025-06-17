// src/App.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  Outlet,
} from "react-router-dom";
import {
  ThemeProvider,
  CssBaseline,
  Snackbar,
  Box,
  CircularProgress,
} from "@mui/material";
import { jwtDecode } from "jwt-decode";
import axios from "axios";

import theme from "./theme/theme";
import Alert from "./components/Common/Alert";

import Login from "./components/Auth/Login";
import CustomerDashboard from "./components/Dashboard/CustomerDashboard";
import CustomerChatPage from "./components/Dashboard/CustomerChatPage";
import AgentDashboard from "./components/Agent/AgentDashboard";
import AgentChatPage from "./components/Agent/AgentChatPage";
import AdminDashboard from "./components/Admin/AdminDashboard";
import AdminChatPage from "./components/Admin/AdminChatPage";
import FAQModal from "./components/FAQ/FAQModal"; // Assuming you want to keep FAQ

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const API_V1_URL = `${API_BASE_URL}/api/v1`;

export const UserRole = {
  customer: "customer",
  agent: "agent",
  admin: "admin",
};

// Context for global state might be beneficial for larger apps, but for now props drilling
export const AppContext = React.createContext(null);

function RequireAuth({ allowedRoles }) {
  const { token, currentUser } = React.useContext(AppContext);
  let location = useLocation();

  if (!token || !currentUser) {
    // Redirect them to the /login page, but save the current location they were
    // trying to go to when they were redirected. This allows us to send them
    // along to that page after they login, which is a nicer user experience
    // than dropping them off on the home page.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    // Redirect to their default dashboard if role not allowed for current path
    console.warn(
      `Auth Warning: User role '${currentUser.role}' not in allowed roles [${allowedRoles.join(", ")}] for path ${location.pathname}`
    );
    if (currentUser.role === UserRole.admin) return <Navigate to="/admin" replace />;
    if (currentUser.role === UserRole.agent) return <Navigate to="/agent" replace />;
    return <Navigate to="/" replace />; // Customer default
  }

  return <Outlet />; // Render child routes
}

function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const handleOpenFaqModal = useCallback(() => setIsFaqModalOpen(true), []);
  const handleCloseFaqModal = useCallback(() => setIsFaqModalOpen(false), []);


  const showSnackbar = useCallback((message, severity = "error") => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleCloseSnackbar = (event, reason) => {
    if (reason === "clickaway") return;
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleLogout = useCallback(() => {
    console.log("handleLogout called");
    localStorage.removeItem("token");
    setToken(null);
    setCurrentUser(null);
    // The Router and RequireAuth will handle navigation to /login
  }, []);

  const makeApiCall = useCallback(
    async (method, endpoint, data = null, config = {}) => {
      const currentToken = localStorage.getItem("token");

      if (!currentToken && !endpoint.startsWith("/auth/token/google")) {
        showSnackbar("Session expired or not logged in.", "error");
        handleLogout(); // This will trigger redirect via auth checks
        throw new Error("Missing token");
      }

      try {
        if (currentToken && !endpoint.startsWith("/auth/token/google")) {
          const decoded = jwtDecode(currentToken);
          if (decoded.exp * 1000 < Date.now()) {
            throw new Error("Token expired");
          }
        }

        const requestConfig = {
          ...config, // 1. Spread the base config first
          method,    // 2. Override or set specific properties
          url: `${API_V1_URL}${endpoint}`,
          headers: {
            ...config.headers, // 3. Spread headers from base config
            // 4. Add or override the Authorization header
            ...(currentToken && { Authorization: `Bearer ${currentToken}` }),
            // You can also add other specific headers here if needed
          },
          data, // 5. Override or set data (if 'data' could also be in 'config')
        };
        const response = await axios(requestConfig);
        return response.data;
      } catch (err) {
        console.error(`API Error: ${method.toUpperCase()} ${API_V1_URL}${endpoint}`, err.response || err);
        const status = err.response?.status;
        const detail = err.response?.data?.detail || err.message || "An unknown error occurred";

        if (
          (status === 401 || status === 403 || err.message === "Token expired") &&
          !endpoint.startsWith("/auth/token/google")
        ) {
          showSnackbar(
            err.message === "Token expired"
              ? "Session expired. Please log in again."
              : `Authentication error: ${detail}. Please log in again.`,
            "error"
          );
          handleLogout();
        } else if (!endpoint.startsWith("/auth/token/google")) { // Don't show generic error for login attempts
          showSnackbar(`${detail} (Status: ${status || "N/A"})`, "error");
        }
        throw err; // Re-throw so calling function can handle it
      }
    },
    [showSnackbar, handleLogout]
  );

  const fetchCurrentUser = useCallback(
    async (currentToken) => {
      if (!currentToken) {
        setCurrentUser(null);
        setLoadingUser(false);
        return;
      }
      setLoadingUser(true);
      try {
        const userData = await makeApiCall("get", "/auth/me");
        setCurrentUser(userData); // Expecting UserOut from backend
      } catch (error) {
        console.error("Error fetching current user:", error.message);
        // makeApiCall handles logout on auth errors, so currentUser should become null
        if (error.message !== "Token expired" && error.response?.status !== 401 && error.response?.status !== 403) {
         // Only show snackbar if it's not an auth error already handled by makeApiCall's logout
          showSnackbar("Failed to fetch user details.", "error");
        }
      } finally {
        setLoadingUser(false);
      }
    },
    [makeApiCall, showSnackbar]
  );

  // Initial token validation and currentUser fetch
  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      try {
        const decoded = jwtDecode(storedToken);
        if (decoded.exp * 1000 > Date.now()) {
          setToken(storedToken);
          fetchCurrentUser(storedToken); // Fetch user if token is valid
        } else {
          console.log("App.jsx: Token found but expired on initial load.");
          handleLogout();
        }
      } catch (error) {
        console.error("App.jsx: Error decoding token on initial load:", error);
        handleLogout();
      }
    }
    setAuthChecked(true);
  }, [handleLogout, fetchCurrentUser]);


  // Effect to refetch current user if token changes (e.g., on login)
  useEffect(() => {
    if (token && authChecked && !currentUser) { // Fetch if token exists, auth checked, but no user yet
        fetchCurrentUser(token);
    } else if (!token && currentUser) { // Clear user if token is removed (logout)
        setCurrentUser(null);
    }
  }, [token, authChecked, currentUser, fetchCurrentUser]);


  if (!authChecked || (token && loadingUser && !currentUser)) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            bgcolor: "background.default",
          }}
        >
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }
  
  const appContextValue = {
    token,
    setToken,
    currentUser,
    setCurrentUser,
    makeApiCall,
    showSnackbar,
    handleLogout,
    handleOpenFaqModal,
  };

  return (
    <AppContext.Provider value={appContextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router basename={import.meta.env.VITE_APP_BASENAME || "/"}>
          <Routes>
            <Route
              path="/login"
              element={
                token && currentUser ? (
                  currentUser.role === UserRole.admin ? (
                    <Navigate to="/admin" replace />
                  ) : currentUser.role === UserRole.agent ? (
                    <Navigate to="/agent" replace />
                  ) : (
                    <Navigate to="/" replace />
                  )
                ) : (
                  <Login />
                )
              }
            />

            {/* Customer Routes */}
            <Route element={<RequireAuth allowedRoles={[UserRole.customer]} />}>
              <Route path="/" element={<CustomerDashboard />} />
              <Route path="/chat/:conversationId" element={<CustomerChatPage />} />
            </Route>

            {/* Agent Routes */}
            <Route element={<RequireAuth allowedRoles={[UserRole.agent, UserRole.admin]} />}>
              <Route path="/agent" element={<AgentDashboard />} />
              <Route path="/agent/chat/:conversationId" element={<AgentChatPage />} />
            </Route>

            {/* Admin Routes */}
            <Route element={<RequireAuth allowedRoles={[UserRole.admin]} />}>
              <Route path="/admin/*" element={<AdminDashboard />} />
              {/* AdminChatPage is now part of AdminDashboard's internal routing or a direct route if preferred */}
              {/* For example, if AdminDashboard handles /admin/conversations and /admin/users,
                  then a chat page could be /admin/chat/:conversationId */}
              <Route path="/admin/chat/:conversationId" element={<AdminChatPage />} />
            </Route>
            
            {/* Catch-all for unauthenticated users or non-matching routes */}
            <Route path="*" element={<Navigate to={token && currentUser ? (currentUser.role === UserRole.admin ? "/admin" : currentUser.role === UserRole.agent ? "/agent" : "/") : "/login"} replace />} />

          </Routes>
        </Router>
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        >
          <Alert
            onClose={handleCloseSnackbar}
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
        <FAQModal open={isFaqModalOpen} onClose={handleCloseFaqModal} />
      </ThemeProvider>
    </AppContext.Provider>
  );
}

export default App;
