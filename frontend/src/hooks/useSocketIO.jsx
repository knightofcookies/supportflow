// src/hooks/useSocketIO.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_IO_URL || "http://localhost:8000"; // Base URL
const SOCKET_PATH = "/ws/socket.io"; // Path defined in backend

const useSocketIO = (token, eventHandlers = {}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState(null);
  const socketRef = useRef(null);

  const {
    onConnectionAck,
    onErrorMessage,
    onNewMessage,
    onSystemMessage,
    onParticipantUpdate,
    onConversationJoined,
    onConversationStatusUpdate,
    onWallpaperUpdate,
    onConversationAssigned,
    onTypingStartBroadcast,
    onTypingStopBroadcast,
    // General connection lifecycle handlers
    onConnectCb, // Renamed to avoid conflict with internal onConnect
    onDisconnectCb,
    onConnectErrorCb,
  } = eventHandlers;

  useEffect(() => {
    if (!token) {
      if (socketRef.current) {
        console.log("Socket.IO: No token, disconnecting.");
        socketRef.current.disconnect();
      }
      socketRef.current = null;
      setIsConnected(false);
      setSocketError(null);
      return;
    }

    if (socketRef.current?.connected && socketRef.current?.auth?.token === token) {
      console.log("Socket.IO: Already connected with the same token.");
      setIsConnected(true);
      return;
    }
    
    if (socketRef.current) {
        console.log("Socket.IO: Token changed or disconnected, re-initializing.");
        socketRef.current.disconnect();
    }


    console.log(`Socket.IO: Attempting connection to ${SOCKET_URL} with path ${SOCKET_PATH}`);
    setSocketError(null);

    const newSocket = io(SOCKET_URL, {
      path: SOCKET_PATH,
      auth: { token }, // Send token for authentication
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      transports: ["websocket"], // Prefer WebSocket
    });

    socketRef.current = newSocket;

    // Standard Listeners
    newSocket.on("connect", () => {
      console.log("Socket.IO: Connected successfully. SID:", newSocket.id);
      setIsConnected(true);
      setSocketError(null);
      if (onConnectCb) onConnectCb();
    });

    newSocket.on("disconnect", (reason) => {
      console.warn("Socket.IO: Disconnected.", reason);
      setIsConnected(false);
      if (reason === "io server disconnect") {
        setSocketError("Disconnected by server. Please re-login if issues persist.");
      } else if (reason === "io client disconnect") {
        // Normal client-side disconnect
        setSocketError(null);
      } else {
        setSocketError("Connection lost. Attempting to reconnect...");
      }
      if (onDisconnectCb) onDisconnectCb(reason);
    });

    newSocket.on("connect_error", (err) => {
      console.error("Socket.IO: Connection Error.", err.message, err.data);
      const errMsg = err.data?.message || err.message || "Connection failed";
      setSocketError(`Connection Error: ${errMsg}`);
      setIsConnected(false);
      if (onConnectErrorCb) onConnectErrorCb(err);
    });

    // Custom Application-Specific Listeners
    if (onConnectionAck) newSocket.on("connection_ack", onConnectionAck);
    if (onErrorMessage) newSocket.on("error_message", onErrorMessage);
    if (onNewMessage) newSocket.on("new_message", onNewMessage);
    if (onSystemMessage) newSocket.on("system_message", onSystemMessage);
    if (onParticipantUpdate) newSocket.on("participant_update", onParticipantUpdate);
    if (onConversationJoined) newSocket.on("conversation_joined", onConversationJoined);
    if (onConversationStatusUpdate) newSocket.on("conversation_status_update", onConversationStatusUpdate);
    if (onWallpaperUpdate) newSocket.on("wallpaper_update", onWallpaperUpdate);
    if (onConversationAssigned) newSocket.on("conversation_assigned", onConversationAssigned);
    if (onTypingStartBroadcast) newSocket.on("typing_start_broadcast", onTypingStartBroadcast);
    if (onTypingStopBroadcast) newSocket.on("typing_stop_broadcast", onTypingStopBroadcast);

    return () => {
      console.log("Socket.IO: Cleaning up connection.");
      if (newSocket) {
        newSocket.off("connect");
        newSocket.off("disconnect");
        newSocket.off("connect_error");
        if (onConnectionAck) newSocket.off("connection_ack");
        if (onErrorMessage) newSocket.off("error_message");
        if (onNewMessage) newSocket.off("new_message");
        if (onSystemMessage) newSocket.off("system_message");
        if (onParticipantUpdate) newSocket.off("participant_update");
        if (onConversationJoined) newSocket.off("conversation_joined");
        if (onConversationStatusUpdate) newSocket.off("conversation_status_update");
        if (onWallpaperUpdate) newSocket.off("wallpaper_update");
        if (onConversationAssigned) newSocket.off("conversation_assigned");
        if (onTypingStartBroadcast) newSocket.off("typing_start_broadcast");
        if (onTypingStopBroadcast) newSocket.off("typing_stop_broadcast");
        newSocket.disconnect();
      }
      socketRef.current = null;
       // Set isConnected to false on cleanup if socket is being destroyed
      // This helps if the component using the hook unmounts while socket was connected.
      setIsConnected(false); 
    };
  }, [
    token,
    onConnectionAck, onErrorMessage, onNewMessage, onSystemMessage, onParticipantUpdate,
    onConversationJoined, onConversationStatusUpdate, onWallpaperUpdate, onConversationAssigned,
    onTypingStartBroadcast, onTypingStopBroadcast,
    onConnectCb, onDisconnectCb, onConnectErrorCb,
  ]);

  // Generic emit function
  const emitEvent = useCallback((eventName, data) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(eventName, data);
    } else {
      console.error(`Socket.IO: Cannot emit event '${eventName}'. Not connected.`);
      setSocketError("Cannot send data: Not connected.");
    }
  }, []);
  
  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
        socketRef.current.disconnect();
    }
  }, []);


  return { isConnected, socketError, emitEvent, disconnectSocket };
};

export default useSocketIO;
