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
        <div className="navigation-page flex-home">
            <h1>Highlights</h1>
            <div className="flex" style={{ marginBottom: "5rem" }}>
                {navigation_data.map(item => (
                    <div key={item.id} className="card flex-home" onClick={() => onClick(item.page_name)} style={{ cursor: 'pointer' }}>
                        <img src={item.image_url} alt={item.image_alt} className="icon" />
                        <h3>{item.page_name.toUpperCase()}</h3>
                        <p>{item.description}</p>
                    </div>
                ))}
            </div>
            <div className="wave-footer">
                {/* <img
                    src="https://media.sessions.colearn.id/assets/other/images/2024-12-17T07:00:07.471Z-element-3-rev-2.png"
                    alt="Wave Footer"
                    className="wave-image"
                /> */}
            </div>
        </div>
    );
}

export default Navigation;
