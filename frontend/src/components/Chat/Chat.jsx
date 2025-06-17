// src/components/Chat/Chat.jsx
import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useContext,
} from "react";
import { AppContext, UserRole } from "../../App";
import useSocketIO from "../../hooks/useSocketIO";
import {
  Box,
  Paper,
  Typography,
  TextField,
  IconButton,
  InputAdornment,
  Stack,
  Tooltip,
  Chip,
  Alert as MuiAlert,
  CircularProgress,
  LinearProgress,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  Button as MuiButton,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import SendIcon from "@mui/icons-material/Send";
import CloseIcon from "@mui/icons-material/Close";
import GroupIcon from "@mui/icons-material/Group";
import PersonIcon from "@mui/icons-material/Person";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import CancelIcon from "@mui/icons-material/Cancel";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import AudioFileIcon from "@mui/icons-material/AudioFile";
import VideoFileIcon from "@mui/icons-material/VideoFile";
import ImageIcon from "@mui/icons-material/Image";
import ParticipantsDialog from "./ParticipantsDialog";
import getStatusChip, {
  ConversationStatusEnum,
} from "../../utils/getStatusChip";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const MAX_FILE_SIZE_MB =
  parseInt(import.meta.env.VITE_MAX_CHAT_FILE_SIZE_MB) || 15;

// (fetchAndCreateObjectUrl, AuthorizedMediaDisplay, and FilePreview components remain the same)
// ... they are included here for completeness ...
const fetchAndCreateObjectUrl = async (apiRelativeUrl, token) => {
  try {
    const response = await fetch(`${API_BASE_URL}${apiRelativeUrl}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ detail: response.statusText }));
      throw new Error(
        `Failed to fetch media: ${response.status} ${errorData.detail || ""}`
      );
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (error) {
    console.error("Error in fetchAndCreateObjectUrl:", error);
    throw error;
  }
};

const AuthorizedMediaDisplay = ({ fileInfo, token, type, onImageClick }) => {
  const [mediaSrc, setMediaSrc] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!fileInfo.url || !token) {
      setError("Missing file URL or token.");
      setIsLoading(false);
      return;
    }
    let objectUrl = null;
    const loadMedia = async () => {
      setIsLoading(true);
      setError(null);
      try {
        objectUrl = await fetchAndCreateObjectUrl(fileInfo.url, token);
        setMediaSrc(objectUrl);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    loadMedia();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileInfo.url, token, type]);

  if (isLoading) return <CircularProgress size={20} sx={{ m: 1 }} />;
  if (error)
    return (
      <Tooltip title={error}>
        <Typography
          variant="caption"
          color="error"
          sx={{ p: 1, cursor: "help" }}
        >
          Error
        </Typography>
      </Tooltip>
    );
  if (!mediaSrc)
    return (
      <Typography variant="caption" sx={{ p: 1 }}>
        Loading...
      </Typography>
    );

  if (type === "image") {
    return (
      <Box
        component="img"
        src={mediaSrc}
        alt={fileInfo.name}
        onClick={() => onImageClick(mediaSrc, fileInfo.name)}
        sx={{
          maxWidth: "100%",
          maxHeight: "200px",
          objectFit: "contain",
          borderRadius: 1,
          cursor: "pointer",
          mb: 1,
          border: "1px solid #eee",
        }}
      />
    );
  }
  if (type === "video") {
    return (
      <video
        controls
        src={mediaSrc}
        style={{
          maxWidth: "100%",
          maxHeight: "250px",
          borderRadius: "4px",
          marginBottom: "8px",
          border: "1px solid #eee",
        }}
      />
    );
  }
  if (type === "audio") {
    return (
      <audio
        controls
        src={mediaSrc}
        style={{ width: "100%", marginBottom: "8px" }}
      />
    );
  }
  return null;
};

const FilePreview = ({ file, onRemove }) => {
  const theme = useTheme();
  return (
    <Paper
      elevation={1}
      sx={{
        p: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        mb: 1,
        bgcolor: alpha(theme.palette.background.default, 0.85),
        borderRadius: "8px",
      }}
    >
      <Typography
        variant="body2"
        noWrap
        sx={{ maxWidth: "calc(100% - 40px)", fontSize: "0.8rem" }}
      >
        {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
      </Typography>
      <IconButton
        size="small"
        onClick={onRemove}
        aria-label="remove selected file"
      >
        <CancelIcon fontSize="small" />
      </IconButton>
    </Paper>
  );
};

export default function Chat({ conversationId, onBackToList }) {
  const theme = useTheme();
  const { token, currentUser, makeApiCall, showSnackbar } =
    useContext(AppContext);

  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [conversationDetails, setConversationDetails] = useState(null);

  const [participants, setParticipants] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const [imagePreviewDialog, setImagePreviewDialog] = useState({
    open: false,
    url: null,
    title: "",
  });
  const [participantsDialogOpen, setParticipantsDialogOpen] = useState(false);
  const [isLoadingInitialDetails, setIsLoadingInitialDetails] = useState(true);
  const [generalError, setGeneralError] = useState(null);

  const messageEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Socket.IO event handlers
  const handleSocketErrorMessage = useCallback(
    (errorData) => {
      console.error("Socket Error Message:", errorData);
      const message = errorData.message || "An error occurred in the chat.";
      if (
        errorData.conversation_id &&
        errorData.conversation_id !== conversationId
      )
        return;
      setGeneralError(message);
      showSnackbar(message, "error");
    },
    [conversationId, showSnackbar]
  );

  const handleNewMessage = useCallback(
    (msgPayload) => {
      if (msgPayload.conversation_id !== conversationId) return;
      setMessages((prev) => [...prev, msgPayload]);
      setTypingUsers((prev) => {
        const newTyping = { ...prev };
        delete newTyping[msgPayload.sender_id];
        return newTyping;
      });
    },
    [conversationId]
  );

  const handleSystemMessage = useCallback(
    (sysMsgPayload) => {
      if (sysMsgPayload.conversation_id !== conversationId) return;
      const augmentedSystemMessage = {
        ...sysMsgPayload,
        type: "system",
        sender_id: "system",
        sender_name: "System",
        sender_role: UserRole.admin,
        content: { text: sysMsgPayload.text },
        timestamp: sysMsgPayload.timestamp || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, augmentedSystemMessage]);
    },
    [conversationId]
  );

  const handleParticipantUpdate = useCallback(
    (data) => {
      if (data.conversation_id !== conversationId) return;
      setParticipants(data.participants || []);
    },
    [conversationId]
  );

  const handleConversationJoined = useCallback((data) => {
      // FIX: Check for data.id, which matches the object sent by the backend.
      if (data.id !== conversationId) return;

      // This console.log should now appear in your browser's developer console.
      console.log("Successfully processed 'conversation_joined' event:", data);

      setConversationDetails(data);
      setMessages(data.history || []);
      setIsLoadingInitialDetails(false); // This will now be called, removing the spinner.
      setGeneralError(null);
  }, [conversationId]); // Dependencies are correct.

  const handleConversationStatusUpdate = useCallback(
    (data) => {
      if (data.conversation_id !== conversationId) return;
      if (data.detail?.new_status) {
        setConversationDetails((prev) =>
          prev ? { ...prev, status: data.detail.new_status } : null
        );
        showSnackbar(
          `Conversation status updated to: ${data.detail.new_status}`,
          "info"
        );
      }
    },
    [conversationId, showSnackbar]
  );

  const handleConversationAssigned = useCallback(
    (data) => {
      if (data.conversation_id !== conversationId) return;
      if (data.detail?.agent_id && data.detail?.agent_name) {
        setConversationDetails((prev) =>
          prev
            ? {
                ...prev,
                agent: {
                  ...prev.agent,
                  id: data.detail.agent_id,
                  full_name: data.detail.agent_name,
                },
                status: data.detail.new_status || prev.status,
              }
            : null
        );
        showSnackbar(
          `Conversation assigned to: ${data.detail.agent_name}`,
          "info"
        );
      }
    },
    [conversationId, showSnackbar]
  );

  const handleTypingStart = useCallback(
    (data) => {
      if (
        data.conversation_id !== conversationId ||
        data.user_id === currentUser?.id
      )
        return;
      setTypingUsers((prev) => ({ ...prev, [data.user_id]: data.user_name }));
    },
    [conversationId, currentUser?.id]
  );

  const handleTypingStop = useCallback(
    (data) => {
      if (
        data.conversation_id !== conversationId ||
        data.user_id === currentUser?.id
      )
        return;
      setTypingUsers((prev) => {
        const newTyping = { ...prev };
        delete newTyping[data.user_id];
        return newTyping;
      });
    },
    [conversationId, currentUser?.id]
  );

  // FIX #1: The emitEvent function from useSocketIO is now a dependency for onConnectCb
  // We will define onConnectCb with useCallback to make it stable.
  // The 'emitEvent' itself is guaranteed to be stable by the useSocketIO hook.
  const onConnectCb = useCallback(() => {
    if (conversationId) {
      console.log(
        `Socket connected/reconnected. Joining conversation ${conversationId}.`
      );
      // This is now the ONLY place we emit 'join_conversation'
      emitEvent("join_conversation", { conversation_id: conversationId });
      setIsLoadingInitialDetails(true); // Set loading state while waiting for join confirmation
    }
  }, [conversationId /* emitEvent */]); // emitEvent is stable and can be omitted if you prefer

  const socketEventHandlers = useMemo(
    () => ({
      // REMOVED: onConnectionAck no longer needs to join. It's just a log now.
      onConnectionAck: (data) => console.log("Socket Connection ACK:", data),
      onErrorMessage: handleSocketErrorMessage,
      onNewMessage: handleNewMessage,
      onSystemMessage: handleSystemMessage,
      onParticipantUpdate: handleParticipantUpdate,
      onConversationJoined: handleConversationJoined,
      onConversationStatusUpdate: handleConversationStatusUpdate,
      onConversationAssigned: handleConversationAssigned,
      onTypingStartBroadcast: handleTypingStart,
      onTypingStopBroadcast: handleTypingStop,
      // FIX #2: Pass the STABLE onConnectCb function here. No more inline functions.
      onConnectCb: onConnectCb,
    }),
    [
      // This dependency array is now much more stable.
      handleSocketErrorMessage,
      handleNewMessage,
      handleSystemMessage,
      handleParticipantUpdate,
      handleConversationJoined,
      handleConversationStatusUpdate,
      handleConversationAssigned,
      handleTypingStart,
      handleTypingStop,
      onConnectCb,
    ]
  );

  const { isConnected, socketError, emitEvent } = useSocketIO(
    token,
    socketEventHandlers
  );

  // This useEffect now only handles leaving the conversation on component unmount.
  useEffect(() => {
    return () => {
      if (isConnected && conversationId) {
        emitEvent("leave_conversation", { conversation_id: conversationId });
      }
    };
  }, [conversationId, isConnected, emitEvent]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // All other functions (handleFileChange, sendCurrentMessage, etc.) remain the same.
  // ... they are included here for completeness ...
  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) {
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setUploadError(`Max file size is ${MAX_FILE_SIZE_MB}MB.`);
        setSelectedFile(null);
        return;
      }
      setSelectedFile(f);
      setUploadError(null);
    }
    if (e.target) e.target.value = null; // Reset file input
  };

  const removeSelectedFile = useCallback(() => {
    setSelectedFile(null);
    setUploadError(null);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const sendCurrentMessage = useCallback(async () => {
    const textContent = newMessageText.trim();
    if (!textContent && !selectedFile) return;
    if (
      !isConnected ||
      !conversationDetails ||
      conversationDetails.status === ConversationStatusEnum.closed
    ) {
      showSnackbar(
        "Cannot send message. Chat is not active or closed.",
        "warning"
      );
      return;
    }

    if (selectedFile) {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadError(null);
      const formData = new FormData();
      formData.append("file", selectedFile);
      try {
        await makeApiCall(
          "post",
          `/conversations/${conversationId}/attachments`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = progressEvent.total
                ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                : 0;
              setUploadProgress(percentCompleted);
            },
          }
        );
      } catch (err) {
        setUploadError(
          err.response?.data?.detail || err.message || "File upload failed."
        );
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
        removeSelectedFile();
      }
    }

    if (textContent) {
      const messageToSend = {
        conversation_id: conversationId,
        content: { text: textContent },
      };
      emitEvent("send_message", messageToSend);
      setNewMessageText("");
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      emitEvent("user_typing_stop", { conversation_id: conversationId });
    }
  }, [
    newMessageText,
    selectedFile,
    isConnected,
    conversationDetails,
    conversationId,
    emitEvent,
    showSnackbar,
    makeApiCall,
    removeSelectedFile,
  ]);

  const handleTyping = (e) => {
    setNewMessageText(e.target.value);
    if (
      !isConnected ||
      !conversationDetails ||
      conversationDetails.status === ConversationStatusEnum.closed
    )
      return;

    if (!typingTimeoutRef.current) {
      emitEvent("user_typing_start", { conversation_id: conversationId });
    } else {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      emitEvent("user_typing_stop", { conversation_id: conversationId });
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendCurrentMessage();
    }
  };

  const handleOpenImagePreview = (url, name) =>
    setImagePreviewDialog({ open: true, url, title: name });
  const handleCloseImagePreview = () =>
    setImagePreviewDialog({ open: false, url: null, title: "" });

  const getFileIcon = (mime = "") => {
    if (mime.startsWith("image/")) return <ImageIcon />;
    if (mime.startsWith("audio/")) return <AudioFileIcon />;
    if (mime.startsWith("video/")) return <VideoFileIcon />;
    if (mime.includes("pdf")) return <PictureAsPdfIcon />;
    if (mime.includes("word")) return <DescriptionIcon />;
    if (mime.includes("excel") || mime.includes("spreadsheet"))
      return <TableChartIcon />;
    return <InsertDriveFileIcon />;
  };

  const renderFileInfo = (fileInfoData, messageTextContent) => (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        mt: messageTextContent ? 0.5 : 0,
        bgcolor: alpha(theme.palette.background.paper, 0.8),
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
        maxWidth:
          fileInfoData.mime_type.startsWith("image/") ||
          fileInfoData.mime_type.startsWith("video/")
            ? "250px"
            : "300px",
        borderRadius: "8px",
      }}
    >
      {fileInfoData.mime_type.startsWith("image/") && (
        <AuthorizedMediaDisplay
          fileInfo={fileInfoData}
          token={token}
          type="image"
          onImageClick={handleOpenImagePreview}
        />
      )}
      {fileInfoData.mime_type.startsWith("video/") && (
        <AuthorizedMediaDisplay
          fileInfo={fileInfoData}
          token={token}
          type="video"
        />
      )}
      {fileInfoData.mime_type.startsWith("audio/") && (
        <AuthorizedMediaDisplay
          fileInfo={fileInfoData}
          token={token}
          type="audio"
        />
      )}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mt:
            fileInfoData.mime_type.startsWith("image/") ||
            fileInfoData.mime_type.startsWith("video/") ||
            fileInfoData.mime_type.startsWith("audio/")
              ? 0.25
              : 0,
        }}
      >
        {getFileIcon(fileInfoData.mime_type)}
        <Tooltip title={`Download ${fileInfoData.name}`}>
          <Link
            component="button"
            onClick={async (e) => {
              e.preventDefault();
              const t = e.currentTarget;
              t.style.opacity = "0.5";
              try {
                const objUrl = await fetchAndCreateObjectUrl(
                  fileInfoData.url,
                  token
                );
                const linkEl = document.createElement("a");
                linkEl.href = objUrl;
                linkEl.download = fileInfoData.name;
                document.body.appendChild(linkEl);
                linkEl.click();
                document.body.removeChild(linkEl);
                URL.revokeObjectURL(objUrl);
              } catch (err) {
                showSnackbar(
                  `Download failed: ${fileInfoData.name}. ${err.message}`,
                  "error"
                );
              } finally {
                t.style.opacity = "1";
              }
            }}
            variant="body2"
            sx={{
              wordBreak: "break-all",
              cursor: "pointer",
              textAlign: "left",
              textDecoration: "underline",
              color: "inherit",
              border: "none",
              background: "none",
              padding: 0,
              font: "inherit",
            }}
          >
            {fileInfoData.name.length > 30
              ? fileInfoData.name.substring(0, 27) + "..."
              : fileInfoData.name}
          </Link>
        </Tooltip>
      </Box>
      {fileInfoData.size && (
        <Typography
          variant="caption"
          sx={{
            fontSize: "0.7rem",
            color: alpha(theme.palette.text.primary, 0.7),
          }}
        >
          ({(fileInfoData.size / 1024 / 1024).toFixed(2)} MB)
        </Typography>
      )}
    </Paper>
  );

  const renderMessageContent = (contentData) => {
    if (!contentData)
      return (
        <Typography
          variant="body2"
          sx={{ fontStyle: "italic", color: "text.secondary" }}
        >
          [Empty Message]
        </Typography>
      );
    const { text, file_info } = contentData;
    return (
      <Box>
        {text && (
          <Typography
            variant="body2"
            sx={{ whiteSpace: "pre-wrap", mb: file_info ? 0.5 : 0 }}
          >
            {text}
          </Typography>
        )}
        {file_info && renderFileInfo(file_info, text)}
      </Box>
    );
  };

  const typingDisplay = useMemo(() => {
    const names = Object.values(typingUsers);
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names.join(" and ")} are typing...`;
    return `${names.slice(0, 2).join(", ")} and others are typing...`;
  }, [typingUsers]);

  // The UI rendering part remains largely the same, but it will now have stable state.
  if (isLoadingInitialDetails) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100%"
      >
        <CircularProgress />
      </Box>
    );
  }
  if (generalError && !conversationDetails) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        height="100%"
      >
        <MuiAlert severity="error">{generalError}</MuiAlert>
        <MuiButton onClick={onBackToList} sx={{ mt: 2 }}>
          Back to List
        </MuiButton>
      </Box>
    );
  }
  if (!conversationDetails) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        justifyContent="center"
        alignItems="center"
        height="100%"
      >
        <MuiAlert severity="info">
          Conversation not found or not joined. Ensure you are connected.
        </MuiAlert>
        <MuiButton onClick={onBackToList} sx={{ mt: 2 }}>
          Back to List
        </MuiButton>
      </Box>
    );
  }

  const conversationStatusInfo = getStatusChip(conversationDetails.status);
  const canChat =
    isConnected &&
    conversationDetails.status !== ConversationStatusEnum.closed &&
    conversationDetails.status !== ConversationStatusEnum.resolved;
  const placeholderText = !isConnected
    ? "Connecting..."
    : !canChat
    ? `Chat is ${conversationDetails.status}.`
    : "Type message or attach file...";

  return (
    <Paper
      sx={{
        p: { xs: 1, sm: 1.5 },
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 120px)",
        minHeight: "400px",
        maxHeight: "80vh",
        bgcolor: theme.palette.background.paper,
      }}
      elevation={2}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1,
          pb: 1,
          borderBottom: 1,
          borderColor: "divider",
          flexShrink: 0,
        }}
      >
        <Stack>
          <Typography
            variant="h6"
            noWrap
            sx={{ fontSize: { xs: "1rem", sm: "1.15rem" } }}
          >
            {conversationDetails.subject ||
              `Conversation #${conversationDetails.id}`}
          </Typography>
          {conversationDetails.customer && (
            <Typography variant="caption" color="textSecondary">
              Customer:{" "}
              {conversationDetails.customer.full_name ||
                conversationDetails.customer.email}
            </Typography>
          )}
          {conversationDetails.agent && (
            <Typography variant="caption" color="textSecondary">
              Agent:{" "}
              {conversationDetails.agent.full_name ||
                conversationDetails.agent.email}
            </Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title={conversationStatusInfo.label}>
            <Chip
              icon={conversationStatusInfo.icon}
              label={conversationStatusInfo.label}
              color={conversationStatusInfo.color}
              size="small"
              variant="outlined"
            />
          </Tooltip>
          <Tooltip title="View Participants">
            <span>
              <IconButton
                size="small"
                onClick={() => setParticipantsDialogOpen(true)}
                disabled={participants.length === 0}
              >
                <GroupIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          {onBackToList && (
            <Tooltip title="Back to List">
              <IconButton size="small" onClick={onBackToList}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Box>

      {/* Error/Status Bar */}
      <Stack spacing={0.5} sx={{ mb: 0.5, flexShrink: 0 }}>
        {socketError && (
          <MuiAlert
            severity="error"
            sx={{ width: "100%", py: 0.25, fontSize: "0.75rem" }}
          >
            {socketError}
          </MuiAlert>
        )}
        {generalError && !socketError && (
          <MuiAlert
            severity="warning"
            sx={{ width: "100%", py: 0.25, fontSize: "0.75rem" }}
            onClose={() => setGeneralError(null)}
          >
            {generalError}
          </MuiAlert>
        )}
      </Stack>

      {/* Message Area */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: "auto",
          p: { xs: 0.5, sm: 1 },
          backgroundColor: theme.palette.background.default,
          borderRadius: 1,
          border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
          mb: 1,
          position: "relative",
        }}
      >
        {messages.length === 0 && (
          <Typography
            variant="body2"
            color="text.secondary"
            align="center"
            sx={{ p: 3, bgcolor: "transparent", borderRadius: 1, m: 1 }}
          >
            {isConnected ? "No messages yet." : "Connecting to chat..."}
          </Typography>
        )}
        {messages.length > 0 && (
          <Stack spacing={1.5} sx={{ p: { xs: 0.5, sm: 1 } }}>
            {messages.map((msg, idx) => {
              const key = `${msg.timestamp}-${idx}-${
                msg.sender_id || "system"
              }`;
              const isCurrentUserMsg = msg.sender_id === currentUser?.id;
              const isSystemTypeMsg = msg.type === "system";
              return (
                <Box
                  key={key}
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isSystemTypeMsg
                      ? "center"
                      : isCurrentUserMsg
                      ? "flex-end"
                      : "flex-start",
                  }}
                >
                  {!isCurrentUserMsg && !isSystemTypeMsg && msg.sender_name && (
                    <Chip
                      icon={
                        msg.sender_role === UserRole.agent ||
                        msg.sender_role === UserRole.admin ? (
                          <SupportAgentIcon fontSize="small" />
                        ) : (
                          <PersonIcon fontSize="small" />
                        )
                      }
                      label={
                        msg.sender_name.length > 15
                          ? msg.sender_name.substring(0, 12) + "..."
                          : msg.sender_name
                      }
                      size="small"
                      variant="outlined"
                      sx={{
                        mr: isCurrentUserMsg ? 0 : 1,
                        ml: isCurrentUserMsg ? 1 : 0,
                        mb: 0.5,
                        alignSelf: "flex-start",
                        height: "22px",
                        fontSize: "0.75rem",
                      }}
                    />
                  )}
                  <Paper
                    elevation={isSystemTypeMsg ? 0 : 2}
                    sx={{
                      p: isSystemTypeMsg ? 0.5 : { xs: 0.8, sm: 1 },
                      px: isSystemTypeMsg ? 1 : { xs: 1, sm: 1.5 },
                      bgcolor: isSystemTypeMsg
                        ? theme.palette.mode === "dark"
                          ? theme.palette.grey[700]
                          : theme.palette.grey[300]
                        : isCurrentUserMsg
                        ? theme.palette.primary.main
                        : theme.palette.mode === "dark"
                        ? theme.palette.grey[800]
                        : theme.palette.background.default,
                      color: isSystemTypeMsg
                        ? theme.palette.text.primary
                        : isCurrentUserMsg
                        ? theme.palette.primary.contrastText
                        : theme.palette.text.primary,
                      borderRadius: isSystemTypeMsg
                        ? "15px"
                        : isCurrentUserMsg
                        ? "15px 0 15px 15px"
                        : "0 15px 15px 15px",
                      maxWidth: "85%",
                      width: "fit-content",
                      wordWrap: "break-word",
                      textAlign: isSystemTypeMsg ? "center" : "left",
                      alignSelf: isSystemTypeMsg ? "center" : undefined,
                      fontSize: isSystemTypeMsg
                        ? "0.8rem"
                        : { xs: "0.85rem", sm: "0.9rem" },
                      fontStyle: isSystemTypeMsg ? "italic" : "normal",
                    }}
                  >
                    {renderMessageContent(msg.content)}
                    {!isSystemTypeMsg && msg.timestamp && (
                      <Typography
                        variant="caption"
                        display="block"
                        sx={{
                          mt: 0.5,
                          opacity: 0.8,
                          textAlign: isCurrentUserMsg ? "right" : "left",
                          color: "inherit",
                          fontSize: "0.7rem",
                        }}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Typography>
                    )}
                  </Paper>
                </Box>
              );
            })}
            <div ref={messageEndRef} />
          </Stack>
        )}
      </Box>

      {/* Typing Indicator */}
      {typingDisplay && (
        <Typography
          variant="caption"
          sx={{
            fontStyle: "italic",
            color: "text.secondary",
            height: "20px",
            textAlign: "left",
            pl: 1,
          }}
        >
          {typingDisplay}
        </Typography>
      )}

      {/* Input Area */}
      <Box sx={{ mt: "auto", flexShrink: 0, pt: typingDisplay ? 0 : 1 }}>
        {isUploading && (
          <LinearProgress
            variant="determinate"
            value={uploadProgress}
            sx={{ mb: 0.5 }}
          />
        )}
        {uploadError && (
          <MuiAlert
            severity="error"
            sx={{ mb: 0.5, py: 0.25, fontSize: "0.75rem" }}
            onClose={() => setUploadError(null)}
          >
            {uploadError}
          </MuiAlert>
        )}
        {selectedFile && !isUploading && (
          <FilePreview file={selectedFile} onRemove={removeSelectedFile} />
        )}

        <TextField
          fullWidth
          multiline
          minRows={1}
          maxRows={3}
          placeholder={placeholderText}
          variant="outlined"
          value={newMessageText}
          onChange={handleTyping}
          onKeyDown={handleKeyDown}
          disabled={!canChat || isUploading}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Tooltip title="Attach file">
                  <span>
                    <IconButton
                      color="primary"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={!canChat || isUploading || !!selectedFile}
                      aria-label="attach file"
                      size="small"
                    >
                      <AttachFileIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <input
                  type="file"
                  hidden
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.xls,.xlsx"
                />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  color="primary"
                  onClick={sendCurrentMessage}
                  disabled={
                    !canChat ||
                    isUploading ||
                    (!newMessageText.trim() && !selectedFile)
                  }
                  aria-label="send message"
                  size="small"
                >
                  <SendIcon />
                </IconButton>
              </InputAdornment>
            ),
            sx: {
              borderRadius: "12px",
              fontSize: { xs: "0.9rem", sm: "1rem" },
              bgcolor: theme.palette.background.default,
            },
          }}
          sx={{ bgcolor: "transparent" }}
        />
      </Box>

      <ParticipantsDialog
        open={participantsDialogOpen}
        onClose={() => setParticipantsDialogOpen(false)}
        participants={participants}
      />
      <Dialog
        open={imagePreviewDialog.open}
        onClose={handleCloseImagePreview}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ m: 0, p: 2 }}>
          {imagePreviewDialog.title}
          <IconButton
            aria-label="close"
            onClick={handleCloseImagePreview}
            sx={{
              position: "absolute",
              right: 8,
              top: 8,
              color: (th) => th.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "50vh",
            p: 0,
            overflow: "hidden",
          }}
        >
          {imagePreviewDialog.url ? (
            <Box
              component="img"
              src={imagePreviewDialog.url}
              alt={imagePreviewDialog.title}
              sx={{
                maxWidth: "100%",
                maxHeight: "calc(100vh - 128px)",
                objectFit: "contain",
              }}
            />
          ) : (
            <CircularProgress />
          )}
        </DialogContent>
      </Dialog>
    </Paper>
  );
}

// Add PictureAsPdfIcon, DescriptionIcon, TableChartIcon if not already imported
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DescriptionIcon from "@mui/icons-material/Description";
import TableChartIcon from "@mui/icons-material/TableChart";
