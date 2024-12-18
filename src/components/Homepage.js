import React, { useState, useEffect } from "react";
import "../App.css";

function Homepage() {
    const [keywords, setKeywords] = useState([]);
    const [inputValue, setInputValue] = useState("");
    const [suggestions, setSuggestions] = useState([]);

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
                    {/* Dropdown suggestions */}
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
            <div className="wave-footer">
                <img
                    src="https://media.sessions.colearn.id/assets/other/images/2024-12-17T07:00:07.471Z-element-3-rev-2.png"
                    alt="Wave Footer"
                    className="wave-image"
                />
            </div>
        </div>
    );
}

export default Homepage;
