import React, { useState, useEffect } from "react";
import '../App.css';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { supabase } from '../lib/supabaseClient.mjs';


function Links({ category, onBack }) {
    const [linksData, setLinksData] = useState([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const categoriesUrl = process.env.REACT_APP_CATEGORIES;

    useEffect(() => {
        const fetchLinks = async () => {
            try {
                const { data, error } = await supabase
                    .from('file_links')
                    .select('*');

                setLinksData(data);
            } catch (error) {
                console.error("Error fetching links:", error);
            }
        };

        if (category) {
            fetchLinks();
        }
    }, [category]);
    console.log(`cek links data: ${linksData}`)
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    }, []);

    const filteredData = linksData.filter(item => item.category === category);

    return (
        <div className="page-links flex-home">
            {isMobile ? (
                <>
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
                </>
            ) : (<div className="links-top-elements">
                <img className="links-top-left" src="https://media.sessions.colearn.id/assets/other/images/2024-12-17T09:27:36.931Z-links-top.png" alt="Links top" />
                <h1 className="links-top-right">{category}</h1>
            </div>)}
            {isMobile ? (
                <div className="mobile-content-links">
                    <div>
                        <h1>{category}</h1>
                    </div>
                    <div>
                        {filteredData.length > 0 ? (
                            filteredData.map((link, index) => (
                                <a key={index} href={link.file_link} target="_blank" rel="noopener noreferrer">
                                    {link.title}
                                </a>
                            ))
                        ) : (
                            <div className="skeleton-links-mobile">
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
                </div>
            ) : (
                <div className="content-links">
                    {filteredData.length > 0
                        ? (
                            filteredData.map((link, index) => (
                                <a key={index} href={link.file_link} target="_blank" rel="noopener noreferrer">
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
            )}
            {isMobile ? (
                <div className="mobile-button-links" onClick={onBack}></div>
            ) : (
                <>
                    <div className="links-footer">
                        <div>
                            <button onClick={onBack}>Back</button>
                        </div>
                        <img src="https://media.sessions.colearn.id/assets/other/images/2024-12-17T09:34:39.879Z-cat-clinks.png" alt="cat-clinks" />
                    </div>
                </>
            )}
        </div >
    );
}

export default Links;
