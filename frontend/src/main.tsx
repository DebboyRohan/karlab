import "@mantine/core/styles.css";
import "@mantine/charts/styles.css";
import "@mantine/notifications/styles.css";
import "./app.css";

import { MantineProvider, createTheme, type MantineColorsTuple } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

// A deep "ledger" teal: calm, institutional, readable in both themes.
const ledger: MantineColorsTuple = [
  "#ebf6f7", "#d8ebee", "#acd5dc", "#7ebfc9", "#59acb9", "#41a0af", "#329aaa", "#228695", "#127785", "#006774",
];

const theme = createTheme({
  primaryColor: "ledger",
  primaryShade: { light: 8, dark: 5 },
  colors: { ledger },
  fontFamily: "'IBM Plex Sans', system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontFamilyMonospace: "'IBM Plex Mono', ui-monospace, 'SFMono-Regular', monospace",
  headings: { fontFamily: "'Source Serif 4', Georgia, 'Times New Roman', serif", fontWeight: "650" },
  defaultRadius: "sm",
  cursorType: "pointer",
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="bottom-right" />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MantineProvider>
  </React.StrictMode>,
);
