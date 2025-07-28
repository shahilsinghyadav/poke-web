import React, { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

const signalingServerUrl = 'http://localhost:3000';

const Signaling: React.FC = () => {
  useEffect(() => {
    const socket: Socket = io(signalingServerUrl);

    socket.on('connect', () => {
      console.log('Connected to signaling server');
      console.log('Socket ID:', socket.id);
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from signaling server');
    });

    // Clean up the socket connection when the component unmounts
    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div>
      <h2>Signaling Server Connection</h2>
      <p>Check the console for connection logs.</p>
    </div>
  );
};

export default Signaling;
