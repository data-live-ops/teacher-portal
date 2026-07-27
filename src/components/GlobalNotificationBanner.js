import React, { useState } from "react";
import "../styles/GlobalNotificationBanner.css";

// Toggle this to false (or delete the banner render in App.js) once the incident is resolved.
const SHOW_BANNER = false;

const BANNER_MESSAGE = {
  title: "Ada Gangguan Mendadak",
  body: "Teacher portal lagi ada gangguan pada database yang menyebabkan beberapa fitur tidak dapat diakses. System Ops sedang menangani perbaikan. Maafin.",
};

const GlobalNotificationBanner = () => {
  const [dismissed, setDismissed] = useState(false);

  if (!SHOW_BANNER || dismissed) {
    return null;
  }

  return (
    <div className="global-notification-banner" role="alert">
      <span className="global-notification-banner__icon" aria-hidden="true">
        ⚠️
      </span>
      <div className="global-notification-banner__text">
        <strong>{BANNER_MESSAGE.title}</strong>
        <span>{BANNER_MESSAGE.body}</span>
      </div>
      <button
        className="global-notification-banner__close"
        onClick={() => setDismissed(true)}
        aria-label="Tutup pemberitahuan"
      >
        &times;
      </button>
    </div>
  );
};

export default GlobalNotificationBanner;
