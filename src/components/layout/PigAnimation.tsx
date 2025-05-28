'use client';

import React, { useEffect, useRef } from 'react';

// Import the CSS files for the animation
import '@/styles/pig-draw.css';
import '@/styles/pig-erase.css';
import '@/styles/pig-animation.css';

const PigAnimation: React.FC = () => {
  const drawRef = useRef<SVGSVGElement>(null);
  const eraseRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // Add active class to start animations
    const drawSvg = drawRef.current;
    const eraseSvg = eraseRef.current;

    if (drawSvg && eraseSvg) {
      // Initial state
      drawSvg.classList.add('active');

      // Set up the animation loop
      const animationInterval = setInterval(() => {
        // Toggle active classes to create the loop effect
        if (drawSvg.classList.contains('active')) {
          drawSvg.classList.remove('active');
          eraseSvg.classList.add('active');
        } else {
          eraseSvg.classList.remove('active');
          drawSvg.classList.add('active');
        }
      }, 5000); // 5 seconds per animation cycle

      return () => clearInterval(animationInterval);
    }
  }, []);

  return (
    <div className="pig-container">
      {/* Drawing SVG */}
      <svg 
        ref={drawRef}
        className="pig-svg draw" 
        width="100" 
        height="80" 
        viewBox="0 0 100 80" 
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Body */}
        <ellipse className="svg-elem-1" cx="50" cy="45" rx="30" ry="25" stroke="#ff9999" strokeWidth="2" fill="transparent" />
        
        {/* Ears */}
        <path className="svg-elem-2" d="M30 25 Q 20 10 30 15" stroke="#ff9999" strokeWidth="2" fill="transparent" />
        <path className="svg-elem-3" d="M70 25 Q 80 10 70 15" stroke="#ff9999" strokeWidth="2" fill="transparent" />
        
        {/* Snout */}
        <ellipse className="svg-elem-4" cx="50" cy="55" rx="15" ry="10" stroke="#ff9999" strokeWidth="2" fill="transparent" />
        
        {/* Eyes */}
        <circle className="svg-elem-5" cx="40" cy="35" r="3" stroke="#ff9999" strokeWidth="2" fill="transparent" />
        <circle className="svg-elem-6" cx="60" cy="35" r="3" stroke="#ff9999" strokeWidth="2" fill="transparent" />
        
        {/* Nose */}
        <path className="svg-elem-7" d="M45 55 Q 50 58 55 55" stroke="#ff9999" strokeWidth="2" fill="transparent" />
      </svg>

      {/* Erasing SVG */}
      <svg 
        ref={eraseRef}
        className="pig-svg erase" 
        width="100" 
        height="80" 
        viewBox="0 0 100 80" 
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, margin: '0 auto' }}
      >
        {/* Body */}
        <ellipse className="svg-elem-1" cx="50" cy="45" rx="30" ry="25" stroke="#ff9999" strokeWidth="2" fill="#ff9999" />
        
        {/* Ears */}
        <path className="svg-elem-2" d="M30 25 Q 20 10 30 15" stroke="#ff9999" strokeWidth="2" fill="#ff9999" />
        <path className="svg-elem-3" d="M70 25 Q 80 10 70 15" stroke="#ff9999" strokeWidth="2" fill="#ff9999" />
        
        {/* Snout */}
        <ellipse className="svg-elem-4" cx="50" cy="55" rx="15" ry="10" stroke="#ff9999" strokeWidth="2" fill="#ff9999" />
        
        {/* Eyes */}
        <circle className="svg-elem-5" cx="40" cy="35" r="3" stroke="#ff9999" strokeWidth="2" fill="#ff9999" />
        <circle className="svg-elem-6" cx="60" cy="35" r="3" stroke="#ff9999" strokeWidth="2" fill="#ff9999" />
        
        {/* Nose */}
        <path className="svg-elem-7" d="M45 55 Q 50 58 55 55" stroke="#ff9999" strokeWidth="2" fill="#ff9999" />
      </svg>
    </div>
  );
};

export default PigAnimation;