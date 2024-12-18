import React, { useState, useEffect } from "react";
import '../App.css';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';


function Links({ category, onBack }) {
    const [linksData, setLinksData] = useState([]);
    const categoriesUrl = process.env.REACT_APP_CATEGORIES;

    useEffect(() => {
        const fetchLinks = async () => {
            try {
                const response = await fetch(`${categoriesUrl}`);
                if (!response.ok) {
                    throw new Error("Failed to fetch data");
                }
                const data = await response.json();
                setLinksData(data);
            } catch (error) {
                console.error("Error fetching links:", error);
            }
        };

        if (category) {
            fetchLinks();
        }
    }, [category]);

    const filteredData = linksData.filter(item => item.category === category);

    return (
        <div className="page-links flex-home">
            <div className="links-top-elements">
                <img className="links-top-left" src="https://media.sessions.colearn.id/assets/other/images/2024-12-17T09:27:36.931Z-links-top.png" alt="Links top" />
                <h1 className="links-top-right">{category}</h1>
            </div>
            <div className="content-links">
                {filteredData.length > 0 ? (
                    filteredData.map((link, index) => (
                        <a key={index} href={link.fileLink} target="_blank" rel="noopener noreferrer">
                            <button id={link.id}>{link.title}</button>
                        </a>
                    ))
                ) : (
                    <div className="skeleton-container">
                        {[...Array(6)].map((_, index) => (
                            <Skeleton
                                key={index}
                                height={50}
                                width={300}
                                baseColor="#c4e2f5"
                                highlightColor="#e6f6ff"
                            />
                        ))}
                    </div>

                )}
            </div>
            <div className="links-footer">
                <div>
                    <button onClick={onBack}>Back</button>
                </div>
                <img src="https://media.sessions.colearn.id/assets/other/images/2024-12-17T09:34:39.879Z-cat-clinks.png" alt="cat-clinks" />
            </div>
        </div>
    );
}

export default Links;