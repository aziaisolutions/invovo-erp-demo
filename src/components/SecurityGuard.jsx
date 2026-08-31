import React, { useRef } from 'react';

export default function SecurityGuard({ verifyHumanity }) {
  const honeypotRef = useRef(null);

  const handleValidation = () => {
    if (honeypotRef.current && honeypotRef.current.value.trim() !== '') {
      // If a bot fills out this invisible field, we flag them
      verifyHumanity({ honeypotFilled: true });
    }
  };

  return (
    <div 
      className="hidden absolute opacity-0 pointer-events-none w-0 h-0 overflow-hidden" 
      aria-hidden="true" 
      tabIndex="-1"
    >
      <label htmlFor="security_token_verification">Leave this field blank</label>
      <input 
        type="text" 
        id="security_token_verification" 
        name="security_token_verification" 
        autoComplete="off" 
        tabIndex="-1" 
        ref={honeypotRef}
        onChange={handleValidation}
        onBlur={handleValidation}
      />
    </div>
  );
}
