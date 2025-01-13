import React from 'react';

const LoadingSpinner = () => {
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(245, 245, 245, 0.8)',
            zIndex: 1000
        }}>
            <div style={{
                textAlign: 'center'
            }}>
                <div className="spinner"></div>
                <p style={{
                    marginTop: '20px',
                    color: '#4a5568',
                    fontWeight: 500,
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                }}>Santai dulu, bestie...</p>
                <p style={{
                    fontSize: '14px',
                    color: '#718096',
                    marginTop: '8px'
                }}>Data lagi loading, ambil kopi aja dulu! ☕</p>


                <style>
                    {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }

            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: .5; }
            }

            .spinner {
              width: 50px;
              height: 50px;
              border: 4px solid #f3f3f3;
              border-top: 4px solid #3498db;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin: 0 auto;
            }

            .spinner::after {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              border-radius: 50%;
              border: 4px solid transparent;
              border-top-color: #3498db;
              animation: spin 0.8s linear infinite;
            }
          `}
                </style>
            </div>
        </div>
    );
};

export default LoadingSpinner;