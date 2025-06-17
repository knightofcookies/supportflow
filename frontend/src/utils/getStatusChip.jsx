// src/utils/getStatusChip.jsx
import React from "react";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer"; // For 'open'
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd"; // For 'assigned'
import ForumIcon from "@mui/icons-material/Forum"; // For 'in_progress'
import SnoozeIcon from "@mui/icons-material/Snooze"; // For 'pending_customer'
import CheckCircleIcon from "@mui/icons-material/CheckCircle"; // For 'resolved'
import ArchiveIcon from "@mui/icons-material/Archive"; // For 'closed'
import HelpOutlineIcon from "@mui/icons-material/HelpOutline"; // Default

export const ConversationStatusEnum = {
  open: "open",
  assigned: "assigned",
  in_progress: "in_progress",
  pending_customer: "pending_customer",
  resolved: "resolved",
  closed: "closed",
};

const getStatusChip = (status) => {
  const statuses = {
    [ConversationStatusEnum.open]: {
      label: "Open",
      color: "info",
      icon: <QuestionAnswerIcon />,
    },
    [ConversationStatusEnum.assigned]: {
      label: "Assigned",
      color: "secondary", // Or another distinct color
      icon: <AssignmentIndIcon />,
    },
    [ConversationStatusEnum.in_progress]: {
      label: "In Progress",
      color: "success",
      icon: <ForumIcon />,
    },
    [ConversationStatusEnum.pending_customer]: {
      label: "Pending Customer",
      color: "warning",
      icon: <SnoozeIcon />,
    },
    [ConversationStatusEnum.resolved]: {
      label: "Resolved",
      color: "primary", // Or a completion color
      icon: <CheckCircleIcon />,
    },
    [ConversationStatusEnum.closed]: {
      label: "Closed",
      color: "default", // Greyed out for closed/archived
      icon: <ArchiveIcon />,
    },
  };
  return (
    statuses[status] || {
      label: status ? status.toString().replace("_", " ") : "Unknown",
      color: "default",
      icon: <HelpOutlineIcon />,
    }
  );
};

export default getStatusChip;
