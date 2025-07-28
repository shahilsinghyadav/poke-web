import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import ScreenBase from './screens/ScreenBase';
import VideoCall from './screens/VideoCall';

const App: React.FC = () => {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<ScreenBase />} />
          <Route path="/video/:email" element={<VideoCall />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
