import React from 'react';
import { auth, googleProvider } from '../firebase-config';
import { signInWithPopup } from 'firebase/auth';
import '../App.css';

const Login = ({ onLoginSuccess }) => {
    const handleGoogleLogin = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const userEmail = result.user.email;

            if (userEmail.endsWith('@colearn.id')) {
                onLoginSuccess(result.user);
            } else {
                throw new Error('Only users with @colearn.id email are allowed.');
            }
        } catch (error) {
            console.error("Error during Google Sign-In:", error.message);
            alert(error.message);
        }
    };

    return (
        <div className='login-page flex-home'>
            <div className='login-header'></div>
            <div className="top-elements">
                <img
                    className="top-left"
                    src="https://media.sessions.colearn.id/assets/other/images/2024-12-17T04:14:13.591Z-homepage-element-1.png"
                    alt="Top Left Element"
                />
                <img
                    className="top-right"
                    src="https://media.sessions.colearn.id/assets/other/images/2024-12-17T04:15:04.952Z-homepage-element-2.png"
                    alt="Top Right Element"
                />
            </div>
            <div className='login-body flex-home'>
                <img className='colearn-logo' src='https://colearn.id/_next/static/media/colearn_logo.ff15334a.svg' alt='colearn-logo' />
                <a className='login-button' onClick={handleGoogleLogin}>
                    <img src='https://cdn1.iconfinder.com/data/icons/google-s-logo/150/Google_Icons-09-512.png' />
                    <div>Login with Google</div>
                </a>
            </div>
        </div>
    );
};

export default Login;
