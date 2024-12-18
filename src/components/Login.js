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
            <div className='login-header'>
                <img />
            </div>
            <div className='login-body flex-home'>
                <img className='colearn-logo' src='https://colearn.id/_next/static/media/colearn_logo.ff15334a.svg' alt='colearn-logo' />
                <a className='login-button' onClick={handleGoogleLogin}>
                    <img src='https://cdn1.iconfinder.com/data/icons/google-s-logo/150/Google_Icons-09-512.png' />
                    <p>Login with Google</p>
                </a>
            </div>
        </div>
    );
};

export default Login;
