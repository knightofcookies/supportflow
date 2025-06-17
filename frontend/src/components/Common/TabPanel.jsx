// src/components/Common/TabPanel.jsx
import React from "react";
import { Box } from "@mui/material";

function TabPanel(props) {
  const { children, value, index, sx, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && (
        // Default padding can be overridden by sx prop
        <Box sx={{ p: { xs: 1, sm: 2, md: 3 }, ...sx }}> 
            {children}
        </Box>
      )}
    </div>
  );
}

export default TabPanel;
