import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CustomButton from './components/CustomButton.tsx';
import './components/CustomCSS.css';
import logo from '../assets/poke.png';

const ScreenBase: React.FC = () => {
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const handlePress = () => {
    if (email.trim()) {
      const encodedEmail = encodeURIComponent(email.trim());
      navigate(`/video/${encodedEmail}`);
    }
  };

  return (
    <div className="animated-view">
      <div className="center-content">
        <img src={logo} alt="Poke Logo" className="logo" />
        <h2>Welcome to Poke 👋</h2>

        <input
          type="email"
          placeholder="Enter your email"
          className="email-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            padding: '10px',
            fontSize: '16px',
            marginTop: '20px',
            width: '250px',
            borderRadius: '5px',
            border: '1px solid #ccc',
          }}
        />
      </div>

      <div className="bottom-content">
        <CustomButton text="Go!" onClick={handlePress} />
        <p className="terms" onClick={() => window.open('https://example.com/terms', '_blank')}>
          Hope you have read our TnC's here 💘
        </p>
      </div>
    </div>
  );
};

export default ScreenBase;
