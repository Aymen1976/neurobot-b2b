import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [darkMode, setDarkMode] = useState(true);
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("neurobot_conversations")) || [];
    setConversations(saved);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      const updated = [...conversations, messages];
      localStorage.setItem("neurobot_conversations", JSON.stringify(updated));
      setConversations(updated);
    }
    // eslint-disable-next-line
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const response = await axios.post("http://localhost:8000/chat", {
        message: input,
      });

      const botMessage = { role: "assistant", content: response.data.response };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Erreur serveur." },
      ]);
    }
  };

  const exportPDF = async () => {
    try {
      const formData = new FormData();
      const formattedMessages = messages.map(
        (m) => `${m.role === "user" ? "Vous" : "Neurobot"} : ${m.content}`
      );
      formattedMessages.forEach((msg) => formData.append("messages", msg));

      const res = await axios.post("http://localhost:8000/export-pdf", formData, {
        responseType: "blob",
      });

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "neurobot_conversation.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Erreur à l'export PDF");
    }
  };

  const toggleTheme = () => setDarkMode((prev) => !prev);
  const newConversation = () => setMessages([]);

  const loadConversation = (index) => setMessages(conversations[index]);

  const deleteConversation = (index) => {
    const updated = conversations.filter((_, i) => i !== index);
    setConversations(updated);
    localStorage.setItem("neurobot_conversations", JSON.stringify(updated));
    setMessages([]);
  };

  return (
    <div className={`app ${darkMode ? "dark" : "light"}`}>
      <div className="sidebar">
        <h2>🧠 Historique</h2>
        {conversations.map((conv, idx) => (
          <div key={idx} className="conversation-preview">
            <button onClick={() => loadConversation(idx)}>
              Conversation {idx + 1}
            </button>
            <button onClick={() => deleteConversation(idx)}>🗑️</button>
          </div>
        ))}
      </div>

      <div className="main">
        <div className="app-header">
          <h1>🤖 Neurobot B2B</h1>
          <button onClick={toggleTheme}>
            Mode {darkMode ? "clair" : "sombre"}
          </button>
        </div>

        <div className="controls">
          <button className="control-button success" onClick={newConversation}>
            Nouvelle conversation
          </button>

          <button
            className="control-button word"
            onClick={() => document.getElementById("file-upload").click()}
          >
            Importer un fichier
          </button>

          <input
            id="file-upload"
            type="file"
            accept="application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const selectedFile = e.target.files[0];
              if (selectedFile) {
                setFile(selectedFile);
                const formData = new FormData();
                formData.append("file", selectedFile);
                axios
                  .post("http://localhost:8000/upload", formData)
                  .then((res) => {
                    const botMessage = {
                      role: "assistant",
                      content: res.data.response,
                    };
                    setMessages((prev) => [...prev, botMessage]);
                  })
                  .catch((err) => {
                    console.error(err);
                    setMessages((prev) => [
                      ...prev,
                      {
                        role: "assistant",
                        content: "Erreur lors de l’analyse du fichier.",
                      },
                    ]);
                  });
              }
            }}
          />

          <button className="control-button error" onClick={exportPDF}>
            Exportateur PDF
          </button>
        </div>

        <div className="message-container">
          {messages.map((msg, idx) => (
            <div key={idx} className={`message ${msg.role === "user" ? "user" : ""}`}>
              <strong>{msg.role === "user" ? "Vous" : "Neurobot"} :</strong> {msg.content}
            </div>
          ))}
        </div>

        <div className="input-area">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Posez votre question..."
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
            }}
          />
          <button onClick={sendMessage}>Envoyer</button>
        </div>
      </div>
    </div>
  );
}

export default App;
