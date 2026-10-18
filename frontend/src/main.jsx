// =====================================================================
// main.jsx – a React alkalmazás belépési pontja
// Betölti a stílusokat, és az App-ot a szolgáltatók (router, belépés,
// értesítések) közé csomagolva kirajzolja az index.html #root elemébe.
// =====================================================================

import React from 'react';                      // React könyvtár
import { createRoot } from 'react-dom/client';  // a böngészőbe rajzoló rész
import { BrowserRouter } from 'react-router-dom'; // útválasztó (URL ↔ oldal)
import App from './App.jsx';                    // az alkalmazás
import { AuthProvider } from './context/AuthContext.jsx'; // belépés és testprofil
import { ToastProvider } from './context/ToastContext.jsx'; // értesítések
import './styles/tokens.css';                   // design tokenek
import './styles/base.css';                     // alapstílusok (betű, háttér, gombok, mezők)
import './styles/components.css';               // komponensek stílusai
import './styles/pages.css';                    // oldalak elrendezése

createRoot(document.getElementById('root')).render( // a #root elembe rajzolunk
  <React.StrictMode>{/* szigorú mód: fejlesztés közben figyelmeztet a hibákra */}
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{/* útválasztó (a jövőbeli v7 viselkedés bekapcsolva) */}
      <ToastProvider>{/* értesítések */}
        <AuthProvider>{/* belépés és testprofil */}
          <App />{/* az alkalmazás */}
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
);                                              // render vége
