import React, { useState, useEffect } from "react";
import "../App.css";

function Homepage() {
    const [keywords, setKeywords] = useState([]);
    const [inputValue, setInputValue] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [isNavigationVisible, setIsNavigationVisible] = useState(false);

    useEffect(() => {
        const fetchKeywords = async () => {
            try {
                const response = await fetch(process.env.REACT_APP_KEYWORDS);
                const data = await response.json();

                const uniqueKeywords = Array.from(
                    new Set(data.map((item) => JSON.stringify(item)))
                ).map((item) => JSON.parse(item));

                const sortedKeywords = uniqueKeywords.sort((a, b) =>
                    a.keyword.localeCompare(b.keyword)
                );

                setKeywords(sortedKeywords);
            } catch (error) {
                console.error("Error fetching keywords:", error);
            }
        };

        fetchKeywords();
    }, []);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputValue(value);

        if (value.length > 0) {
            const filtered = keywords.filter((item) =>
                item.keyword.toLowerCase().includes(value.toLowerCase())
            );
            setSuggestions(filtered);
        } else {
            setSuggestions([]);
        }
    };

    const handleSuggestionClick = (fileLink) => {
        window.open(fileLink, "_blank");
    };

    const navigation_data = [
        {
            id: "001",
            page_name: "Kelas Live",
            description: "Segala hal tentang kelas live dapat ditemukan di sini!",
            image_url:
                "https://media.sessions.colearn.id/assets/other/images/2024-12-17T07:39:58.912Z-bird-learning.png",
            image_alt: "bird-learning",
        },
        {
            id: "002",
            page_name: "Operasional",
            description: "Mengajar tanpa hambatan, temukan hal terkait operasional di sini!",
            image_url:
                "https://media.sessions.colearn.id/assets/other/images/2024-12-17T07:39:23.217Z-bird-with-machine.png",
            image_alt: "bird-with-machine",
        },
        {
            id: "003",
            page_name: "Learning Resources",
            description: "Berikan yang terbaik untuk para murid, dapatkan bahan mengajar di sini!",
            image_url:
                "https://media.sessions.colearn.id/assets/other/images/2024-12-17T07:38:30.925Z-bird-brings-files.png",
            image_alt: "bird-brings-files",
        },
    ];

    const toggleNavigation = () => {
        setIsNavigationVisible(!isNavigationVisible);
    };

    const handleNavigationClick = (pageName) => {
        console.log("Navigating to:", pageName);
        setIsNavigationVisible(false);
        window.dispatchEvent(new CustomEvent("navigateTo", { detail: pageName }));
    };


    return (
        <div className="hero-homepage flex-home">
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

            <div className="content">
                <img
                    className="logo"
                    src="https://colearn.id/_next/static/media/colearn_logo.ff15334a.svg"
                    alt="colearn-logo"
                />
                <h1>Teacher Portal</h1>
                <div className="search-container">
                    <input
                        className="search-bar"
                        placeholder="What are you looking for?"
                        value={inputValue}
                        onChange={handleInputChange}
                    />
                    <span className="search-icon">🔍</span>
                    {suggestions.length > 0 && (
                        <ul className="dropdown">
                            {suggestions.map((item) => (
                                <li
                                    key={item.id}
                                    className="dropdown-item"
                                    onClick={() => handleSuggestionClick(item.fileLink)}
                                >
                                    {item.keyword}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            <div className="wave-footer" style={{ display: isMobile ? 'none' : 'block' }}></div>
            {isMobile && (
                <div
                    className="plus-button-navigation"
                    onClick={toggleNavigation}
                    style={{
                        cursor: "pointer",
                        backgroundImage: isNavigationVisible
                            ? "url('https://media.sessions.colearn.id/assets/other/images/2025-01-06T02:47:41.498Z-x_button.png')"
                            : "url('https://media.sessions.colearn.id/assets/other/images/2025-01-06T02:45:09.741Z-plus_button.png')",
                    }}
                ></div>
            )}

            {isNavigationVisible && (
                <div className="navigation-modal">
                    <div className="overlay" onClick={toggleNavigation}></div>
                    <div className="navigation-content">
                        {navigation_data.map((item, index) => (
                            <div
                                key={item.id}
                                className={`navigation-item item-${index}`}
                                onClick={() => handleNavigationClick(item.page_name)}
                            >
                                <img src={item.image_url} alt={item.image_alt} />
                                <h3>{item.page_name.toUpperCase()}</h3>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Homepage;
