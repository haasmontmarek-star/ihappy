import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Initialize Resend
const getResend = () => {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("RESEND_API_KEY is not set. Email sending will be simulated.");
    return null;
  }
  return new Resend(key);
};

app.use(express.json());

// API route for contact form
app.post("/api/contact", async (req, res) => {
  const { email, phone, analysis } = req.body;
  if (!email || !phone) return res.status(400).json({ error: "Email i telefon jsou povinné" });

  const resend = getResend();
  if (resend) {
    try {
      await resend.emails.send({
        from: "iHappy Web <onboarding@resend.dev>",
        to: "ahoj@ihappy.cz",
        subject: "Nová rezervace konzultace - iHappy",
        html: `
          <h1>Nová rezervace konzultace</h1>
          <p><strong>Email klientky:</strong> ${email}</p>
          <p><strong>Telefon klientky:</strong> ${phone || 'Neuvedeno'}</p>
          <hr />
          <h2>Výsledek analýzy:</h2>
          <p><strong>Symptom:</strong> ${analysis?.symptom || 'Neuvedeno'}</p>
          <p><strong>Původ:</strong> ${analysis?.pastConnection || 'Neuvedeno'}</p>
        `,
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  } else {
    res.json({ success: true, message: "Email simulated" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
