import React from 'react';
import VideoCall from './VideoCall';  // Ensure that CameraScreen is also adapted for web
import './components/CustomCSS.css';

const LoginScreen = () => {
  return (
    <div className="container">
      <VideoCall />
    </div>
  );
};

export default LoginScreen;
