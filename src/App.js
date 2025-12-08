import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase-config";
import { PermissionProvider } from "./contexts/PermissionContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navigation from "./components/Navigation";
import Links from "./components/Links";
import Homepage from "./components/Homepage";
import Login from "./components/Login";
import LoadingSpinner from "./components/Loading";
import IndividualSchedule from "./components/IndividualSchedule";
import PiketSchedule from "./components/PiketSchedule";
import TeacherAssignment from "./components/TeacherAssignment";
import DataManagement from "./components/DataManagement";
import TeacherUtilization from "./components/TeacherUtilization";

function App() {
  const [activePage, setActivePage] = useState("homepage");
  const [category, setCategory] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [user, setUserEmail] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsLoggedIn(!!user);
      setUserEmail(user);
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
    setUserEmail(user);
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsLoggedIn(false);
      setUserEmail(null);
      console.log("User logged out successfully");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const isEligibleToAccess = (user_email) => {
    return ['imam.fachrudin@colearn.id', 'annisa.nugraha@colearn.id'].includes(user_email)
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <PermissionProvider userEmail={user?.email}>
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
                      {activePage === "homepage" && <Homepage user={user} onLogout={handleLogout} />}
                      {activePage === "links" && (
                        <Links category={category} onBack={handleBack} />
                      )}
                    </>
                  ) : (
                    <>
                      {activePage === "homepage" && <Homepage user={user} onLogout={handleLogout} />}
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

          <Route
            path="/individual-schedule"
            element={
              <ProtectedRoute feature="individual_schedule" isLoggedIn={isLoggedIn}>
                <IndividualSchedule user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/piket-schedule"
            element={
              <ProtectedRoute feature="piket_schedule" isLoggedIn={isLoggedIn}>
                <PiketSchedule user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher-assignment"
            element={
              <ProtectedRoute feature="teacher_assignment" isLoggedIn={isLoggedIn}>
                <TeacherAssignment user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/data-management"
            element={
              <ProtectedRoute feature="data_management" isLoggedIn={isLoggedIn}>
                <DataManagement user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher-utilization"
            element={
              <ProtectedRoute feature="teacher_utilization" isLoggedIn={isLoggedIn}>
                <TeacherUtilization user={user} onLogout={handleLogout} />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </PermissionProvider>
  );
}

export default App;