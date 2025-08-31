import React from 'react';
import './CustomCSS.css';

interface CustomButtonProps {
  text: string;
  onClick: () => void;
}

const CustomButton: React.FC<CustomButtonProps> = ({ text, onClick }) => {
  return (
    <button className="custom-button" onClick={onClick}>
      {text}
    </button>
  );
};

export default CustomButton;