import React, { useState } from 'react';
import Navigation from './components/Navigation';
import Links from './components/Links';
import Homepage from './components/Homepage';

function App() {
  const [activePage, setActivePage] = useState("homepage");
  const [category, setCategory] = useState(null);

  const handleNavigationClick = (category) => {
    setCategory(category);
    setActivePage("links");
  };

  const handleBack = () => {
    setActivePage("homepage");
    setCategory(null);
  };

  return (
    <div>
      {activePage === "homepage" && <Homepage />}
      {activePage === "homepage" && <Navigation onClick={handleNavigationClick} />}
      {activePage === "links" && <Links category={category} onBack={handleBack} />}
    </div>
  );
}

export default App;
