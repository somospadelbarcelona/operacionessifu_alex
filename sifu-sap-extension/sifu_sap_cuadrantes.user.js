// ==UserScript==
// @name         SIFU SAP HO - Navegador Automático Cuadrantes
// @namespace    http://gruposifu.com/
// @version      1.0
// @description  Abre automáticamente la pestaña CUADRANTES y hace scroll a Empleados Asignados al entrar en cualquier proyecto en SAP HO
// @match        http://qgssrvs4pro.gruposifu.com:8000/sap/bc/ui5_ui5/sap/zso/*
// @match        http://qgssrvs4pro.gruposifu.com:8000/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';
    let ultimaRuta = '';
    let navegando = false;

    function activarCuadrantes() {
        if (navegando) return;
        navegando = true;

        let intentosTab = 0;
        const timer = setInterval(() => {
            intentosTab++;
            let tab = null;

            const items = document.querySelectorAll('.sapMITBText, .sapMITBFilter, .sapMITBItem');
            for (let el of items) {
                if ((el.innerText || el.textContent || '').trim().toUpperCase() === 'CUADRANTES') {
                    tab = el.closest('.sapMITBItem') || el.closest('.sapMITBFilter') || el;
                    break;
                }
            }

            if (tab) {
                clearInterval(timer);
                tab.click();
                tab.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

                try {
                    if (window.sap && window.sap.ui && window.sap.ui.getCore) {
                        const itb = window.sap.ui.getCore().byId('container---ProjectDetail--idIconTabBarStretchContent') || window.sap.ui.getCore().byId('idIconTabBarStretchContent');
                        if (itb && typeof itb.setSelectedKey === 'function') {
                            itb.setSelectedKey('CUADR');
                            itb.fireSelect({ selectedKey: 'CUADR', key: 'CUADR' });
                        }
                    }
                } catch (e) {}

                // Scroll a empleados asignados
                let intentosScroll = 0;
                const scrollTimer = setInterval(() => {
                    intentosScroll++;
                    let target = null;
                    const headers = document.querySelectorAll('.sapMPanelHdr, .sapMTitle, h2, h3, div');
                    for (let el of headers) {
                        const txt = (el.innerText || el.textContent || '').trim().toLowerCase();
                        if (txt.includes('empleados asignados') || txt.includes('recursos asignados')) {
                            target = el;
                            break;
                        }
                    }

                    if (target) {
                        clearInterval(scrollTimer);
                        navegando = false;
                        const panel = target.closest('.sapMPanel');
                        if (panel) {
                            const expandBtn = panel.querySelector('.sapMPanelExpandBtn');
                            if (expandBtn && panel.classList.contains('sapMPanelCollapsed')) {
                                expandBtn.click();
                            }
                        }
                        setTimeout(() => {
                            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 250);
                    } else if (intentosScroll > 20) {
                        clearInterval(scrollTimer);
                        navegando = false;
                    }
                }, 350);

            } else if (intentosTab > 30) {
                clearInterval(timer);
                navegando = false;
            }
        }, 500);
    }

    const SAP_PROJECT_ID_MAP = {
        'SVO09390-P1-C017': 'SVO10033-P1-C017',
        'SVO09390-P2-C018': 'SVO10033-P2-C018',
        'SVO14670-P1-C018': 'PROY017304-P1',
        'PROY018708-P1': 'PROY018780-P1',
        'PROY018171L': 'PGOC018171L',
        'PROY01817J': 'PGOC018171J'
    };

    function check() {
        const hash = window.location.hash || '';
        if (hash.includes('projectDetail')) {
            for (const [oldId, newId] of Object.entries(SAP_PROJECT_ID_MAP)) {
                if (hash.includes(oldId)) {
                    window.location.hash = hash.split(oldId).join(newId);
                    return;
                }
            }
            if (hash !== ultimaRuta) {
                ultimaRuta = hash;
                activarCuadrantes();
            }
        }
    }

    window.addEventListener('hashchange', check);
    setInterval(check, 800);
    check();
})();
