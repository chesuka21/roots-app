import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// Error boundary: si la app crashea, mostramos el error en pantalla en vez de
// quedar en blanco — así es legible y se puede reportar/corregir.
class Boundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, info: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { this.setState({ info }); console.error("Roots crash:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ fontFamily: "sans-serif", background: "#12181b", color: "#eae4d8", minHeight: "100vh", padding: 40 }}>
          <h2 style={{ color: "#d98c8c" }}>⚠️ Roots se cerró por un error</h2>
          <pre style={{ whiteSpace: "pre-wrap", background: "#1c2530", border: "1px solid #2f3b42", borderRadius: 10, padding: 14, fontSize: 13 }}>
{this.state.error && this.state.error.message}
{this.state.error && this.state.error.stack}
          </pre>
          <button
            onClick={() => { localStorage.removeItem("vocab-data"); location.reload(); }}
            style={{ marginTop: 12, background: "#6FBF8B", color: "#12181b", border: "none", borderRadius: 8, padding: "10px 16px", cursor: "pointer", fontWeight: 600 }}
          >
            Restablecer mis datos (borrar guardado) y recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Boundary>
      <App />
    </Boundary>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}