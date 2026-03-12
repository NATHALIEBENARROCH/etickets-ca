export default function SearchLoading() {
  return (
    <main style={{ minHeight: "70vh", display: "grid", placeItems: "center", background: "#050714" }}>
      <div style={{ textAlign: "center", color: "#fff", fontFamily: "Arial" }}>
        <div
          style={{
            width: 44,
            height: 44,
            border: "4px solid rgba(255,255,255,0.25)",
            borderTopColor: "#ffffff",
            borderRadius: "50%",
            margin: "0 auto 12px",
            animation: "tb-spin 0.8s linear infinite",
          }}
        />
        <p style={{ margin: 0, opacity: 0.85 }}>Searching events...</p>
      </div>
      <style>{`@keyframes tb-spin { to { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
