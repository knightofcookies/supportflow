// src/components/Admin/AdminChatPage.jsx
import React, { useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Typography, IconButton, AppBar, Toolbar, Container } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Chat from '../Chat/Chat'; // The core chat component
import { AppContext } from '../../App';

function AdminChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useContext(AppContext);

  const handleBack = () => {
    // Navigate back to admin dashboard, perhaps to conversations list
    navigate('/admin/conversations'); 
  };

  if (!currentUser) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Typography>Loading user...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static">
        <Toolbar variant="dense">
          <IconButton edge="start" color="inherit" onClick={handleBack} aria-label="back to admin dashboard">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="subtitle1" sx={{ flexGrow: 1, textAlign:'center', mr: {xs: '48px', sm: 0} }}>
            Admin Chat View
          </Typography>
          {/* Admin specific controls related to THIS conversation could go here */}
          {/* e.g., Assign Agent, Change Status, if not handled in ConversationManagement table */}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ flexGrow: 1, py: {xs:1, sm:2}, display: 'flex', flexDirection: 'column' }}>
        {conversationId ? (
          <Chat conversationId={conversationId} onBackToList={handleBack}/>
        ) : (
          <Typography>No conversation selected.</Typography>
        )}
      </Container>
    </Box>
  );
}

export default AdminChatPage;
