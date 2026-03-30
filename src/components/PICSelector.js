import React, { useState } from 'react';
import '../styles/TeacherMonitoring.css';

const PICSelector = ({ onSelect, userEmail, activePICs }) => {
    const [selectedPIC, setSelectedPIC] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!selectedPIC) return;

        setIsSubmitting(true);
        await onSelect(selectedPIC);
        setIsSubmitting(false);
    };

    const isPICTaken = (picNumber) => {
        return activePICs.some(pic => pic.pic_number === picNumber && pic.user_email !== userEmail);
    };

    const getPICOwner = (picNumber) => {
        const pic = activePICs.find(p => p.pic_number === picNumber);
        return pic ? (pic.user_name || pic.user_email) : null;
    };

    return (
        <div className="pic-selector-container">
            <div className="pic-selector-card">
                <div className="pic-selector-header">
                    <h2>Teacher Monitoring</h2>
                    <p>Pilih peran PIC Anda untuk hari ini</p>
                </div>

                <div className="pic-selector-options">
                    {[1, 2, 3].map(num => {
                        const taken = isPICTaken(num);
                        const owner = getPICOwner(num);

                        return (
                            <button
                                key={num}
                                className={`pic-option ${selectedPIC === num ? 'selected' : ''} ${taken ? 'taken' : ''}`}
                                onClick={() => !taken && setSelectedPIC(num)}
                                disabled={taken}
                            >
                                <div className="pic-option-number">PIC {num}</div>
                                {taken && (
                                    <div className="pic-option-owner">
                                        Diambil oleh {owner}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="pic-selector-divider">
                    <span>atau</span>
                </div>

                <button
                    className={`pic-option observer ${selectedPIC === 0 ? 'selected' : ''}`}
                    onClick={() => setSelectedPIC(0)}
                >
                    <div className="pic-option-number">Observer</div>
                    <div className="pic-option-desc">Hanya melihat, bukan PIC aktif</div>
                </button>

                <button
                    className="pic-submit-btn"
                    onClick={handleSubmit}
                    disabled={selectedPIC === null || isSubmitting}
                >
                    {isSubmitting ? 'Menyimpan...' : 'Masuk ke Dashboard'}
                </button>

                <p className="pic-selector-note">
                    Pilihan ini akan tersimpan untuk hari ini. Anda tidak perlu memilih lagi sampai besok.
                </p>
            </div>
        </div>
    );
};

export default PICSelector;
