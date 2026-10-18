// =====================================================================
// ToastContext.jsx – rövid értesítések ("Avatar mentve", hibák)
// Desktopon jobb alul, mobilon felül jelennek meg, 4 mp után eltűnnek.
// =====================================================================

import { createContext, useCallback, useContext, useMemo, useState } from 'react'; // React horgok
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react'; // ikonok

const ToastContext = createContext(null);       // a közös "csatorna"
const ICONS = { success: CheckCircle2, info: Info, error: AlertCircle }; // típus → ikon

/**
 * Szolgáltató: az alkalmazás köré kerül, és kirajzolja az értesítéseket.
 */
export function ToastProvider({ children }) {   // gyerek komponensek
  const [toasts, setToasts] = useState([]);     // a látható értesítések listája

  const dismiss = useCallback((id) => {         // egy értesítés eltüntetése
    setToasts((list) => list.filter((t) => t.id !== id)); // kiszűrjük a listából
  }, []);                                       // nincs függősége

  const show = useCallback((message, type = 'success') => { // új értesítés
    const id = Date.now() + Math.random();      // egyedi azonosító
    setToasts((list) => [...list.slice(-2), { id, message, type }]); // legfeljebb 3 látszik egyszerre
    setTimeout(() => dismiss(id), 4000);        // 4 másodperc múlva eltűnik
  }, [dismiss]);                                // függőség

  const value = useMemo(() => ({ show }), [show]); // a megosztott érték

  return ( // a szolgáltató és az értesítések
    <ToastContext.Provider value={value}>{/* a közös érték átadása */}
      {children}{/* az alkalmazás többi része */}
      {/* az értesítések helye; aria-live: a képernyőolvasó felolvassa őket */}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => {                    /* minden értesítésre */
          const Icon = ICONS[t.type] ?? Info;   /* a típus ikonja */
          return ( // egy értesítés
            <div key={t.id} className={`toast toast--${t.type}`} role="status">{/* doboz a típus színével */}
              <Icon size={20} aria-hidden="true" />{/* típus ikon */}
              <span>{t.message}</span>{/* az üzenet */}
              <button type="button" className="toast__close" aria-label="Bezárás" onClick={() => dismiss(t.id)}><X size={16} /></button>{/* bezáró gomb */}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );                                            // return vége
}                                               // komponens vége

/**
 * Horog: const toast = useToast(); toast.show('Avatar mentve');
 */
export function useToast() {                    // horog
  return useContext(ToastContext);              // a közös érték
}                                               // horog vége
