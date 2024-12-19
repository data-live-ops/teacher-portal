import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import Links from './components/Links';
import Homepage from './components/Homepage';
import Login from './components/Login';

function App() {
  const [activePage, setActivePage] = useState("homepage");
  const [category, setCategory] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const handleNavigationClick = (category) => {
    setCategory(category);
    setActivePage("links");
  };

  const handleBack = () => {
    setActivePage("homepage");
    setCategory(null);
  };

  const handleLoginSuccess = (user) => {
    console.log("Logged in user:", user);
    setIsLoggedIn(true);
  }

  return (

    <Router>
      <Routes>
        <Route
          path='/login'
          element={
            !isLoggedIn ? (<Login onLoginSuccess={handleLoginSuccess} />) : (<Navigate to="/" replace />)
          }
        />
        <Route
          path="/"
          element={
            isLoggedIn ? (
              <>
                {activePage === "homepage" && <Homepage />}
                {activePage === "homepage" && <Navigation onClick={handleNavigationClick} />}
                {activePage === "links" && <Links category={category} onBack={handleBack} />}
              </>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
