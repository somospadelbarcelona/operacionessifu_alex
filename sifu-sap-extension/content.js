// SIFU SAP HO - Navegador Automático a Cuadrantes y Empleados Asignados
(function () {
    console.log('[SIFU SAP HO] Extensión de navegación automática iniciada.');

    let ultimaRutaProcesada = '';
    let navegando = false;

    function ejecutarNavegacionCuadrantes() {
        if (navegando) return;
        navegando = true;

        let intentosTab = 0;
        const maxIntentosTab = 30; // Hasta 15 segundos esperando a que SAP UI5 renderice

        const intervaloTab = setInterval(() => {
            intentosTab++;

            // Buscar la pestaña CUADRANTES
            let tabEncontrado = null;

            // 1. Intentar por texto exacto en los tabs de IconTabBar
            const items = document.querySelectorAll('.sapMITBText, .sapMITBFilter, .sapMITBItem, .sapMITBHead .sapMText');
            for (let el of items) {
                const txt = (el.innerText || el.textContent || '').trim().toUpperCase();
                if (txt === 'CUADRANTES') {
                    tabEncontrado = el.closest('.sapMITBItem') || el.closest('.sapMITBFilter') || el;
                    break;
                }
            }

            // 2. Fallback: buscar cualquier elemento que diga CUADRANTES dentro del IconTabBar
            if (!tabEncontrado) {
                const todos = document.querySelectorAll('*');
                for (let el of todos) {
                    if (el.children.length === 0 && (el.textContent || '').trim().toUpperCase() === 'CUADRANTES') {
                        const tabParent = el.closest('.sapMITBItem') || el.closest('[role="tab"]') || el;
                        if (tabParent) {
                            tabEncontrado = tabParent;
                            break;
                        }
                    }
                }
            }

            if (tabEncontrado) {
                clearInterval(intervaloTab);
                console.log('[SIFU SAP HO] Pestaña CUADRANTES localizada. Haciendo clic...');

                // Simular clic completo
                tabEncontrado.click();
                tabEncontrado.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

                // Si SAP UI5 Core está expuesto, forzar también a nivel de modelo
                try {
                    if (window.sap && window.sap.ui && window.sap.ui.getCore) {
                        const core = window.sap.ui.getCore();
                        const itb = core.byId('container---ProjectDetail--idIconTabBarStretchContent') || core.byId('idIconTabBarStretchContent');
                        if (itb && typeof itb.setSelectedKey === 'function') {
                            itb.setSelectedKey('CUADR');
                            itb.fireSelect({ selectedKey: 'CUADR', key: 'CUADR' });
                        }
                    }
                } catch (e) {
                    console.warn('[SIFU SAP HO] Nota sobre sap.ui.core:', e);
                }

                // Ahora buscar y hacer scroll a la sección "Empleados asignados"
                posicionarEnEmpleadosAsignados();
            } else if (intentosTab >= maxIntentosTab) {
                clearInterval(intervaloTab);
                navegando = false;
                console.warn('[SIFU SAP HO] No se encontró la pestaña CUADRANTES tras varios intentos.');
            }
        }, 500);
    }

    function posicionarEnEmpleadosAsignados() {
        let intentosScroll = 0;
        const maxIntentosScroll = 20;

        const intervaloScroll = setInterval(() => {
            intentosScroll++;

            let elementoObjetivo = null;

            // Buscar el encabezado o panel de "Empleados asignados"
            const headers = document.querySelectorAll('.sapMPanelHdr, .sapMTitle, h2, h3, .sapMPanelExpandable .sapMPanelHdr, .sapUiTableHeaderRow');
            for (let el of headers) {
                const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
                if (txt.includes('empleados asignados') || txt.includes('recursos asignados')) {
                    elementoObjetivo = el;
                    break;
                }
            }

            // Fallback genérico por texto
            if (!elementoObjetivo) {
                const elementos = document.querySelectorAll('div, span, header');
                for (let el of elementos) {
                    if (el.children.length <= 2) {
                        const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
                        if (txt === 'empleados asignados') {
                            elementoObjetivo = el;
                            break;
                        }
                    }
                }
            }

            if (elementoObjetivo) {
                clearInterval(intervaloScroll);
                navegando = false;

                // Si el panel padre está colapsado, expandirlo
                const panel = elementoObjetivo.closest('.sapMPanel');
                if (panel) {
                    const expandBtn = panel.querySelector('.sapMPanelExpandBtn');
                    if (expandBtn && panel.classList.contains('sapMPanelCollapsed')) {
                        expandBtn.click();
                    }
                }

                setTimeout(() => {
                    elementoObjetivo.scrollIntoView({ behavior: 'smooth', block: 'start' });

                    // Resaltado visual sutil para facilitar la lectura al usuario
                    elementoObjetivo.style.transition = 'all 0.5s ease';
                    const bgOriginal = elementoObjetivo.style.backgroundColor;
                    elementoObjetivo.style.backgroundColor = '#dbeafe';
                    elementoObjetivo.style.borderRadius = '6px';
                    elementoObjetivo.style.padding = '4px 8px';

                    setTimeout(() => {
                        elementoObjetivo.style.backgroundColor = bgOriginal;
                    }, 2500);

                    mostrarNotificacionSifu('✅ Pestaña CUADRANTES > Empleados Asignados');
                }, 300);
            } else if (intentosScroll >= maxIntentosScroll) {
                clearInterval(intervaloScroll);
                navegando = false;
            }
        }, 350);
    }

    function mostrarNotificacionSifu(texto) {
        const id = 'sifu-sap-indicator';
        let notif = document.getElementById(id);
        if (!notif) {
            notif = document.createElement('div');
            notif.id = id;
            notif.style.cssText = `
                position: fixed;
                bottom: 24px;
                right: 24px;
                z-index: 999999;
                background: #1e3a8a;
                color: #ffffff;
                padding: 10px 18px;
                border-radius: 8px;
                box-shadow: 0 4px 14px rgba(0,0,0,0.25);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 13px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 8px;
                pointer-events: none;
                transition: opacity 0.4s ease;
            `;
            document.body.appendChild(notif);
        }
        notif.textContent = texto;
        notif.style.opacity = '1';

        setTimeout(() => {
            if (notif) notif.style.opacity = '0';
        }, 4000);
    }

    function comprobarRuta() {
        const hash = window.location.hash || '';
        if (hash.includes('projectDetail') && hash !== ultimaRutaProcesada) {
            ultimaRutaProcesada = hash;
            ejecutarNavegacionCuadrantes();
        }
    }

    // Escuchar cambios de ruta en SPA UI5
    window.addEventListener('hashchange', comprobarRuta);
    window.addEventListener('popstate', comprobarRuta);

    // Iniciar chequeo periódico por si entra directo
    setInterval(comprobarRuta, 800);
    comprobarRuta();
})();
