const statusRows = [
  "Security controls updating",
  "Service integrity verification",
  "Platform modules restarting"
];

export default function App() {
  return (
    <>
      <style>{`
        :root {
          color-scheme: dark;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
        }

        .maintenance-shell {
          position: relative;
          min-height: 100vh;
          overflow: hidden;
          display: grid;
          place-items: center;
          padding: clamp(18px, 3vw, 24px);
          background:
            radial-gradient(circle at top, rgba(0, 229, 255, 0.16), transparent 28%),
            radial-gradient(circle at 80% 20%, rgba(94, 234, 212, 0.08), transparent 22%),
            linear-gradient(180deg, #04070d 0%, #07111c 45%, #03060b 100%);
          color: #e5f2ff;
          font-family: Inter, "Segoe UI", system-ui, sans-serif;
          isolation: isolate;
        }

        .maintenance-shell::before,
        .maintenance-shell::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
        }

        .maintenance-shell::before {
          background-image:
            linear-gradient(rgba(0, 229, 255, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 229, 255, 0.07) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(circle at center, black 45%, transparent 88%);
          opacity: 0.45;
        }

        .maintenance-shell::after {
          top: -15%;
          height: 30%;
          background: linear-gradient(
            180deg,
            rgba(0, 229, 255, 0) 0%,
            rgba(0, 229, 255, 0.12) 50%,
            rgba(0, 229, 255, 0) 100%
          );
          animation: scanline 7s linear infinite;
        }

        .maintenance-panel {
          position: relative;
          z-index: 1;
          width: min(100%, 680px);
          padding: 32px 28px;
          border: 1px solid rgba(0, 229, 255, 0.2);
          border-radius: 22px;
          background: rgba(7, 16, 28, 0.82);
          box-shadow:
            0 0 0 1px rgba(148, 163, 184, 0.08) inset,
            0 22px 64px rgba(2, 8, 18, 0.62),
            0 0 32px rgba(0, 229, 255, 0.07);
          backdrop-filter: blur(16px);
          text-align: center;
          animation: panelFloat 5s ease-in-out infinite;
        }

        .maintenance-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 9px 16px;
          border-radius: 999px;
          border: 1px solid rgba(94, 234, 212, 0.3);
          background: rgba(8, 23, 33, 0.88);
          color: #86efac;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          box-shadow: 0 0 18px rgba(16, 185, 129, 0.12);
        }

        .maintenance-badge::before {
          content: "";
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: #34d399;
          box-shadow: 0 0 16px rgba(52, 211, 153, 0.9);
          animation: pulse 1.8s ease-in-out infinite;
        }

        .maintenance-title {
          margin: 20px 0 14px;
          font-size: clamp(1.95rem, 3.6vw, 3.35rem);
          line-height: 1.08;
          letter-spacing: -0.03em;
        }

        .maintenance-message {
          margin: 0 auto;
          max-width: 500px;
          color: rgba(214, 227, 241, 0.84);
          font-size: clamp(0.96rem, 1.8vw, 1.05rem);
          line-height: 1.65;
        }

        .maintenance-loader {
          position: relative;
          width: 92px;
          height: 92px;
          margin: 30px auto 22px;
          display: grid;
          place-items: center;
        }

        .maintenance-loader span {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 1px solid transparent;
        }

        .maintenance-loader span:nth-child(1) {
          border-top-color: rgba(0, 229, 255, 0.95);
          animation: rotate 2s linear infinite;
        }

        .maintenance-loader span:nth-child(2) {
          inset: 8px;
          border-right-color: rgba(94, 234, 212, 0.8);
          animation: rotateReverse 2.8s linear infinite;
        }

        .maintenance-loader span:nth-child(3) {
          inset: 18px;
          border-bottom-color: rgba(148, 163, 184, 0.75);
          animation: rotate 1.8s linear infinite;
        }

        .maintenance-loader strong {
          padding: 8px 12px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(3, 7, 14, 0.76);
          color: #7dd3fc;
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .maintenance-status {
          display: grid;
          gap: 10px;
          margin: 0 auto;
          padding: 0;
          max-width: 430px;
          list-style: none;
        }

        .maintenance-status li {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 12px 16px;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 14px;
          background: rgba(8, 15, 25, 0.72);
          color: rgba(226, 232, 240, 0.9);
          text-align: left;
          font-size: 0.95rem;
        }

        .maintenance-status li::after {
          content: "Active";
          color: #67e8f9;
          font-size: 0.76rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .maintenance-footer {
          margin-top: 20px;
          color: rgba(148, 163, 184, 0.75);
          font-size: 0.84rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes rotateReverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.35); opacity: 1; }
        }

        @keyframes scanline {
          0% { transform: translateY(-180%); }
          100% { transform: translateY(420%); }
        }

        @keyframes panelFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        @media (max-width: 640px) {
          .maintenance-panel {
            width: min(100%, 560px);
            padding: 26px 18px;
            border-radius: 18px;
          }

          .maintenance-title {
            margin-top: 18px;
          }

          .maintenance-loader {
            width: 84px;
            height: 84px;
            margin: 26px auto 20px;
          }

          .maintenance-status li {
            flex-direction: column;
            align-items: flex-start;
          }

          .maintenance-status li::after {
            margin-top: 4px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .maintenance-shell::after,
          .maintenance-panel,
          .maintenance-badge::before,
          .maintenance-loader span {
            animation: none !important;
          }
        }
      `}</style>

      <main className="maintenance-shell">
        <section className="maintenance-panel" aria-labelledby="maintenance-title">
          <div className="maintenance-badge">Maintenance in Progress</div>
          <h1 id="maintenance-title" className="maintenance-title">
            BaeSpy Under Maintenance
          </h1>
          <p className="maintenance-message">
            The system is temporarily unavailable while maintenance is being performed. Please
            check back later.
          </p>

          <div className="maintenance-loader" aria-hidden="true">
            <span />
            <span />
            <span />
            <strong>Securing</strong>
          </div>

          <ul className="maintenance-status" aria-label="Maintenance activity">
            {statusRows.map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>

          <div className="maintenance-footer">Cybersecurity platform maintenance window</div>
        </section>
      </main>
    </>
  );
}
