// src/components/FAQ/FAQModal.jsx
import React from "react";
import {
  Modal,
  Box,
  Typography,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Link as MuiLink,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import SupervisorAccountIcon from "@mui/icons-material/SupervisorAccount";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import HistoryToggleOffIcon from "@mui/icons-material/HistoryToggleOff";
import ListItemIcon from "@mui/material/ListItemIcon";

const faqData = [
  {
    question: "How do I start a conversation with support?",
    answer:
      "As a customer, go to your dashboard and click 'New Conversation'. You can provide an optional subject and your initial message. This will open a new support ticket.",
    icon: <QuestionAnswerIcon />,
  },
  {
    question: "What are the different user roles (Customer, Agent, Admin)?",
    answer: (
      <>
        <Typography variant="body2" component="div" gutterBottom>
          The platform has three main roles:
        </Typography>
        <List dense sx={{ py: 0 }}>
          <ListItem sx={{ py: 0.5 }}>
            <ListItemText
              primary="Customer:"
              secondary="Users who seek support and create conversations."
            />
          </ListItem>
          <ListItem sx={{ py: 0.5 }}>
            <ListItemText
              primary="Agent:"
              secondary="Support staff who handle customer conversations and provide assistance."
            />
          </ListItem>
          <ListItem sx={{ py: 0.5 }}>
            <ListItemText
              primary="Admin:"
              secondary="Platform administrators who can manage users, and conversations, and also act as agents."
            />
          </ListItem>
        </List>
      </>
    ),
    icon: <SupervisorAccountIcon />,
  },
  {
    question: "How does conversation assignment work?",
    answer:
      "When a customer creates a new conversation, it's initially 'Open'. An Admin can then assign it to an available Agent. The customer and agent will be notified.",
    icon: <AssignmentIndIcon />,
  },
  {
    question: "What do the different conversation statuses mean?",
    answer: (
      <>
        <Typography variant="body2" component="div" gutterBottom>
          Conversation statuses help track progress:
        </Typography>
        <List dense sx={{ py: 0 }}>
          <ListItem sx={{ py: 0.5 }}>
            <ListItemText
              primary="Open:"
              secondary="New conversation, awaiting agent assignment."
            />
          </ListItem>
          <ListItem sx={{ py: 0.5 }}>
            <ListItemText
              primary="Assigned:"
              secondary="Agent assigned, typically awaiting first agent response."
            />
          </ListItem>
          <ListItem sx={{ py: 0.5 }}>
            <ListItemText
              primary="In Progress:"
              secondary="Active discussion between customer and agent."
            />
          </ListItem>
          <ListItem sx={{ py: 0.5 }}>
            <ListItemText
              primary="Pending Customer:"
              secondary="Agent has responded and is waiting for the customer."
            />
          </ListItem>
          <ListItem sx={{ py: 0.5 }}>
            <ListItemText
              primary="Resolved:"
              secondary="The issue is considered solved by the agent/customer."
            />
          </ListItem>
          <ListItem sx={{ py: 0.5 }}>
            <ListItemText
              primary="Closed:"
              secondary="Conversation is archived and read-only."
            />
          </ListItem>
        </List>
      </>
    ),
    icon: <HistoryToggleOffIcon />,
  },
  {
    question: "Can I attach files to my messages?",
    answer:
      "Yes, you can attach files (images, documents, etc., up to the allowed size limit) to your chat messages using the attachment icon in the message input area.",
    icon: <CloudUploadIcon />,
  },
  {
    question: "What if I face technical issues during the chat?",
    answer:
      "If you encounter problems (e.g., messages not sending, disconnection): \n1. Check your internet connection. \n2. Try refreshing the chat page. \n3. If issues persist, take screenshots of any error messages and contact support through the email provided below.",
    icon: <SupportAgentIcon />,
  },
];

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: { xs: "95%", sm: "80%", md: "700px" },
  maxHeight: "90vh",
  bgcolor: "background.paper",
  border: "1px solid #ccc",
  borderRadius: "8px",
  boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
  display: "flex",
  flexDirection: "column",
};

const headerStyle = {
  p: { xs: 2, sm: 2.5 },
  borderBottom: 1,
  borderColor: "divider",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const contentStyle = {
  p: { xs: 2, sm: 2.5 },
  overflowY: "auto",
  flexGrow: 1,
};

const footerStyle = {
  p: { xs: 1.5, sm: 2 },
  borderTop: 1,
  borderColor: "divider",
  textAlign: "center",
};

function FAQModal({ open, onClose }) {
  return (
    <Modal open={open} onClose={onClose} aria-labelledby="faq-modal-title">
      <Box sx={modalStyle}>
        <Box sx={headerStyle}>
          <Typography id="faq-modal-title" variant="h6" component="h2">
            Frequently Asked Questions
          </Typography>
          <IconButton aria-label="close" onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <Box sx={contentStyle}>
          <List sx={{ width: "100%", p: 0 }}>
            {faqData.map((item, index) => (
              <Accordion
                key={index}
                elevation={0}
                square
                disableGutters
                sx={{
                  mb: 1,
                  border: "1px solid rgba(0, 0, 0, 0.08)",
                  borderRadius: "4px",
                  "&:before": { display: "none" },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls={`faq-panel${index}-content`}
                  id={`faq-panel${index}-header`}
                  sx={{
                    "& .MuiAccordionSummary-content": { alignItems: "center" },
                    py: 0.5,
                  }}
                >
                  <ListItemIcon
                    sx={{ minWidth: "40px", color: "primary.main", mr: 1 }}
                  >
                    {item.icon || <HelpOutlineIcon />}
                  </ListItemIcon>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 500, fontSize: "0.95rem" }}
                  >
                    {item.question}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails
                  sx={{
                    bgcolor: "action.hover",
                    borderTop: "1px dashed rgba(0,0,0,0.08)",
                    px: 2,
                    pb: 2,
                  }}
                >
                  {typeof item.answer === "string" ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        fontSize: "0.875rem",
                        lineHeight: 1.6,
                        whiteSpace: "pre-line",
                      }}
                    >
                      {item.answer}
                    </Typography>
                  ) : (
                    item.answer
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </List>
        </Box>
        <Box sx={footerStyle}>
          <Typography variant="caption" display="block">
            Still have questions? Email us:{" "}
            <MuiLink
              href="mailto:support@supportflow.co"
              target="_blank"
              rel="noopener noreferrer"
            >
              support@supportflow.co
            </MuiLink>
          </Typography>
        </Box>
      </Box>
    </Modal>
  );
}

export default FAQModal;
