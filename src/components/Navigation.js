import React from "react";
import '../App.css';

function Navigation({ onClick }) {
    const navigation_data = [
        {
            "id": "001",
            "page_name": "Kelas Live",
            "description": "Segala hal tentang kelas live dapat ditemukan di sini!",
            "image_url": "https://media.sessions.colearn.id/assets/other/images/2024-12-17T07:39:58.912Z-bird-learning.png",
            "image_alt": "bird-learning"
        },
        {
            "id": "002",
            "page_name": "Operasional",
            "description": "Mengajar tanpa hambatan, temukan hal terkait operasional di sini!",
            "image_url": "https://media.sessions.colearn.id/assets/other/images/2024-12-17T07:39:23.217Z-bird-with-machine.png",
            "image_alt": "bird-with-machine"
        },
        {
            "id": "003",
            "page_name": "Learning Resources",
            "description": "Berikan yang terbaik untuk para murid, dapatkan bahan mengajar di sini!",
            "image_url": "https://media.sessions.colearn.id/assets/other/images/2024-12-17T07:38:30.925Z-bird-brings-files.png",
            "image_alt": "bird-brings-files"
        },
    ];

    return (
        <div className="navigation-page">
            <h1>Highlights</h1>
            <span>pick a category:</span>
            <div className="cards-container" style={{ marginBottom: "5rem" }}>
                {navigation_data.map(item => (
                    <div
                        key={item.id}
                        className="card"
                        onClick={() => {
                            console.log("Clicked page_name:", item.page_name); // Debugging log
                            onClick(item.page_name);
                        }}
                        style={{ cursor: "pointer" }}
                    >
                        <img src={item.image_url} alt={item.image_alt} className="icon" />
                        <h3>{item.page_name.toUpperCase()}</h3>
                    </div>

                ))}
            </div>
        </div>
    );
}

export default Navigation;
