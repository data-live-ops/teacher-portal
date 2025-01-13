import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase-config";
import Navigation from "./components/Navigation";
import Links from "./components/Links";
import Homepage from "./components/Homepage";
import Login from "./components/Login";
import LoadingSpinner from "./components/Loading";

function App() {
  const [activePage, setActivePage] = useState("homepage");
  const [category, setCategory] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleNavigation = (event) => {
      const pageName = event.detail;
      setCategory(pageName);
      setActivePage("links");
    };

    window.addEventListener("navigateTo", handleNavigation);
    return () => window.removeEventListener("navigateTo", handleNavigation);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleNavigationClick = (category) => {
    console.log("Navigating to:", category);
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
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            !isLoggedIn ? (
              <Login onLoginSuccess={handleLoginSuccess} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route
          path="/"
          element={
            isLoggedIn ? (
              <>
                {isMobile ? (
                  <>
                    {activePage === "homepage" && <Homepage />}
                    {activePage === "links" && (
                      <Links category={category} onBack={handleBack} />
                    )}
                  </>
                ) : (
                  <>
                    {activePage === "homepage" && <Homepage />}
                    {activePage === "homepage" && (
                      <Navigation onClick={handleNavigationClick} />
                    )}
                    {activePage === "links" && (
                      <Links category={category} onBack={handleBack} />
                    )}
                  </>
                )}
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