// src/components/Auth/Login.jsx
import React, { useState, useEffect, useCallback, useContext } from "react";
import { AppContext } from "../../App";
import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Button as MuiButton,
} from "@mui/material";
import Alert from "../Common/Alert";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

function Footer() {
  const { handleOpenFaqModal } = useContext(AppContext);
  return (
    <footer
      style={{
        marginTop: "20px",
        padding: "20px",
        backgroundColor: "inherit",
        textAlign: "center",
        borderTop: "1px solid #ddd",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "0.5px",
      }}
    >
      <MuiButton
        onClick={handleOpenFaqModal}
        variant="text"
        sx={{ textTransform: "none", color: "#ffffff", ml: 2 }}
      >
        FAQs
      </MuiButton>
    </footer>
  );
}

function Login() {
  const { setToken, makeApiCall, showSnackbar } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [googleReady, setGoogleReady] = useState(false);


  useEffect(() => {
    if (
      !GOOGLE_CLIENT_ID ||
      GOOGLE_CLIENT_ID === "YOUR_GOOGLE_CLIENT_ID_HERE" || // Default Vite placeholder if not set
      GOOGLE_CLIENT_ID === ""
    ) {
      setError(
        "Google Sign-In is not configured correctly. Please contact support.",
      );
      setGoogleReady(false);
    } else {
      setGoogleReady(true);
    }
  }, []);

  const handleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError(null);
    try {
      // makeApiCall will use API_V1_URL internally
      const response = await makeApiCall("post", "/auth/token/google", {
        credential: credentialResponse.credential,
      });
      const newToken = response.access_token; // Backend sends { access_token, token_type, user }
      localStorage.setItem("token", newToken);
      setToken(newToken); // This will trigger App.jsx to fetchUser and redirect
      // No navigation here, App.jsx handles it
    } catch (err) {
      console.error("Login Error:", err.response?.data?.detail || err.message);
      const errorMsg =
        err.response?.data?.detail ||
        err.message ||
        "Login failed. Please try again.";
      setError(errorMsg);
      showSnackbar(errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleError = (errorResponse) => {
    console.error("Google Sign-In Failed:", errorResponse);
    const msg = "Google Sign-In failed. Please ensure pop-ups are enabled or try again.";
    setError(msg);
    showSnackbar(msg, "error");
    setLoading(false);
  };


  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          background: "linear-gradient(135deg, hotpink 0%, blue 100%)",
          backgroundSize: "cover",
          backgroundAttachment: "fixed",
          p: 2,
          overflow: "hidden",
        }}
      >
        <Paper
          elevation={8}
          sx={{
            p: { xs: 4, sm: 6 },
            maxWidth: { xs: "95%", sm: 420 },
            width: "100%",
            textAlign: "center",
            borderRadius: 5,
            backgroundColor: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              color: "#E0E0FF",
              letterSpacing: "0.05em",
              textShadow: "1px 1px 2px rgba(0,0,0,0.1)",
              mb: 1,
            }}
          >
            Support Flow
          </Typography>
          <Typography variant="body1" sx={{ color: "#C0C0E0", mb: 2 }}>
            Sign in to connect with our support team
          </Typography>

          {error && (
            <Alert
              severity="error"
              sx={{
                width: "100%",
                textAlign: "left",
                bgcolor: "rgba(255, 0, 0, 0.1)",
                color: "#ffcccc",
                "& .MuiAlert-icon": { color: "#ffcccc" },
                border: "1px solid rgba(255, 0, 0, 0.2)",
              }}
            >
              {error}
            </Alert>
          )}

          {loading ? (
            <CircularProgress sx={{ color: "#A74AFF" }} />
          ) : !googleReady ? (
            <Typography color="error" variant="body2" sx={{ color: "#ffcccc" }}>
              Sign-In Currently Unavailable
            </Typography>
          ) : (
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={handleError}
              useOneTap
              theme="outline"
              size="large"
              shape="pill"
            />
          )}
        </Paper>
        <Footer />
      </Box>
    </GoogleOAuthProvider>
  );
}

export default Login;
