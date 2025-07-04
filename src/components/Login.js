import React from 'react';
import { auth, googleProvider } from '../firebase-config';
import { signInWithPopup, signOut } from 'firebase/auth';
import '../App.css';

const Login = ({ onLoginSuccess }) => {
    const handleGoogleLogin = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const userEmail = result.user.email;

            if (userEmail.endsWith('@colearn.id')) {
                onLoginSuccess(result.user);
            } else {
                await signOut(auth);
                throw new Error('Only users with @colearn.id email are allowed.');
            }
        } catch (error) {
            console.error("Error during Google Sign-In:", error.message);
            alert(error.message);
            try {
                await signOut(auth);
            } catch (signOutError) {
                console.error("Error signing out:", signOutError);
            }
        }
    };

    return (
        <div className='login-page'>
            <div className='login-left-side'>
                <img src='https://media-sessions.dev.colearn.id/assets/other/images/2025-06-23T23:41:51.302Z-Teacher Portal 1.png' />
            </div>
            <div className='login-right-side'>
                <h1>Welcome Teachers!</h1>
                <a className='login-button' onClick={handleGoogleLogin}>
                    <img src='https://media.sessions.colearn.id/assets/other/images/2025-06-30T03:45:37.165Z-google-logo.png' />
                    <u>Login to your Google Account</u>
                </a>
            </div>

        </div>
    )
};

export default Login;
